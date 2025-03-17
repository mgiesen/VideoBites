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
   * Video-Verarbeitung mit optionaler Parallelisierung
   * @param {string} url - YouTube-URL
   * @param {Array<{start: number, end: number}>} segments - Zeitsegmente
   * @param {string} quality - Videoqualität ('144', '240', '360', '480', '720', '1080', '1440', '2160', 'audio')
   * @param {boolean} mergeSegments - Ob die Segmente zu einer Datei zusammengefügt werden sollen
   * @param {Object} job - Das Job-Objekt für Status-Updates
   * @param {boolean} parallelExtraction - Ob die Segmente parallel verarbeitet werden sollen
   * @returns {Promise<void>} - Promise, die aufgelöst wird, wenn die Verarbeitung abgeschlossen ist
   */
  async processVideo(url, segments, quality = "720", mergeSegments = false, job, parallelExtraction = true)
  {
    if (!job) throw new Error('Job not provided');

    job.status = 'processing';
    job.result = [];

    let downloadedFile = null;
    try
    {
      const videoId = uuidv4();
      downloadedFile = await this.downloadVideo(url, videoId, quality);

      // Unterschiedliche Verarbeitung je nach parallelExtraction-Parameter
      if (parallelExtraction)
      {
        // PARALLELE VERARBEITUNG
        console.log(`Video heruntergeladen. Starte parallele Verarbeitung von ${segments.length} Segmenten`);

        // Alle Segmentextraktionen gleichzeitig starten
        const segmentPromises = segments.map(async (segment, i) =>
        {
          const segmentId = `${videoId}_segment_${i}`;
          console.log(`Starte Extraktion von Segment ${i + 1}/${segments.length}: ${segment.start}s bis ${segment.end}s`);

          const segmentPath = await this.extractSegment(
            downloadedFile,
            segment.start,
            segment.end,
            segmentId,
            quality === "audio"
          );

          console.log(`Segment ${i + 1}/${segments.length} fertig extrahiert: ${path.basename(segmentPath)}`);

          return {
            segment,
            filePath: segmentPath,
            type: quality === "audio" ? "audio" : "video",
            index: i // Index für die spätere Sortierung
          };
        });

        // Auf alle Segmentextraktionen warten
        const results = await Promise.all(segmentPromises);
        console.log(`Alle ${segments.length} Segmente wurden parallel verarbeitet`);

        // Ergebnisse in sortierter Reihenfolge hinzufügen
        results.sort((a, b) => a.index - b.index);
        for (const { segment, filePath, type } of results)
        {
          job.result.push({ segment, filePath, type });
        }
      } else
      {
        // SEQUENTIELLE VERARBEITUNG (ursprünglicher Code)
        console.log(`Video heruntergeladen. Starte sequentielle Verarbeitung von ${segments.length} Segmenten`);

        // Individuelle Segmente nacheinander verarbeiten
        for (let i = 0; i < segments.length; i++)
        {
          const segment = segments[i];
          const segmentId = `${videoId}_segment_${i}`;
          console.log(`Starte Extraktion von Segment ${i + 1}/${segments.length}: ${segment.start}s bis ${segment.end}s`);

          const segmentPath = await this.extractSegment(
            downloadedFile,
            segment.start,
            segment.end,
            segmentId,
            quality === "audio"
          );

          job.result.push({
            segment,
            filePath: segmentPath,
            type: quality === "audio" ? "audio" : "video"
          });

          console.log(`Segment ${i + 1}/${segments.length} fertig extrahiert: ${path.basename(segmentPath)}`);
        }

        console.log(`Alle ${segments.length} Segmente wurden sequentiell verarbeitet`);
      }

      // Zusammenschnitt erstellen, falls aktiviert
      if (mergeSegments && segments.length > 1)
      {
        const segmentFiles = job.result.map(r => r.filePath);
        const mergedFilePath = await this.createCompilation(videoId, segmentFiles, quality === "audio");
        const totalDuration = segments.reduce((total, seg) => total + (seg.end - seg.start), 0);
        const startTime = segments[0].start;
        const endTime = startTime + totalDuration;
        job.result.push({
          segment: { start: startTime, end: endTime, isMerged: true },
          filePath: mergedFilePath,
          type: quality === "audio" ? "audio" : "video"
        });
      }

      // Erstelle Dokumentation
      const videoInfo = await this.getVideoInfo(url);
      const documentation = await this.createDocumentation(videoInfo, segments, job.result, job.id);
      job.documentation = documentation;

      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error)
    {
      console.error(`Processing error: ${error.message}`);
      job.status = 'failed';
      job.error = error.message;
      throw error; // Fehler wird im route handler abgefangen
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

  async createDocumentation(videoInfo, segments, results, jobId)
  {
    try
    {
      // Erstelle eine neue JSON-Struktur mit allen relevanten Metadaten
      const documentation = {
        videoInfo: {
          id: videoInfo.id,
          title: videoInfo.title,
          uploader: videoInfo.uploader,
          uploadDate: videoInfo.upload_date,
          duration: videoInfo.duration,
          viewCount: videoInfo.view_count,
          url: videoInfo.original_url,
          channelUrl: videoInfo.channel_url,
          description: videoInfo.description,
          categories: videoInfo.categories || [],
          tags: videoInfo.tags || [],
          resolution: videoInfo.resolution,
          language: videoInfo.language,
        },
        segments: segments.map((segment, index) =>
        {
          const result = results.find(r =>
            !r.segment.isMerged &&
            r.segment.start === segment.start &&
            r.segment.end === segment.end
          );
          return {
            title: segment.title || `Segment ${index + 1}`,
            start: segment.start,
            end: segment.end,
            duration: segment.end - segment.start,
            fileName: result ? path.basename(result.filePath) : null
          };
        }),
        extractedAt: new Date().toISOString(),
        jobId
      };

      // Füge Informationen zum zusammengeführten Segment hinzu, falls vorhanden
      const mergedResult = results.find(r => r.segment && r.segment.isMerged);
      if (mergedResult)
      {
        documentation.mergedSegment = {
          fileName: path.basename(mergedResult.filePath),
          duration: mergedResult.segment.end - mergedResult.segment.start
        };
      }

      return documentation;
    } catch (error)
    {
      console.error(`Error creating documentation: ${error.message}`);
      throw new Error('Failed to create documentation');
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
        formatOption = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`;
      }

      const command = `yt-dlp -f "${formatOption}" --verbose -o "${outputPath}" "${url}"`;

      console.log(`Starting download: ${url} with quality: ${quality}`);
      const { stdout, stderr } = await execAsync(command);

      console.log(`Selected format details: ${stderr}`);
      console.log(`Download completed: ${url}`);

      const files = await fsPromises.readdir(DOWNLOAD_DIR);
      const downloadedFile = files.find(file => file.startsWith(outputName + '.'));

      if (!downloadedFile)
      {
        throw new Error('Downloaded file not found');
      }

      const fileStats = await fsPromises.stat(path.join(DOWNLOAD_DIR, downloadedFile));
      console.log(`Downloaded file: ${downloadedFile}, size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`);

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
      const fileExtension = audioOnly ? "mp3" : "mp4";
      const outputFile = path.join(DOWNLOAD_DIR, `${outputName}.${fileExtension}`);

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
        command = `ffmpeg -i "${inputFile}" -ss ${startTimeFormatted} -t ${duration} -vn -c:a libmp3lame -q:a 2 "${outputFile}"`;
        console.log(`Extracting audio segment: ${startTime}s to ${endTime}s from ${path.basename(inputFile)}`);
      } else
      {
        command = `ffmpeg -i "${inputFile}" -ss ${startTimeFormatted} -t ${duration} -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k -movflags +faststart "${outputFile}"`;
        console.log(`Extracting video segment: ${startTime}s to ${endTime}s from ${path.basename(inputFile)}`);
      }

      const { stdout, stderr } = await execAsync(command);

      console.log(`Segment extraction completed: ${outputFile}`);

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
  },

  /**
   * Erstellt einen separaten Zusammenschnitt aus den vorhandenen Videosegmenten
   * @param {string} jobId - Die Job-ID
   * @param {Array<string>} segmentFiles - Pfade zu den Segment-Dateien
   * @param {boolean} audioOnly - Nur Audio extrahieren (ohne Video)
   * @returns {Promise<string>} - Pfad zur zusammengefügten Datei
   */
  async createCompilation(jobId, segmentFiles, audioOnly = false)
  {
    try
    {
      const fileExtension = audioOnly ? "mp3" : "mp4";
      const outputName = `${jobId}_merged`;
      const outputFile = path.join(DOWNLOAD_DIR, `${outputName}.${fileExtension}`);

      console.log(`Creating compilation to: ${outputFile}`);
      console.log(`Input files (${segmentFiles.length}): ${segmentFiles.join(', ')}`);

      const tempSegmentFiles = [];

      try
      {
        for (let i = 0; i < segmentFiles.length; i++)
        {
          const originalFile = segmentFiles[i];
          const tempFile = path.join(DOWNLOAD_DIR, `temp_${path.basename(originalFile)}`);
          await fsPromises.copyFile(originalFile, tempFile);
          tempSegmentFiles.push(tempFile);
          console.log(`Created temporary copy: ${tempFile}`);
        }

        const timestamp = Date.now();
        const fileListPath = path.join(DOWNLOAD_DIR, `${outputName}_filelist_${timestamp}.txt`);
        const fileListContent = tempSegmentFiles.map(file => `file '${file}'`).join('\n');
        await fsPromises.writeFile(fileListPath, fileListContent);
        console.log(`Created file list with ${tempSegmentFiles.length} segments at ${fileListPath}`);

        const command = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputFile}"`;

        console.log(`Running FFmpeg command: ${command}`);
        const { stdout, stderr } = await execAsync(command);

        if (stdout) console.log(`FFmpeg stdout: ${stdout}`);
        if (stderr) console.log(`FFmpeg stderr: ${stderr}`);

        await fsPromises.unlink(fileListPath)
          .catch(err => console.error(`Error deleting file list: ${err.message}`));

        for (const tempFile of tempSegmentFiles)
        {
          await fsPromises.unlink(tempFile)
            .catch(err => console.error(`Error deleting temp file ${tempFile}: ${err.message}`));
        }

        if (!fs.existsSync(outputFile))
        {
          throw new Error(`Output file was not created: ${outputFile}`);
        }

        const fileStats = await fsPromises.stat(outputFile);
        console.log(`Compilation created successfully: ${outputFile}, size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`);

        return outputFile;
      } finally
      {
        for (const tempFile of tempSegmentFiles)
        {
          if (fs.existsSync(tempFile))
          {
            try
            {
              await fsPromises.unlink(tempFile);
              console.log(`Cleaned up temp file: ${tempFile}`);
            } catch (err)
            {
              console.error(`Error during cleanup of temp file ${tempFile}: ${err.message}`);
            }
          }
        }
      }
    } catch (error)
    {
      console.error(`Error creating compilation: ${error.message}`);
      throw new Error(`Failed to create compilation: ${error.message}`);
    }
  }
};

module.exports = videoService;