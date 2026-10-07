// =========================================================================
// DIAGNOSE-TOOL (Fängt versteckte Startfehler im Docker-Container ab)
// =========================================================================
process.on('uncaughtException', (err) => {
  console.error('🔥 KRITISCHER STARTFEHLER:', err.message);
  console.error(err.stack);
  process.exit(1);
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import nodemailer from 'nodemailer';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Binde deine bestehenden Services aus dem Ordner ein
import {
  generateActionId,
  createActionObject
} from './services/actionService.js';

const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// =========================================================================
// PERSISTENTE DATEI-ABLAGE (Erstellt den sicheren Docker-Ordner)
// =========================================================================
const DATA_DIR = path.join(__dirname, 'shopfloor_data');
const STORAGE_FILE = path.join(DATA_DIR, 'shopfloor_storage.json');

// Automatischer Schutz: Falls der Ordner beim allerersten Start fehlt, erstellen
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultData = {
  "drehen": {
    name: "Gruppe Drehen",
    machines: ["12766", "12768", "12769", "12774"],
    criteria: ["Maschine", "Qualität", "Material", "AVOR", "Personal", "Systemfehler/Shopfloor", "Werkzeug", "Neuteil 0%", "Programme", "Messen (anmelden)", "Vorrichtung", "Messmittel"],
    cells: {},
    historyLog: []
  },
  "schleifen": {
    name: "Gruppe Schleifen",
    machines: ["13402", "13404", "13503", "13507", "13509", "13510", "13602", "13704", "13750"],
    criteria: ["Maschine", "Qualität", "Material", "AVOR", "DISPO", "Personal", "Messmittel", "Messen (anmelden)", "Vorrichtung"],
    cells: {},
    historyLog: []
  },
  "_system": { "nextActionId": 1 },
  "_actions": {}
};

let memoryCache = null;

function getPanelKeys(data) {
  return Object.keys(data).filter(key => key !== '_system' && key !== '_actions');
}

function cleanOldHistory(panel) {
  if (!panel || !panel.historyLog) return;
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  panel.historyLog = panel.historyLog.filter(log => log.timestampMs > twentyFourHoursAgo);
}

function loadData() {
  if (memoryCache) return memoryCache;
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(defaultData, null, 2));
      memoryCache = defaultData;
      return defaultData;
    }
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    const data = JSON.parse(raw);

    if (!data._system) data._system = { nextActionId: 1 };
    if (!data._actions) data._actions = {};

    getPanelKeys(data).forEach(key => {
      cleanOldHistory(data[key]);
    });

    memoryCache = data;
    return data;
  } catch (err) {
    console.error("Fehler beim Laden, RAM-Fallback genutzt:", err);
    return memoryCache || defaultData;
  }
}

function saveData(data) {
  memoryCache = data;
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Schreibfehler auf Festplatte:", err);
  }
}

const criterionContacts = {
  "Maschine": { email: "dominik.alge@bruderer.com", label: "Technische Instandhaltung" },
  "AVOR": { email: "dominik.alge@bruderer.com", label: "Arbeitsvorbereitung" },
  "DISPO": { email: "dominik.alge@bruderer.com", label: "Materialdisposition" },
  "Qualität": { email: "dominik.alge@bruderer.com", label: "Qualitätssicherung" },
  "Material": { email: "dominik.alge@bruderer.com", label: "Logistik & Lager" },
  "Werkzeug": { email: "dominik.alge@bruderer.com", label: "Werkzeugbau" }
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '://bruderer.com', 
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'shopfloor-alert@bruderer.com',
    pass: process.env.SMTP_PASS || 'DeinSicheresPasswort'
  }
});

const sendStatusAlert = async (machineId, criterion, note, author) => {
  const contact = criterionContacts[criterion];
  if (!contact || !contact.email) return;

  const mailOptions = {
    from: `"FactoryAI Alert" <${process.env.SMTP_USER || 'shopfloor-alert@bruderer.com'}>`,
    to: contact.email,
    subject: `⚠️ ALARM: Status ROT bei Spalte ${machineId} (${criterion})`,
    html: `<div style="font-family:Arial; border:2px solid #ef4444; padding:20px; border-radius:8px;">
            <h2 style="color:#ef4444;">⚠️ Shopfloor Alert</h2>
            <p><strong>Bereich:</strong> ${criterion} (${contact.label})<br>
            <strong>Maschine:</strong> ${machineId}<br>
            <strong>Gemeldet von:</strong> ${author || 'Terminal'}</p>
            <p style="background:#fef2f2; padding:10px; border-left:4px solid #ef4444;"><em>"${note || 'Keine Beschreibung'}"</em></p>
           </div>`
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('E-Mail-Fehler:', error);
  }
};

