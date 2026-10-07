# FactoryAI - Shopfloor Management Panel

Dieses Projekt ist eine digitale Shopfloor-Maske zur Online-Erfassung von Maschinenstati, Kriterienübersichten (Ampelsystem) und zur Bündelung von Notizen für Gruppentreffen und Schichtübergaben.

## 🚀 Architektur & Struktur (Layer-System)
Das System ist so aufgebaut, dass Informationen über verschiedene Ebenen gebündelt werden können:
- **Gruppe** (Top-Level Produktionsübersicht)
- **Insel** (Zusammenfassung mehrerer Arbeitsplätze)
- **Maschine / Arbeitsplatz** (Detaillierte Matrixansicht)

## 🛠️ Tech-Stack
- **Frontend:** React
- **Backend:** Node.js / Express
- **Infrastruktur:** Docker & Docker Compose (für On-Premise Betriebs-Server)
- **Datenbank:** JSON-File Persistence (`shopfloor_storage.json`)

## 📁 Projektstruktur
- `backend/server.js` - Der Node.js Express Server (API-Endpunkte für Stati und Notizen)
- `backend/package.json` - Verwaltung der Node.js Abhängigkeiten
- `frontend/` - Quellcode des React-Frontends
- `Dockerfile` - Multi-Stage Konfiguration zum Bauen von Frontend & Backend
- `docker-compose.yml` - Orchestrierung für den Start auf dem lokalen Server

---

## 💻 Installation auf dem Firmenserver (On-Premise)

### Voraussetzungen
Auf dem Zielserver muss **Docker** und **Docker Compose** installiert sein.

### Schritt-für-Schritt-Installation

1. **Paket entpacken:**
   Kopiere die ZIP-Datei auf den Server und entpacke sie in ein beliebiges Verzeichnis (z. B. `/opt/factoryai`).
   ```bash
   cd /opt/factoryai
   ```

2. **Anwendung bauen und starten:**
   Führe den folgenden Befehl im Terminal aus, um das System lokal auf dem Server zu bauen und im Hintergrund zu starten:
   ```bash
   docker compose up -d --build
   ```

3. **Erreichbarkeit prüfen:**
   Die App ist nun im Firmennetzwerk unter der IP-Adresse des Servers erreichbar:
   `http://<SERVER-IP>:10000`

### 💾 Datensicherheit & Backup
Docker erstellt beim ersten Start automatisch eine Datei namens `shopfloor_storage.json` im Unterordner `./shopfloor_data/`. 
- Hierin liegt die gesamte Datenbanklogik (Maschinenstati, Notizen und Konfigurationen).
- Diese Datei überlebt jeden Container-Neustart und jedes Software-Update.
- **Backup:** Für die tägliche Datensicherung muss die IT lediglich den Ordner `./shopfloor_data/` sichern.

