# VideoBites

Ein Docker-basierter Dienst zum Extrahieren und Herunterladen bestimmter Zeitabschnitte aus YouTube-Videos mit benutzerfreundlicher Weboberfläche.

Die Anwendung ist besonders nützlich für:

- Journalisten und Forscher, die kurze Quellen oder Zitate benötigen.
- Content-Creator, die auf bestimmte Szenen verweisen möchten.
- Bildungseinrichtungen, die relevante Inhalte für Lehrzwecke extrahieren.
- Archivare und Analysten, die Videoausschnitte für Dokumentationen oder Studien speichern.

## Funktionen

- **Benutzerfreundliche Weboberfläche** - Einfache Bedienung ohne Programmierkenntnisse
- **Flexible Segmentauswahl** - Extrahiere beliebig viele Zeitabschnitte aus einem Video und füge sie optional zu einem Zusammenschnitt zusammen
- **Vorschau-Funktion** - Anzeige der extrahierten Segmente direkt im Browser
- **Qualitätsauswahl** - Wähle zwischen verschiedenen Videoqualitäten (144p bis 4K)
- **Audio-Modus** - Möglichkeit, nur den Audiokanal zu extrahieren
- **Download-Option** - Speichere die Ausschnitte auf deinem Gerät
- **Vollständige API** - Alle Funktionen sind auch programmatisch über die API zugänglich

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

3. Öffne die Weboberfläche in deinem Browser:

   ```
   http://localhost
   ```

## Bedienung der Weboberfläche

1. **Video auswählen**: Gib eine YouTube-URL ein und klicke auf "Prüfen".
2. **Qualität wählen**: Wähle die gewünschte Videoqualität aus dem Dropdown-Menü.
3. **Segmente definieren**: Füge beliebig viele Zeitabschnitte hinzu, indem du Start- und Endzeiten festlegst. Aktiviere die Option "Zusammenschnitt erstellen", um alle Segmente zu einer Datei zusammenzufügen.
4. **Extrahieren**: Klicke auf "Segmente extrahieren", um den Prozess zu starten.
5. **Vorschau & Download**: Wenn die Extraktion abgeschlossen ist, kannst du die Segmente ansehen und herunterladen.

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
  "quality": "720",
  "mergeSegments": true
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

## Architektur

VideoBites besteht aus zwei Hauptkomponenten:

1. **Backend**: Node.js-Server mit Express, der die API-Endpoints bereitstellt und die Videobearbeitung übernimmt.
2. **Frontend**: Benutzerfreundliche Weboberfläche, die von einem Nginx-Server bereitgestellt wird.

Beide Komponenten werden in Docker-Containern ausgeführt und über Docker Compose orchestriert.

## Systemanforderungen

- Docker und Docker Compose
- Internetverbindung für den Zugriff auf YouTube

## Eingesetzte Tools

VideoBites läuft in einem Docker-Container und verwendet folgende Systemwerkzeuge:

- **yt-dlp** – Zum Herunterladen und Verarbeiten von YouTube-Videos.
- **ffmpeg** – Zur Bearbeitung und Extraktion von Videoabschnitten.
- **nginx** – Bereitstellung der Weboberfläche und API-Proxy.

## Fehlerbehebung

- **Extraktionsfehler**: Stelle sicher, dass das Video nicht altersbeschränkt oder regional gesperrt ist.
- **Lange Ladezeiten**: Die Verarbeitung großer Videos oder vieler Segmente kann einige Zeit in Anspruch nehmen.

## Beitragen

Beiträge zum Projekt sind willkommen! Bitte erstelle einen Fork des Repositories und reiche Pull Requests ein.
