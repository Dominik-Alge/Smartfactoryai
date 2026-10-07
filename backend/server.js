// backend/server.js - TEIL 1
import express from 'express';
import cors from 'cors';
import path from 'path';
import nodemailer from 'nodemailer';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// REPARATUR: Erzeugt einen sicheren Pfad im Anwendungsordner für Render
const STORAGE_FILE = path.join(__dirname, 'shopfloor_storage.json');

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

// Globaler RAM-Cache, falls Festplattenschreiben auf Render fehlschlägt
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
  memoryCache = data; // Immer zuerst im Arbeitsspeicher sichern
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fehler beim physischen Schreiben der Datei:", err);
  }
}

const criterionContacts = {
  "Maschine": { email: "dominik.alge@bruderer.com", label: "Technische Instandhaltung" },
  "AVOR": { email: "dominik.alge@bruderer.com", label: "Arbeitsvorbereitung" },
  "DISPO": { email: "dominik.alge@bruderer.com", label: "Materialdisposition" },
  "NCP": { email: "dominik.alge@bruderer.com", label: "NC-Programmierung" },
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

// --- BASE API ---
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
    Object.keys(data).forEach((panelKey) => {
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
  
  if (!panel.historyLog) panel.historyLog = [];
  res.json(panel);
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
  if (!panel.historyLog) panel.historyLog = [];

  const { action, type, value } = req.body;
  const timeString = new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });

  if (type === 'machine') {
    if (action === 'add' && !panel.machines.includes(value)) panel.machines.push(value);
    if (action === 'delete') {
      panel.criteria.forEach(crit => {
        const cellKey = `${value}-${crit}`;
        if (panel.cells[cellKey]?.status === 'red') {
          panel.historyLog.push({
            type: 'Maschine',
            name: value,
            time: timeString,
            timestampMs: Date.now(),
            note: `Mit ungelöstem Problem im Kriterium "${crit}" entfernt`
          });
        }
      });

      panel.machines = panel.machines.filter(m => m !== value);
      Object.keys(panel.cells).forEach(k => { if (k.startsWith(`${value}-`)) delete panel.cells[k]; });
    }
  } else if (type === 'criterion') {
    if (action === 'add' && !panel.criteria.includes(value)) panel.criteria.push(value);
    if (action === 'delete') {
      panel.machines.forEach(m => {
        const cellKey = `${m}-${value}`;
        if (panel.cells[cellKey]?.status === 'red') {
          panel.historyLog.push({
            type: 'Kategorie',
            name: value,
            time: timeString,
            timestampMs: Date.now(),
            note: `Mit ungelöstem Problem auf Maschine "${m}" entfernt`
          });
        }
      });

      panel.criteria = panel.criteria.filter(c => c !== value);
      Object.keys(panel.cells).forEach(k => { if (k.endsWith(`-${value}`)) delete panel.cells[k]; });
    }
  }

  data[req.params.id] = panel;
  saveData(data);
  res.json({ success: true, panel });
});

app.post('/api/panel/:id/status', (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });

  const { machineId, criterion, status, note, author } = req.body;
  const key = `${machineId}-${criterion}`;
  const previousStatus = panel.cells[key] ? panel.cells[key].status : "green";

  if (!panel.cells[key]) panel.cells[key] = { status: "green", notes: [] };
  
  panel.cells[key].status = status;
  if (note && note.trim() !== "") {
    panel.cells[key].notes.push({
      author: author || "Mitarbeiter",
      text: note,
      timestamp: new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })
    });
  }

  data[req.params.id] = panel;
  saveData(data);

  if (status === 'red' && previousStatus !== 'red') {
    sendStatusAlert(machineId, criterion, note, author);
  }

  res.json({ success: true, panel });
});

app.post('/api/actions', (req, res) => {

  const data = loadData();

  // Sicherheitsnetz
  if (!data._actions) {
    data._actions = {};
  }

  const action = createActionObject(req.body);

  action.id = generateActionId(data);

  data._actions[action.id] = action;

  saveData(data);

  res.json({
    success: true,
    action
  });
});

