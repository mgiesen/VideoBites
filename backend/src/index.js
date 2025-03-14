const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

// Express-App initialisieren
const app = express();
const PORT = 3000;

// CORS-Konfiguration
const corsOptions = {
  origin: '*', // In production, replace with your specific domains
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions));

// Static files für Frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Static files für heruntergeladene Videos
app.use('/data', express.static(process.env.DOWNLOAD_DIR || '/app/data'));

// API-Routen einbinden
app.use('/api', routes);

// Health Check
app.get('/health', (req, res) =>
{
  res.status(200).json({ status: 'ok' });
});

// Catch-all Route für das Frontend (Single-Page-Application Support)
app.get('*', (req, res) =>
{
  // Prüfen, ob es eine API-Route ist
  if (!req.path.startsWith('/api/'))
  {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// Error-Handler
app.use((err, req, res, next) =>
{
  console.error(err.stack);
  res.status(500).json({
    error: {
      message: err.message || 'Something went wrong!'
    }
  });
});

// Server starten
app.listen(PORT, () =>
{
  console.log(`Server läuft auf Port ${PORT}`);
  console.log('Frontend verfügbar unter http://localhost:3000');
  console.log('Verfügbare API-Endpunkte:');
  console.log('- POST /api/validate - URL validieren');
  console.log('- POST /api/info - Video-Info abrufen');
  console.log('- POST /api/extract - Video-Segmente extrahieren');
  console.log('- GET /api/status/:jobId - Job-Status abfragen');
  console.log('- GET /api/download/:jobId/:segmentIndex - Video-Segment herunterladen');
  console.log('- GET /api/stream/:jobId/:segmentIndex - Video-Segment streamen');
});