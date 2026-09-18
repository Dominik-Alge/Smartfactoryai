# 1. Nutzen der stabilen und schlanken Node.js Umgebung
FROM node:18-alpine

# 2. Arbeitsverzeichnis im Container erstellen und festlegen
WORKDIR /app

# 3. Kopiere die package.json aus dem backend-Ordner in den Container
COPY backend/package*.json ./

# 4. Installiere die im backend definierten Abhängigkeiten (express, cors)
RUN npm install

# 5. Kopiere den gesamten Inhalt des backend-Ordners in den Container
COPY backend/ .

# 6. Öffne den Port 10000, den Render standardmäßig nutzt
EXPOSE 10000

# 7. Startbefehl für den Server (führt "node server.js" aus)
CMD ["npm", "start"]
