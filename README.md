# FactoryAI Shopfloor Panel

Digitales Shopfloor Management für die Fertigung: Ampelstatus je Maschine und
Kriterium, automatische Störungstickets, Eskalation nach Arbeitszeit und eine
Lernschleife nach PDCA. Entwickelt von Dominik Alge.

## Inhalt

1. [Funktionen](#1-funktionen)
2. [Aufbau](#2-aufbau)
3. [Installation auf dem Windows-Server](#3-installation-auf-dem-windows-server)
4. [Update auf eine neue Version](#4-update-auf-eine-neue-version)
5. [Einstellungen](#5-einstellungen)
6. [Datensicherung](#6-datensicherung)
7. [Entwicklung und Tests](#7-entwicklung-und-tests)
8. [Vorführumgebung auf Render](#8-vorführumgebung-auf-render)

---

## 1. Funktionen

| Bereich | Zweck |
|---|---|
| **Shopfloor Panel** | Ampelmatrix je Gruppe (Maschinen × Kriterien). Eine rote Zelle erzeugt automatisch ein Ticket und eine Mail an den zuständigen Bereich. |
| **Shopfloor Cockpit (TV)** | Übersicht für Bildschirm und Besprechung: Ansichten Betrieb, Steuerung und Prävention mit Kennzahlen, Risiken, Frühwarnung. |
| **Action Engine (Ebene 2)** | Bearbeitung der Tickets nach 0 · P · D · C · A, Eskalation nach Arbeitszeit, Historie & Auswertung. Details: [ACTION_ENGINE.md](ACTION_ENGINE.md) |

### Action Engine in Kürze

- **Ablauf:** 0 Sofortmassnahme → P Ursache (5× Warum) → D Abstellmassnahme →
  C Wirksamkeit → A Standard / Lessons Learned. Ist eine Massnahme nicht
  wirksam, geht das Ticket zurück zur Ursache.
- **Eskalation:** Mitarbeiter → Gruppenleiter (2 h) → Inselleiter (6 h) →
  Produktionsleiter (2 Arbeitstage) → Geschäftsleitung (5 Arbeitstage).
  Gezählt wird Arbeitszeit im Schichtfenster der Maschine, ohne Wochenende,
  Thurgauer Feiertage und Betriebsferien. Das System **schlägt nur vor**,
  jede Entscheidung braucht eine Begründung.
- **Historie & Auswertung:** Filter nach Zeitraum, Gruppe, Maschine, Kriterium,
  Status, Stufe, Wirksamkeit und Volltext; Kennzahlen, Wiederholer und
  CSV-Export für Excel.

## 2. Aufbau

```
Smartfactoryai
├── starten.bat              Startet den Server unter Windows
├── update_windows.bat       Update ohne Datenverlust (siehe Abschnitt 4)
├── ACTION_ENGINE.md         Beschreibung der Action Engine
├── backend
│   ├── server.js            Start, Gruppen-/Panel-Routen, Auslieferung Frontend
│   ├── routes/tickets.js    Action-Engine-API
│   ├── services/            Speicher, Ticket-Modell, Eskalation, Kalender, Mail
│   ├── config/              Einstellungen für den Betrieb (Abschnitt 5)
│   ├── demo/                Beispieldaten für Vorführungen
│   ├── tests/               Automatische Tests
│   ├── .env                 Zugangsdaten (nur auf dem Server, nie im Repository)
│   └── shopfloor_data/      BETRIEBSDATEN – nie löschen, nie überschreiben
│       └── shopfloor_storage.json
└── frontend
    ├── src/                 React-Oberfläche
    │   ├── components/      Panel, Cockpit, Dialoge
    │   └── action-engine/   Action Engine
    └── dist/                Fertig gebautes Frontend (wird erzeugt)
```

Technik: Node.js mit Express (Backend), React mit Vite (Frontend),
Datenhaltung in einer JSON-Datei. Kein Docker nötig.

## 3. Installation auf dem Windows-Server

Voraussetzung: Node.js LTS (Version 20 oder neuer).

```bat
cd C:\Smartfactoryai\backend
npm install --omit=dev

cd C:\Smartfactoryai\frontend
npm install
npm run build
```

Zugangsdaten anlegen: `backend\.env.example` nach `backend\.env` kopieren und
ausfüllen (Abschnitt 5).

Starten: Doppelklick auf `starten.bat`. Die Anwendung ist danach erreichbar
unter `http://<SERVER-IP>:5000`. Der TCP-Port 5000 muss in der Firewall
freigegeben sein.

Für den Dauerbetrieb (Start nach Serverneustart) richtet die IT einen
Windows-Dienst oder eine geplante Aufgabe mit dem Befehl `node server.js` im
Ordner `backend` ein.

## 4. Update auf eine neue Version

Die Betriebsdaten liegen in `backend\shopfloor_data` und gehören nicht zum
Code. Das Update ersetzt nur den Code.

1. Auf GitHub unter **Code → Download ZIP** die neue Version herunterladen
   und in einen **eigenen Ordner** entpacken, z. B. `C:\Update\Smartfactoryai-main`.
   Nicht direkt nach `C:\Smartfactoryai` entpacken.
2. Server beenden (Fenster von `starten.bat` schliessen).
3. Im entpackten Ordner `update_windows.bat` doppelklicken. Das Skript
   - sichert die ganze Installation inklusive Daten nach
     `C:\Smartfactoryai_Backup\<Datum_Zeit>\code`,
   - kopiert den neuen Code nach `C:\Smartfactoryai`, ohne
     `backend\shopfloor_data` und `backend\.env` anzufassen,
   - installiert die Pakete und baut das Frontend.
4. Server mit `starten.bat` wieder starten.
5. Prüfen: Panel öffnen, Action Engine öffnen, bestehende Tickets sichtbar?

Beim ersten Start nach einem Update auf ein neues Datenformat legt der Server
zusätzlich selbst eine Kopie an:
`backend\shopfloor_data\shopfloor_storage.backup-v1-<Zeit>.json`.

**Zurück zur alten Version:** Server beenden, den Inhalt von
`C:\Smartfactoryai_Backup\<Datum_Zeit>\code` nach `C:\Smartfactoryai` kopieren,
dann im Ordner `frontend` `npm install` und `npm run build` ausführen und neu
starten. Den Ordner `backend\shopfloor_data` dabei **nur** mitkopieren, wenn
auch die Daten auf den Stand vor dem Update zurück sollen – sonst gehen alle
seither erfassten Einträge verloren.

## 5. Einstellungen

| Was | Wo |
|---|---|
| Mailserver, Empfänger je Eskalationsstufe | `backend\.env` (Vorlage: `backend\.env.example`) |
| Eskalationsstufen und Zeitschwellen | `backend\config\escalation.js` |
| Schichtzeiten, Feiertage, **Betriebsferien** | `backend\config\calendar.js` |
| Phasen, Liste «Verantwortlich» | `backend\config\actionFlow.js` |
| Mail-Empfänger bei ROT je Kriterium | `backend\config\notifications.js` |
| Ein- oder Zweischicht je Maschine | Action Engine → «Kalender & Stufen» |
| PIN für geschützte Bereiche | `frontend\src\components\PinModal.jsx` |

Nach einer Änderung im Ordner `config` den Server neu starten. Nach einer
Änderung im Ordner `frontend` zusätzlich `npm run build` ausführen.

**Wichtig:** Ohne `SMTP_HOST` in `backend\.env` verschickt der Server keine Mails.

## 6. Datensicherung

Alle Betriebsdaten liegen in einer Datei:

```
C:\Smartfactoryai\backend\shopfloor_data\shopfloor_storage.json
```

Den Ordner `backend\shopfloor_data` in die bestehende Backup-Lösung (z. B. Veeam)
aufnehmen. Der Server schreibt die Datei so, dass ein Absturz während des
Speicherns sie nicht beschädigt.

## 7. Entwicklung und Tests

```bash
# Backend mit Beispieldaten starten (Port 5000)
cd backend
npm install
DEMO_DATA=true node server.js        # Windows: set DEMO_DATA=true && node server.js

# Frontend im Entwicklungsmodus (Port 5173, greift auf Port 5000 zu)
cd frontend
npm install
npm run dev

# Tests (Schichtkalender, Eskalation, Phasen, alte Daten)
cd backend
npm test
```

Änderungen laufen über einen eigenen Branch und einen Pull Request auf `main`.

## 8. Vorführumgebung auf Render

Der Dienst `shopfloor-panel-Update` baut automatisch jeden Stand von `main`.
Mit `DEMO_DATA=true` legt er Beispieltickets an. Render speichert keine Daten:
Nach jedem Neustart beginnt die Vorführung wieder mit den Beispieldaten.
