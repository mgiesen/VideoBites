const express = require('express');
const router = express.Router();
const videoService = require('./videoService');
const { v4: uuidv4 } = require('uuid');

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
    const { url, segments, quality } = req.body;

    if (!url)
    {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!Array.isArray(segments) || segments.length === 0)
    {
      return res.status(400).json({ error: 'At least one segment is required' });
    }

    // Qualitätsparameter validieren
    const validQualityOptions = ["144", "240", "360", "480", "720", "1080", "1440", "2160", "audio"];
    const defaultQuality = "720";

    // Wenn keine Qualität angegeben oder nicht gültig, Standardwert verwenden
    const videoQuality = quality && validQualityOptions.includes(quality) ? quality : defaultQuality;

    // Job ID erstellen
    const jobId = uuidv4();

    // Job speichern
    jobs.set(jobId, {
      id: jobId,
      url,
      segments,
      quality: videoQuality,
      status: 'pending',
      result: null,
      error: null,
      createdAt: new Date()
    });

    // Verarbeitung im Hintergrund starten
    videoService.processVideo(url, segments, videoQuality)
      .then(result =>
      {
        const job = jobs.get(jobId);
        if (job)
        {
          job.status = 'completed';
          job.result = result;
          job.completedAt = new Date();
          jobs.set(jobId, job);
        }
      })
      .catch(error =>
      {
        const job = jobs.get(jobId);
        if (job)
        {
          job.status = 'failed';
          job.error = error.message;
          jobs.set(jobId, job);
        }
      });

    return res.status(202).json({ jobId, status: 'pending' });
  } catch (error)
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

module.exports = router;