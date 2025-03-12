# VideoBites

Ein Docker-basierter API-Dienst zum Extrahieren und Herunterladen bestimmter Zeitabschnitte aus YouTube-Videos.

Die Anwendung ist besonders nützlich für:

- Journalisten und Forscher, die kurze Quellen oder Zitate benötigen.
- Content-Creator, die auf bestimmte Szenen verweisen möchten.
- Bildungseinrichtungen, die relevante Inhalte für Lehrzwecke extrahieren.
- Archivare und Analysten, die Videoausschnitte für Dokumentationen oder Studien speichern.

## Rechtliche Hinweise

Die Nutzung von VideoBites muss im Einklang mit den Urheber- und Nutzungsrechten von YouTube und anderen Plattformen stehen. Das Herunterladen ist nur erlaubt, wenn der Rechteinhaber es gestattet oder eine entsprechende Lizenz vorliegt. Die Verantwortung für die rechtmäßige Nutzung liegt beim Nutzer.

## Installation

1. Repository klonen:

   ```bash
   git clone https://github.com/mgiesen/VideoBites.git
   cd VideoBites
   ```

2. Docker-Container starten:

   ```bash
   docker-compose up -d
   ```

## API Dokumentation

Die VideoBites API kann mit jedem HTTP-Client (z.B. curl, Postman, Thunder Client, etc.) getestet werden. Hier sind Beispiele für alle unterstützten Endpunkte:

### 1. URL validieren

Prüft, ob eine YouTube-URL gültig ist und das Video verfügbar ist.

**Request**

```http
POST http://localhost:3000/api/validate
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response**

```json
{
	"valid": true
}
```

### 2. Video-Informationen abrufen

Ruft Metadaten über das Video ab.

**Request**

```http
POST http://localhost:3000/api/info
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response**

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
  "duration": 212,
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "uploader": "Rick Astley",
  "upload_date": "20091025",
  "view_count": 1234567890,
  ...
}
```

### 3. Video-Segmente extrahieren

Lädt ein Video herunter und extrahiert die angegebenen Zeitabschnitte.

**Request**

```http
POST http://localhost:3000/api/extract
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "segments": [
    { "start": 10, "end": 20 },
    { "start": 30, "end": 40 }
  ],
  "quality": "720"
}
```

**Unterstützte Qualitätsoptionen:**

- "144" - 144p
- "240" - 240p
- "360" - 360p
- "480" - 480p
- "720" - 720p (Standard)
- "1080" - 1080p (Full HD)
- "1440" - 1440p (2K)
- "2160" - 2160p (4K)
- "audio" - Nur Audio

**Response**

```json
{
	"jobId": "9a8e7c6e-6ab3-407d-85da-c173debcf786",
	"status": "pending"
}
```

### 4. Job-Status abfragen

Prüft den Status eines Extraktions-Jobs.

**Request**

```http
GET http://localhost:3000/api/status/9a8e7c6e-6ab3-407d-85da-c173debcf786
```

**Response während Bearbeitung**

```json
{
	"id": "9a8e7c6e-6ab3-407d-85da-c173debcf786",
	"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	"segments": [
		{ "start": 10, "end": 20 },
		{ "start": 30, "end": 40 }
	],
	"status": "pending",
	"result": null,
	"error": null,
	"createdAt": "2025-03-12T08:04:01.715Z"
}
```

**Response nach Abschluss**

```json
{
	"id": "9a8e7c6e-6ab3-407d-85da-c173debcf786",
	"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	"segments": [
		{ "start": 10, "end": 20 },
		{ "start": 30, "end": 40 }
	],
	"status": "completed",
	"result": [
		{
			"segment": { "start": 10, "end": 20 },
			"filePath": "/app/data/cc1f55d1-5589-4be7-be87-ef3980429e6e_segment_0.mp4"
		},
		{
			"segment": { "start": 30, "end": 40 },
			"filePath": "/app/data/cc1f55d1-5589-4be7-be87-ef3980429e6e_segment_1.mp4"
		}
	],
	"error": null,
	"createdAt": "2025-03-12T08:04:01.715Z",
	"completedAt": "2025-03-12T08:04:13.333Z"
}
```

### 5. Video-Segment herunterladen

Lädt ein extrahiertes Video-Segment herunter.

**Request**

```http
GET http://localhost:3000/api/download/9a8e7c6e-6ab3-407d-85da-c173debcf786/0
```

**Response**
Der Server sendet die Video-Datei als Download.

## Externe Abhängigkeiten

- Docker und Docker Compose

## Eingesetzte Tools

VideoBites läuft in einem Docker-Container und verwendet folgende Systemwerkzeuge:

- **yt-dlp** – Zum Herunterladen und Verarbeiten von YouTube-Videos.
- **ffmpeg** – Zur Bearbeitung und Extraktion von Videoabschnitten.
