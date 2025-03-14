FROM node:18-alpine

# Systemabhängigkeiten installieren
RUN apk add --no-cache python3 py3-pip ffmpeg

# yt-dlp als Systempaket installieren, nicht mit pip
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing yt-dlp

# Arbeitsverzeichnis setzen
WORKDIR /app

# Package-Dateien kopieren
COPY backend/package*.json ./

# Node-Abhängigkeiten installieren
RUN npm install

# Backend-Code kopieren
COPY backend/src ./src

# Frontend-Code kopieren
COPY frontend ./public

# Verzeichnis für heruntergeladene Videos erstellen
RUN mkdir -p data

# Port öffnen
EXPOSE 3000

# Anwendung starten
CMD ["npm", "start"]