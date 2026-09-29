# === SCHRITT 1: Frontend bauen ===
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# === SCHRITT 2: Backend & Gesamtsystem vorbereiten ===
FROM node:18-alpine
WORKDIR /app

# Backend-Abhängigkeiten installieren
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Server-Code kopieren
COPY backend/ ./backend/

# Das gebaute Frontend aus Schritt 1 genau an den Pfad kopieren, den der Server sucht!
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Startbefehl für Render (Wechselt ins Backend und startet den Node-Server)
WORKDIR /app/backend
EXPOSE 10000
CMD ["npm", "start"]
