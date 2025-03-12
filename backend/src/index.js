const express = require('express');
const cors = require('cors');
const routes = require('./routes');

// Express-App initialisieren
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Routen einbinden
app.use('/api', routes);

// Health Check
app.get('/health', (req, res) =>
{
  res.status(200).json({ status: 'ok' });
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
  console.log('Verfügbare API-Endpunkte:');
  console.log('- POST /api/validate - URL validieren');
  console.log('- POST /api/info - Video-Info abrufen');
  console.log('- POST /api/extract - Video-Segmente extrahieren');
  console.log('- GET /api/status/:jobId - Job-Status abfragen');
  console.log('- GET /api/download/:jobId/:segmentIndex - Video-Segment herunterladen');
});