// --- BASE SHOPFLOOR API ---
app.get('/api/panels', (req, res) => {
  const data = loadData();
  const list = getPanelKeys(data).map(key => ({ id: key, name: data[key].name }));
  list.unshift({ id: 'insel_ds', name: '👁️ Insel-Sicht DS (Vorgesetzte)' });
  res.json(list);
});

app.get('/api/panel/:id', (req, res) => {
  const data = loadData();

  if (req.params.id === 'insel_ds') {
    const aggregatedCells = {};
    getPanelKeys(data).forEach((panelKey) => {
      const panel = data[panelKey];
      if (panel && panel.cells) {
        Object.keys(panel.cells).forEach((cellKey) => {
          if (panel.cells[cellKey]?.status === 'red') {
            aggregatedCells[cellKey] = panel.cells[cellKey];
          }
        });
      }
    });

    return res.json({
      name: 'Insel-Sicht DS',
      machines: [],
      criteria: [],
      cells: aggregatedCells,
      historyLog: []
    });
  }
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });
  
  if (!panel.historyLog) {
    panel.historyLog = [];
  }
  
  // 🎯 DATEN-ÖFFNUNG: Sendet das Objekt vollständig inklusive historyLog an das Board
  res.json({
    name: panel.name || '',
    machines: panel.machines || [],
    criteria: panel.criteria || [],
    cells: panel.cells || {},
    historyLog: panel.historyLog 
  });

});

app.post('/api/panel', (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ error: "id und name erforderlich" });
  
  const data = loadData();
  if (data[id]) return res.status(400).json({ error: "ID existiert bereits" });

  data[id] = { name, machines: [], criteria: [], cells: {}, historyLog: [] };
  saveData(data);
  res.json({ success: true, panels: data });
});

app.post('/api/panel/:id/structure', (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });

  const { action, type, value } = req.body;
  const timeString = new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });

  if (type === 'machine') {
    if (action === 'add' && !panel.machines.includes(value)) panel.machines.push(value);
    if (action === 'delete') {
      panel.criteria.forEach(crit => {
        if (panel.cells[`${value}-${crit}`]?.status === 'red') {
          panel.historyLog.push({ type: 'Maschine', name: value, time: timeString, timestampMs: Date.now(), note: `Mit ungelöstem Problem im Kriterium "${crit}" entfernt` });
        }
      });
      panel.machines = panel.machines.filter(m => m !== value);
      Object.keys(panel.cells).forEach(k => { if (k.startsWith(`${value}-`)) delete panel.cells[k]; });
    }
  } else if (type === 'criterion') {
    if (action === 'add' && !panel.criteria.includes(value)) panel.criteria.push(value);
    if (action === 'delete') {
      panel.machines.forEach(m => {
        if (panel.cells[`${m}-${value}`]?.status === 'red') {
          panel.historyLog.push({ type: 'Kategorie', name: value, time: timeString, timestampMs: Date.now(), note: `Mit ungelöstem Problem auf Maschine "${m}" entfernt` });
        }
      });
      panel.criteria = panel.criteria.filter(c => c !== value);
      Object.keys(panel.cells).forEach(k => { if (k.endsWith(`-${value}`)) delete panel.cells[k]; });
    }
  }

  saveData(data);
  res.json({ success: true, panel });
});

