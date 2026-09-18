# FactoryAI - Shopfloor Management Panel

Dieses Projekt ist eine digitale Shopfloor-Maske zur Online-Erfassung von Maschinenstati, Kriterienübersichten (Ampelsystem) und zur Bündelung von Notizen für Gruppentreffen und Schichtübergaben.

## 🚀 Architektur & Struktur (Layer-System)
Das System ist so aufgebaut, dass Informationen über verschiedene Ebenen gebündelt werden können:
- **Gruppe** (Top-Level Produktionsübersicht)
- **Insel** (Zusammenfassung mehrerer Arbeitsplätze)
- **Maschine / Arbeitsplatz** (Detaillierte Matrixansicht)

## 🛠️ Tech-Stack
- **Frontend:** React (geplant)
- **Backend:** Node.js / Express
- **Infrastruktur:** Docker & Render (Hosting in Frankfurt, EU-Central)
- **Datenbank:** PostgreSQL (geplant für Notizen und Historie)

## 📁 Projektstruktur
- `server.js` - Der Node.js Express Server (API-Endpunkte für Stati und Notizen)
- `package.json` - Verwaltung der Node.js Abhängigkeiten
- `Dockerfile` - Konfiguration für das automatische Deployment auf Render

## ⚙️ Lokale Entwicklung (GitHub Codespace)
Um den Server im Codespace testweise zu starten, führe folgende Befehle im Terminal aus:
1. `npm install` (Abhängigkeiten installieren)
2. `node server.js` (Server starten)

## 🌐 Deployment
Änderungen am `main`-Branch werden über GitHub Webhooks automatisch direkt auf Render live geschaltet.
