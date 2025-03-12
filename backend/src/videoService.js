const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const execAsync = promisify(exec);
const fsPromises = fs.promises;

const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || '/app/data';

// Stelle sicher, dass das Download-Verzeichnis existiert
async function ensureDownloadDir()
{
  try
  {
    await fsPromises.mkdir(DOWNLOAD_DIR, { recursive: true });
    console.log(`Download directory: ${DOWNLOAD_DIR}`);
  } catch (error)
  {
    console.error(`Error creating download directory: ${error.message}`);
    throw error;
  }
}

// Initialisiere das Download-Verzeichnis
ensureDownloadDir();

// Service-Objekt
const videoService = {
  /**
   * Validiere YouTube-URL
   * @param {string} url - YouTube-URL
   * @returns {Promise<boolean>} - Ist die URL gültig?
   */
  async validateUrl(url)
  {
    try
    {
      const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
      if (!pattern.test(url))
      {
        return false;
      }

      // Prüfe, ob das Video existiert, indem die Basisinformationen abgerufen werden
      await this.getVideoInfo(url);
      return true;
    } catch (error)
    {
      console.error(`Error validating YouTube URL: ${error.message}`);
      return false;
    }
  },

  /**
   * Video-Informationen mit yt-dlp abrufen
   * @param {string} url - YouTube-URL
   * @returns {Promise<Object>} - Video-Informationen
   */
  async getVideoInfo(url)
  {
    try
    {
      const command = `yt-dlp --dump-json "${url}"`;
      const { stdout } = await execAsync(command);
      return JSON.parse(stdout);
    } catch (error)
    {
      console.error(`Error getting video info: ${error.message}`);
      throw new Error('Failed to retrieve video information');
    }
  },

  /**
   * Video-Verarbeitung
   * @param {string} url - YouTube-URL
   * @param {Array<{start: number, end: number}>} segments - Zeitsegmente
   * @param {string} quality - Videoqualität ('144', '240', '360', '480', '720', '1080', '1440', '2160', 'audio')
   * @returns {Promise<Array<{segment: {start: number, end: number}, filePath: string}>>} - Ergebnisse
   */
  async processVideo(url, segments, quality = "720")
  {
    let downloadedFile = null;
    try
    {
      const videoId = uuidv4();
      downloadedFile = await this.downloadVideo(url, videoId, quality);
      const results = [];

      // Prüfen, ob nur Audio gewünscht ist
      const audioOnly = quality === "audio";

      for (let i = 0; i < segments.length; i++)
      {
        const segment = segments[i];
        const segmentId = `${videoId}_segment_${i}`;
        const segmentPath = await this.extractSegment(
          downloadedFile,
          segment.start,
          segment.end,
          segmentId,
          audioOnly
        );

        results.push({
          segment,
          filePath: segmentPath
        });
      }
      return results;
    } catch (error)
    {
      console.error(`Processing error: ${error.message}`);
      throw new Error(`Failed to process video: ${error.message}`);
    } finally
    {
      if (downloadedFile)
      {
        fsPromises.unlink(downloadedFile)
          .then(() => console.log(`Deleted downloaded file ${downloadedFile}`))
          .catch(err => console.error(`Error deleting file ${downloadedFile}: ${err.message}`));
      }
    }
  },

  /**
   * Video herunterladen
   * @param {string} url - YouTube-URL
   * @param {string} outputName - Ausgabename (ohne Erweiterung)
   * @param {string} quality - Videoqualität ('144', '240', '360', '480', '720', '1080', '1440', '2160', 'audio')
   * @returns {Promise<string>} - Pfad zur heruntergeladenen Datei
   */
  async downloadVideo(url, outputName, quality = "720")
  {
    try
    {
      const outputPath = path.join(DOWNLOAD_DIR, `${outputName}.%(ext)s`);

      // Format-Option basierend auf dem Qualitätsparameter bestimmen
      let formatOption;

      if (quality === "audio")
      {
        formatOption = "bestaudio";
      } else
      {
        // Bei numerischen Werten nach Auflösung auswählen
        // Erweiterte Format-Auswahl, die bessere Matches für die gewünschte Auflösung liefert
        formatOption = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;
      }

      // Füge Verbose-Ausgabe hinzu, um die tatsächlich ausgewählte Auflösung zu sehen
      const command = `yt-dlp -f "${formatOption}" --verbose -o "${outputPath}" "${url}"`;

      console.log(`Starting download: ${url} with quality: ${quality}`);
      const { stdout, stderr } = await execAsync(command);

      // Log für Debug-Zwecke
      console.log(`Selected format details: ${stderr}`);
      console.log(`Download completed: ${url}`);

      // Finde die heruntergeladene Datei - wir müssen prüfen, welche Erweiterung verwendet wurde
      const files = await fsPromises.readdir(DOWNLOAD_DIR);
      const downloadedFile = files.find(file => file.startsWith(outputName + '.'));

      if (!downloadedFile)
      {
        throw new Error('Downloaded file not found');
      }

      // Zeige Infos über die heruntergeladene Datei an
      const fileStats = await fsPromises.stat(path.join(DOWNLOAD_DIR, downloadedFile));
      console.log(`Downloaded file: ${downloadedFile}, size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`);

      // FFprobe aufrufen, um Videoinformationen zu erhalten
      try
      {
        const ffprobeCommand = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of csv=s=,:p=0 "${path.join(DOWNLOAD_DIR, downloadedFile)}"`;
        const { stdout: ffprobeOut } = await execAsync(ffprobeCommand);
        console.log(`Video details: ${ffprobeOut.trim()}`);
      } catch (ffprobeError)
      {
        console.error(`Could not get video details: ${ffprobeError.message}`);
      }

      return path.join(DOWNLOAD_DIR, downloadedFile);
    } catch (error)
    {
      console.error(`Download error: ${error.message}`);
      throw new Error(`Failed to download video: ${error.message}`);
    }
  },

  /**
   * Segment aus Video extrahieren
   * @param {string} inputFile - Pfad zur Eingabedatei
   * @param {number} startTime - Startzeit in Sekunden
   * @param {number} endTime - Endzeit in Sekunden
   * @param {string} outputName - Ausgabename (ohne Erweiterung)
   * @param {boolean} audioOnly - Nur Audio extrahieren (ohne Video)
   * @returns {Promise<string>} - Pfad zum extrahierten Segment
   */
  async extractSegment(inputFile, startTime, endTime, outputName, audioOnly = false)
  {
    try
    {
      // Bestimme Dateierweiterung und -pfad basierend auf dem audioOnly-Parameter
      const fileExtension = audioOnly ? "mp3" : "mp4";
      const outputFile = path.join(DOWNLOAD_DIR, `${outputName}.${fileExtension}`);

      // Formatiere Zeiten für FFmpeg (HH:MM:SS.mmm)
      const formatTime = (seconds) =>
      {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
      };

      const startTimeFormatted = formatTime(startTime);
      const duration = endTime - startTime;

      let command;

      if (audioOnly)
      {
        // Für Audio-only: Extrahiere als MP3 mit hoher Qualität
        command = `ffmpeg -i "${inputFile}" -ss ${startTimeFormatted} -t ${duration} -vn -c:a libmp3lame -q:a 2 "${outputFile}"`;
        console.log(`Extracting audio segment: ${startTime}s to ${endTime}s from ${path.basename(inputFile)}`);
      } else
      {
        // Für Video: Behalte bisherigen Befehl bei
        command = `ffmpeg -i "${inputFile}" -ss ${startTimeFormatted} -t ${duration} -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k -movflags +faststart "${outputFile}"`;
        console.log(`Extracting video segment: ${startTime}s to ${endTime}s from ${path.basename(inputFile)}`);
      }

      const { stdout, stderr } = await execAsync(command);

      console.log(`Segment extraction completed: ${outputFile}`);

      // Bei Audio-Segmenten Dateiinfos anzeigen
      if (audioOnly)
      {
        const fileStats = await fsPromises.stat(outputFile);
        console.log(`Audio file size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`);

        try
        {
          const ffprobeCommand = `ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,bit_rate,sample_rate -of csv=s=,:p=0 "${outputFile}"`;
          const { stdout: ffprobeOut } = await execAsync(ffprobeCommand);
          console.log(`Audio details: ${ffprobeOut.trim()}`);
        } catch (ffprobeError)
        {
          console.error(`Could not get audio details: ${ffprobeError.message}`);
        }
      }

      return outputFile;
    } catch (error)
    {
      console.error(`Error extracting segment: ${error.message}`);
      throw new Error(`Failed to extract segment: ${error.message}`);
    }
  }
};

module.exports = videoService;