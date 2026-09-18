# === SCHRITT 1: Frontend bauen ===
FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# === SCHRITT 2: Backend vorbereiten & alles zusammenführen ===
FROM node:18-alpine
WORKDIR /app

# Backend-Abhängigkeiten installieren
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./

# Das fertig gebaute Frontend aus Schritt 1 in das Backend kopieren
COPY --from=frontend-builder /frontend/dist ./public

EXPOSE 10000
CMD ["npm", "start"]
