const express = require('express');
const router = express.Router();
const videoService = require('./videoService');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Aktive Jobs speichern
const jobs = new Map();

// YouTube-URL validieren
router.post('/validate', async (req, res) =>
{
  try
  {
    const { url } = req.body;

    if (!url)
    {
      return res.status(400).json({ error: 'URL is required' });
    }

    const isValid = await videoService.validateUrl(url);
    return res.status(200).json({ valid: isValid });
  } catch (error)
  {
    console.error('Error validating URL:', error);
    return res.status(500).json({ error: 'Failed to validate URL' });
  }
});

// Video-Information abrufen
router.post('/info', async (req, res) =>
{
  try
  {
    const { url } = req.body;

    if (!url)
    {
      return res.status(400).json({ error: 'URL is required' });
    }

    const info = await videoService.getVideoInfo(url);
    return res.status(200).json(info);
  } catch (error)
  {
    console.error('Error getting video info:', error);
    return res.status(500).json({ error: 'Failed to get video information' });
  }
});

// Segment eines Videos extrahieren
router.post('/extract', async (req, res) =>
{
  try
  {
    const { url, segments, quality, mergeSegments, createDocumentation } = req.body;

    if (!url)
    {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!Array.isArray(segments) || segments.length === 0)
    {
      return res.status(400).json({ error: 'At least one segment is required' });
    }

    const validQualityOptions = ["144", "240", "360", "480", "720", "1080", "1440", "2160", "audio"];
    const defaultQuality = "720";
    const videoQuality = quality && validQualityOptions.includes(quality) ? quality : defaultQuality;

    const jobId = uuidv4();
    const job = {
      id: jobId,
      url,
      segments,
      quality: videoQuality,
      mergeSegments: !!mergeSegments,
      createDocumentation: !!createDocumentation,
      status: 'processing',
      result: [],
      error: null,
      createdAt: new Date()
    };
    jobs.set(jobId, job);

    // Verarbeitung starten und Job-Objekt übergeben
    videoService.processVideo(url, segments, videoQuality, !!mergeSegments, job, !!createDocumentation).catch(error =>
    {
      console.error('Error in processVideo:', error);
      job.status = 'failed';
      job.error = error.message;
      jobs.set(jobId, job);
    });

    return res.status(202).json({ jobId, status: 'processing' });
  }
  catch (error)
  {
    console.error('Error processing video:', error);
    return res.status(500).json({ error: 'Failed to process video' });
  }
});

// Status eines Jobs abrufen
router.get('/status/:jobId', (req, res) =>
{
  const { jobId } = req.params;

  const job = jobs.get(jobId);

  if (!job)
  {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Vor dem Senden prüfen, ob es ein zusammengeführtes Segment gibt, das noch nicht fertig ist
  if (job.result)
  {
    const mergedSegmentIndex = job.result.findIndex(r => r.segment && r.segment.isMerged && r.filePath === null);
    if (mergedSegmentIndex !== -1)
    {
      // Wenn das zusammengeführte Segment noch nicht fertig ist, setzen wir den Status des Jobs auf "compiling"
      job.compilationStatus = "in_progress";
    } else if (job.compilationStatus === "in_progress")
    {
      // Wenn das zusammengeführte Segment fertig ist und vorher im Status "compiling" war,
      // setzen wir den Status des Jobs auf "completed"
      job.compilationStatus = "completed";
    }
  }

  return res.status(200).json(job);
});

// Video herunterladen
router.get('/download/:jobId/:segmentIndex', (req, res) =>
{
  const { jobId, segmentIndex } = req.params;

  const job = jobs.get(jobId);

  if (!job)
  {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed')
  {
    return res.status(400).json({ error: 'Job not completed yet' });
  }

  const index = parseInt(segmentIndex, 10);

  if (isNaN(index) || index < 0 || index >= job.result.length)
  {
    return res.status(400).json({ error: 'Invalid segment index' });
  }

  const filePath = job.result[index].filePath;

  return res.download(filePath);
});

// Neuer Endpunkt: Video-Segment streamen (für Wiedergabe im Browser)
router.get('/stream/:jobId/:segmentIndex', (req, res) =>
{
  const { jobId, segmentIndex } = req.params;

  const job = jobs.get(jobId);

  if (!job)
  {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed')
  {
    return res.status(400).json({ error: 'Job not completed yet' });
  }

  const index = parseInt(segmentIndex, 10);

  if (isNaN(index) || index < 0 || index >= job.result.length)
  {
    return res.status(400).json({ error: 'Invalid segment index' });
  }

  const filePath = job.result[index].filePath;

  // Prüfen, ob die Datei existiert
  if (!fs.existsSync(filePath))
  {
    return res.status(404).json({ error: 'File not found' });
  }

  // Dateistatistiken abrufen
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Content-Type basierend auf der Dateiendung setzen
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.mp3' ? 'audio/mpeg' : 'video/mp4';

  // Range-Request für Streaming unterstützen
  if (range)
  {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });

    file.pipe(res);
  } else
  {
    // Wenn kein Range-Header, sende die ganze Datei
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType
    });

    fs.createReadStream(filePath).pipe(res);
  }
});

// Dokumentation abrufen
router.get('/documentation/:jobId', (req, res) =>
{
  const { jobId } = req.params;

  const job = jobs.get(jobId);

  if (!job)
  {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed')
  {
    return res.status(400).json({ error: 'Job not completed yet' });
  }

  if (!job.documentation)
  {
    return res.status(404).json({ error: 'Documentation not found' });
  }

  // Dokumentation als JSON zurückgeben
  return res.json(job.documentation);
});

module.exports = router;