app.post('/api/panel/:id/status', async (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });

  const { machineId, criterion, status, note, author } = req.body;
  const cellKey = `${machineId}-${criterion}`;
  const previousStatus = panel.cells[cellKey] ? panel.cells[cellKey].status : "green";

  if (!panel.cells[cellKey]) {
    panel.cells[cellKey] = { status: "green", notes: [] };
  }

  panel.cells[cellKey].status = status;

  if (note && note.trim() !== "") {
    panel.cells[cellKey].notes.push({
      author: author || "Mitarbeiter",
      text: note,
      timestamp: new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })
    });
  }

  // Automatisches Ticket-Erstellen bei ROT
  if (status === 'red' && previousStatus !== 'red') {
    if (!data._actions) data._actions = {};

    // Erzeuge das Ticket-Basisobjekt über deinen Service
    const actionTicket = createActionObject({
      title: `${criterion}: ${note || 'Störung gemeldet'}`,
      status: "Analyse",
      escalationLevel: "Shopfloor (Lvl 1)",
      tasks: [],
      cause: "",
      lessonsLearned: ""
    });

    // 🎯 DATEN-INJEKTION: Hier verankern wir alle Daten aus Ebene 1 bombenfest im JSON
    actionTicket.id = generateActionId(data);
    actionTicket.machineId = String(machineId);   // Speichert z.B. "13503"
    actionTicket.criterion = String(criterion);   // Speichert z.B. "DISPO" oder "Qualität"
    
    data._actions[actionTicket.id] = actionTicket;

    sendStatusAlert(machineId, criterion, note, author);
  }

  saveData(data);
  res.json({ success: true, panel });
});

// --- ACTION ENGINE API ---
app.get('/api/tickets', (req, res) => {
  const data = loadData();
  res.json(Object.values(data._actions || {}));
});

app.post('/api/ticket/:id/task', (req, res) => {
  const { id } = req.params;
  const { title, owner } = req.body;
  const data = loadData();

  const ticket = data._actions?.[id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  const newTask = { id: `TSK-${Date.now().toString().slice(-4)}`, title, owner, status: 'open' };
  ticket.tasks = ticket.tasks || [];
  ticket.tasks.push(newTask);
  if (ticket.status === 'Analyse') ticket.status = 'Massnahmen';

  saveData(data);
  res.json(ticket);
});

app.post('/api/ticket/:ticketId/task/:taskId/toggle', (req, res) => {
  const { ticketId, taskId } = req.params;
  const data = loadData();

  const ticket = data._actions?.[ticketId];
  const task = ticket?.tasks?.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task nicht gefunden' });

  task.status = task.status === 'open' ? 'completed' : 'open';

  saveData(data);
  res.json(ticket);
});

app.post('/api/ticket/:id/escalate', (req, res) => {
  const { id } = req.params;
  const data = loadData();

  const ticket = data._actions?.[id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  const levels = ["Shopfloor (Lvl 1)", "Schichtleitung (Lvl 2)", "Produktionsleitung (Lvl 3)", "Werksleitung (Lvl 4)"];
  const currentIdx = levels.indexOf(ticket.escalationLevel);
  if (currentIdx < levels.length - 1) ticket.escalationLevel = levels[currentIdx + 1];

  saveData(data);
  res.json(ticket);
});

// 4b. Ticket eine Ebene de-eskalieren (Eskalationsstufe zurücknehmen)
app.post('/api/ticket/:id/de-escalate', (req, res) => {
  const { id } = req.params;
  const data = loadData();
  const ticket = data._actions?.[id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  const levels = ["Shopfloor (Lvl 1)", "Schichtleitung (Lvl 2)", "Produktionsleitung (Lvl 3)", "Werksleitung (Lvl 4)"];
  const currentIdx = levels.indexOf(ticket.escalationLevel);

  // Wenn wir über Lvl 1 sind, können wir eine Stufe zurückgehen
  if (currentIdx > 0) {
    ticket.escalationLevel = levels[currentIdx - 1];
  }

  saveData(data);
  res.json(ticket);
});

// 5. Ticket mit KVP (Root Cause) abschliessen und schliessen
app.post('/api/ticket/:id/close', (req, res) => {
  const { id } = req.params;
  const { cause, lessonsLearned } = req.body;
  const data = loadData();

  const ticket = data._actions?.[id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  ticket.status = 'Geschlossen';
  ticket.cause = cause;
  ticket.lessonsLearned = lessonsLearned;
  ticket.tasks = ticket.tasks?.map(t => ({ ...t, status: 'completed' })) || [];

  saveData(data);
  res.json(ticket);
});

// === COUPLING FRONTEND DIST (Abgestimmt auf deine Docker-Pfade) ===
const DIST_PATH = path.resolve(__dirname, '../frontend/dist');

if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api')) return res.status(404).json({ error: "API nicht gefunden" });
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.send("API läuft stabil. Frontend wird geladen."));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FactoryAI Server erfolgreich gestartet auf Port ${PORT}`);
});