// ======================================
// ACTION ENGINE API
// ======================================

app.post('/api/actions', (req, res) => {

  const data = loadData();

  if (!data._actions) {
    data._actions = {};
  }

  const action = createActionObject(req.body);

  action.id = generateActionId(data);

  data._actions[action.id] = action;

  saveData(data);

  res.json({
    success: true,
    action
  });
});

app.get('/api/actions', (req, res) => {

  const data = loadData();

  res.json(
    Object.values(data._actions || {})
  );
});

app.get('/api/actions/:id', (req, res) => {

  const data = loadData();

  const action = data._actions?.[req.params.id];

  if (!action) {
    return res.status(404).json({
      error: 'Action nicht gefunden'
    });
  }

  res.json(action);
});

// ======================================
// EXTENSION: ACTION ENGINE TASKS & ESCALATION (EBENE 2)
// ======================================

// 1. Task an ein bestehendes Ticket hängen und im Gedächtnis speichern
app.post('/api/actions/:id/tasks', (req, res) => {
  const data = loadData();
  const action = data._actions?.[req.params.id];

  if (!action) {
    return res.status(404).json({ error: 'Action nicht gefunden' });
  }

  // Falls das 'engine'-Objekt noch nicht existiert, zukunftssicher initialisieren
  if (!action.engine) {
    action.engine = {
      escalation: { currentLevel: 0, lastEscalatedAt: null },
      tasks: [],
      analysis: null,
      lessonsLearned: null
    };
  }

  // Task-ID generieren (z.B. TSK-001)
  const taskId = `TSK-${String(action.engine.tasks.length + 1).padStart(3, '0')}`;
  const now = new Date().toISOString();

  // Task-Struktur aufbauen
  const newTask = {
    id: taskId,
    title: req.body.title,
    type: req.body.type || 'Sofortmaßnahme',
    owner: req.body.owner || 'Nicht zugewiesen',
    dueDate: req.body.dueDate ? new Date(req.body.dueDate).toISOString() : null,
    status: 'open',
    escalationLevel: req.body.escalationLevel || 1
  };

  // Daten in das bewilligte Objekt injizieren
  action.engine.tasks.push(newTask);
  action.updatedAt = now;

  // Historie/Audit-Log (dein Gedächtnis) erweitern
  action.history.push({
    event: 'task_assigned',
    user: req.body.creator || 'System',
    timestamp: now,
    details: `Task ${taskId} ("${newTask.title}") zugewiesen an [${newTask.owner}]`
  });

  // Speichern über deine bestehende Infrastruktur
  data._actions[action.id] = action;
  saveData(data);

  res.json({ success: true, action });
});

// =========================================================================
// 7. STATUS-AMPEL ÄNDERN & AUTOMATISCH ENGINE TICKET ERSTELLEN (BRÜCKE)
// =========================================================================
app.post('/api/panel/:id/status', async (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });

  const { machineId, criterion, status, note, author } = req.body;
  const cellKey = `${machineId}-${criterion}`;

  // Status updaten
  panel.cells[cellKey] = { status, note, author, timestamp: Date.now() };

  // ⚠️ WENN STATUS ROT IST -> AUTOMATISCH EIN TICKET IN DER ACTION ENGINE ERSTELLEN
  if (status === 'red') {
    const nextIdNum = data._system?.nextActionId || 1;
    const ticketId = `ACT-${String(nextIdNum).padStart(6, '0')}`;
    
    // Nächste ID hochzählen
    if (!data._system) data._system = {};
    data._system.nextActionId = nextIdNum + 1;

    // Ticket-Objekt bauen und in _actions ablegen
    data._actions[ticketId] = {
      id: ticketId,
      machineId: machineId,
      status: "Analyse", // Startphase
      escalationLevel: "Shopfloor (Lvl 1)",
      title: `${criterion}: ${note || 'Störung gemeldet'}`,
      cause: "",
      lessonsLearned: "",
      tasks: []
    };

    // E-Mail Alarm im Hintergrund abfeuern
    sendStatusAlert(machineId, criterion, note, author);
  }

  saveData(data);
  res.json({ success: true, panel });
});


