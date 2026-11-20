SMARTFACTORYAI – WINDOWS SERVER DEPLOYMENT


PROJEKT
Shopfloor Management Panel (Shopfloor-Maske)

Die Anwendung dient zur digitalen Erfassung von Maschinenstati, Kriterienübersichten (Ampelsystem), Schichtübergaben sowie zur Verwaltung von Shopfloor- und Verbesserungsmassnahmen.

═══════════════════════════════════════════════════
1. SYSTEMAUFBAU
═══════════════════════════════════════════════════

Die Anwendung ist hierarchisch aufgebaut:

GRUPPE
→ Produktionsübersicht einer gesamten Gruppe

INSEL
→ Zusammenfassung mehrerer Arbeitsplätze

MASCHINE
→ Detailansicht eines einzelnen Arbeitsplatzes

═══════════════════════════════════════════════════
2. TECHNISCHE ARCHITEKTUR
═══════════════════════════════════════════════════

Frontend:
- React
- Vite (Build-System)

Backend:
- Node.js
- Express

Datenspeicherung:
- JSON-Datei (shopfloor_storage.json)

Betriebsmodell:
- On-Premise auf Windows Server
- Kein Docker erforderlich

Hinweis:
Das React-Frontend wird einmalig mittels Vite kompiliert (Build) und anschliessend direkt durch den Express-Server bereitgestellt. 
Im Produktivbetrieb wird ausschliesslich der Node.js-Server ausgeführt.

═══════════════════════════════════════════════════
3. PROJEKTSTRUKTUR
═══════════════════════════════════════════════════

Smartfactoryai
│
├── starten.bat
├── README.md
│
├── backend
│   ├── server.js
│   ├── package.json
│   └── shopfloor_data
│       └── shopfloor_storage.json
│
└── frontend
    ├── dist
    ├── src
    ├── package.json
    └── vite.config.js

Beschreibung: 
starten.bat → Startet die Anwendung unter Windows 
backend/server.js → Node.js-Server für API und Frontend-Auslieferung 
backend/package.json → Backend-Abhängigkeiten 
frontend/package.json → Frontend-Abhängigkeiten 
backend/shopfloor_data → Persistente Datenspeicherung und Backup-Ordner 
backend/shopfloor_data/shopfloor_storage.json → Persistente Anwendungsdaten 
frontend/dist → Kompilierte Produktionsversion des Frontends

═══════════════════════════════════════════════════
4. INSTALLATION AUF DEM WINDOWS SERVER
═══════════════════════════════════════════════════

Voraussetzungen:

- Windows Server
- Node.js LTS Version

Schritt 1: Projekt bereitstellen

Die Anwendung kann in einem beliebigen Verzeichnis auf dem Zielsystem abgelegt werden.

Beispiel:

<Installationsverzeichnis>\Smartfactoryai

Schritt 2: Backend-Abhängigkeiten installieren

cd <Installationsverzeichnis>\Smartfactoryai\backend

npm install

Schritt 3: Frontend-Abhängigkeiten installieren und Build erstellen

cd <Installationsverzeichnis>\Smartfactoryai\frontend

npm install

npm run build

Hinweis:

Der Build erzeugt den Ordner:

frontend\dist

Dieser wird anschliessend automatisch durch das Backend ausgeliefert.

Schritt 4: Anwendung starten

cd <Installationsverzeichnis>\Smartfactoryai\backend

node server.js

Alternativ:

Doppelklick auf starten.bat
═══════════════════════════════════════════════════
5. ZUGRIFF AUF DIE ANWENDUNG
═══════════════════════════════════════════════════

Nach erfolgreichem Start ist die Anwendung erreichbar unter:

http://<SERVER-IP>:5000

Firewall-Anforderung:

Der TCP-Port 5000 muss für eingehende Verbindungen freigegeben sein.

═══════════════════════════════════════════════════
6. BETRIEB ALS WINDOWS-DIENST
═══════════════════════════════════════════════════

Für einen produktiven Betrieb kann die Anwendung als Windows-Dienst eingerichtet werden, sodass sie nach einem Serverneustart automatisch gestartet wird.

Die konkrete Umsetzung (Windows-Dienst, Task Scheduler oder alternative Betriebsform) erfolgt in Abstimmung mit der IT und entsprechend den geltenden Betriebsstandards.

Produktiver Startbefehl:

cd <Installationsverzeichnis>\Smartfactoryai\backend
node server.js

═══════════════════════════════════════════════════
7. DATENSICHERUNG
═══════════════════════════════════════════════════

Alle Betriebsdaten werden in folgendem Verzeichnis gespeichert:

<Installationsverzeichnis>\Smartfactoryai\backend\shopfloor_data

Datei:

shopfloor_storage.json

Empfehlung:

Das Verzeichnis

<Installationsverzeichnis>\Smartfactoryai\backend\shopfloor_data

soll in die bestehende Backup-Lösung (z.B. Veeam) aufgenommen werden.

═══════════════════════════════════════════════════
8. WARTUNG
═══════════════════════════════════════════════════

Frontend-Änderungen:

cd <Installationsverzeichnis>\Smartfactoryai\frontend

npm run build

Backend-Neustart:

cd <Installationsverzeichnis>\Smartfactoryai\backend

node server.js

Hinweis:

Die aktuelle Datenhaltung basiert bewusst auf einer JSON-Datei und wurde für die Pilotphase möglichst einfach gehalten.

Im Normalbetrieb sind keine manuellen Eingriffe an der Datenstruktur erforderlich.

═══════════════════════════════════════════════════
STATUS
═══════════════════════════════════════════════════

Die Anwendung wurde erfolgreich in einer Windows-Umgebung installiert, gebaut und betrieben.

Folgende Funktionen konnten erfolgreich getestet werden:

- Frontend-Build mittels Vite
- Start des Node.js / Express Servers
- Auslieferung des Frontends über Express
- Persistente Datenspeicherung über shopfloor_storage.json
- Lokaler Zugriff über HTTP (Port 5000)
- Betrieb ohne Docker-Container

Aktuelle technische Kennzahlen der Testumgebung:

- Installationsgrösse der Anwendung: ca. 63 MB
- Frontend-Build (dist): ca. 177 KB
- Arbeitsspeicherbedarf des Node.js-Prozesses: ca. 15 MB
- Aktuelle Datendatei: ca. 2 KB
