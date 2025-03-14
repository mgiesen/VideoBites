# VideoBites

Ein Docker-basierter Dienst zum Extrahieren und Herunterladen bestimmter Zeitabschnitte aus YouTube-Videos mit benutzerfreundlicher Weboberfläche.

Die Anwendung ist besonders nützlich für:

- Journalisten und Forscher, die kurze Quellen oder Zitate benötigen.
- Content-Creator, die auf bestimmte Szenen verweisen möchten.
- Bildungseinrichtungen, die relevante Inhalte für Lehrzwecke extrahieren.
- Archivare und Analysten, die Videoausschnitte für Dokumentationen oder Studien speichern.

## Funktionen

- **Benutzerfreundliche Weboberfläche** - Einfache Bedienung über Webbrowser
- **Flexible Segmentauswahl** - Extrahiere beliebig viele Zeitabschnitte aus einem Video und füge sie optional ganz ohne Videoschnittprogramm zusammen
- **Vorschau-Funktion** - Anzeige der extrahierten Segmente direkt im Browser
- **Formatauswahl** - Wähle zwischen Audio und Video sowie verschiedenen Videoqualitäten (144p bis 4K)
- **Quellendokumentation** - Erstellt automatisch eine JSON-Datei mit umfassenden Metadaten und Segmentinformationen

## Rechtliche Hinweise

Die Nutzung von `VideoBites` muss im Einklang mit den Urheber- und Nutzungsrechten von YouTube und anderen Plattformen stehen. Die Verantwortung für die rechtmäßige Nutzung liegt beim Nutzer.

## Installation

Es gibt zwei Möglichkeiten, VideoBites zu installieren:

### Option 1: Vorgefertigtes Docker-Image verwenden (empfohlen)

1. Image von GitHub Container Registry herunterladen:

   ```bash
   docker pull ghcr.io/mgiesen/videobites:latest
   ```

2. Docker-Container starten:

   ```bash
   docker run -d --name videobites -p 80:3000 -v videobites_data:/app/data -e DOWNLOAD_DIR=/app/data ghcr.io/mgiesen/videobites:latest
   ```

3. Öffne die Weboberfläche in deinem Browser:
   ```
   http://localhost
   ```

### Option 2: Container lokal bauen

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
1. **Segmente definieren**: Füge beliebig viele Zeitabschnitte/Segmente hinzu, und definiere die gewünschten Start- und Endzeiten.
1. **Extrahieren**: Klicke auf "Segmente extrahieren", um den Prozess zu starten.
1. **Vorschau & Download**: Wenn die Extraktion abgeschlossen ist, kannst du die Segmente ansehen und herunterladen.

## Quellendokumentation

Die Quellendokumentation ist eine vollständige Nachverfolgung der extrahierten Inhalte:

- Enthält umfassende Video-Metadaten (Titel, Kanal, Beschreibung, Tags, Kategorien, Sprache)
- Speichert genaue Zeitmarken und Dateinamen aller Segmente
- Erleichtert korrekte Quellenangaben und Zitationen
- Wird als JSON-Datei bereitgestellt