// =========================================================================
// ACTION ENGINE API ENDPUNKTE (Ebene 2)
// =========================================================================

// 1. Alle Tickets abrufen
app.get('/api/tickets', (req, res) => {
  const data = loadData();
  // Konvertiert das _actions Objekt in ein flaches Array für das React-Frontend
  const ticketList = Object.values(data._actions || {});
  res.json(ticketList);
});

// 2. Neuen Task zu einem Ticket hinzufügen
app.post('/api/ticket/:id/task', (req, res) => {
  const { id } = req.params;
  const { title, owner } = req.body;
  const data = loadData();

  const ticket = data._actions?.[id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  const newTask = {
    id: `TSK-${Date.now().toString().slice(-4)}`,
    title,
    owner,
    status: 'open'
  };

  ticket.tasks = ticket.tasks || [];
  ticket.tasks.push(newTask);

  // Automatischer Phasenwechsel von Analyse zu Massnahmen
  if (ticket.status === 'Analyse') {
    ticket.status = 'Massnahmen';
  }

  saveData(data);
  res.json(ticket);
});

// 3. Task-Status umschalten (open <-> completed)
app.post('/api/ticket/:ticketId/task/:taskId/toggle', (req, res) => {
  const { ticketId, taskId } = req.params;
  const data = loadData();

  const ticket = data._actions?.[ticketId];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  const task = ticket.tasks?.find(t => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task nicht gefunden' });

  task.status = task.status === 'open' ? 'completed' : 'open';

  saveData(data);
  res.json(ticket);
});

// 4. Ticket eine Ebene eskalieren
app.post('/api/ticket/:id/escalate', (req, res) => {
  const { id } = req.params;
  const data = loadData();

  const ticket = data._actions?.[id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  const levels = ["Shopfloor (Lvl 1)", "Schichtleitung (Lvl 2)", "Produktionsleitung (Lvl 3)", "Werksleitung (Lvl 4)"];
  const currentIdx = levels.indexOf(ticket.escalationLevel);

  if (currentIdx < levels.length - 1) {
    ticket.escalationLevel = levels[currentIdx + 1];
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
  
  // Alle verbleibenden Tasks automatisch auf erledigt setzen
  ticket.tasks = ticket.tasks?.map(t => ({ ...t, status: 'completed' })) || [];

  saveData(data);
  res.json(ticket);
});


// =========================================================================
// FRONTEND SERVING (Repariert für Render & euren Firmen-Server)
// =========================================================================

// Pfad zum dist-Ordner absolut auflösen (sucht nach dem 'dist'-Ordner im Projekt-Wurzelverzeichnis)
const DIST_PATH = path.resolve('./dist');

// Statische Assets (JS, CSS, Bilder) direkt bereitstellen
app.use(express.static(DIST_PATH));

// Spezieller Catch für das Favicon, um CSP-Fehler im Log zu vermeiden
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(DIST_PATH, 'favicon.ico');
  if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else {
    res.status(204).end(); // Sende "No Content", falls keins da ist, statt abzustürzen
  }
});

// Alle anderen Routen landen bei der index.html (SPA Routing)
app.get('*', (req, res) => {
  // Verhindert Endlosschleifen, falls API-Routes falsch geschrieben wurden
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: "API-Endpunkt nicht gefunden" });
  }
  
  const indexPath = path.join(DIST_PATH, 'index.html');
  
  // Überprüfung, ob das Frontend überhaupt schon gebaut wurde
  if (!fs.existsSync(indexPath)) {
    console.error(`⚠️ FEHLER: Frontend-Build wurde nicht gefunden unter: ${indexPath}`);
    return res.status(500).send("Frontend wurde noch nicht gebaut. Bitte 'npm run build' ausführen.");
  }

  res.sendFile(indexPath);
});



