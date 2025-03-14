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
- **Quellendokumentation** - Erstelle automatisch eine JSON-Datei mit umfassenden Metadaten und Segmentinformationen
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
3. **Optionen aktivieren**: Optional "Zusammenschnitt erstellen" und/oder "Quellendokumentation erstellen" aktivieren.
4. **Segmente definieren**: Füge beliebig viele Zeitabschnitte hinzu, indem du Start- und Endzeiten festlegst.
5. **Extrahieren**: Klicke auf "Segmente extrahieren", um den Prozess zu starten.
6. **Vorschau & Download**: Wenn die Extraktion abgeschlossen ist, kannst du die Segmente ansehen und herunterladen. Bei aktivierter Quellendokumentation steht diese ebenfalls zum Download bereit.

## Quellendokumentation

Die Quellendokumentation ermöglicht eine vollständige Nachverfolgung der extrahierten Inhalte:

- Enthält umfassende Video-Metadaten (Titel, Kanal, Beschreibung, Tags, Kategorien, Sprache)
- Speichert genaue Zeitmarken und Dateinamen aller Segmente
- Erleichtert korrekte Quellenangaben und Zitationen
- Wird als JSON-Datei bereitgestellt

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
  "mergeSegments": true,
  "createDocumentation": true
}
```

### 4. Dokumentation abrufen

Liefert die generierte Quellendokumentation für einen abgeschlossenen Job.

**Request**

```http
GET http://localhost:3000/api/documentation/{jobId}
```
