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
import {
  ESCALATION_LEVELS,
  levelIndex,
  levelName,
  startClock,
  stopClock,
  alignClockToLevel,
  applyAutoEscalation,
  escalationInfo,
  findRecurrenceCandidates,
  findPanelIdForTicket,
  migrateTickets
} from './services/escalationService.js'; // Ergänzt am 20.11.2026

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

const STORAGE_DIR = path.join(__dirname, 'shopfloor_data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'shopfloor_storage.json');

// Erstellt den Backup-Ordner automatisch, falls er fehlt
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
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
  return Object.keys(data).filter(key => !key.startsWith('_'));
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

    // Altdaten bereinigen (Stufennamen, fehlende Felder, Eskalations-Uhr)
    memoryCache = data;
    if (migrateTickets(data)) saveData(data);
    return data;
  } catch (err) {
    console.error("Fehler beim Laden, RAM-Fallback genutzt:", err);
    return memoryCache || defaultData;
  }
}

// Sicheres Speichern: erst in eine Temp-Datei schreiben, dann umbenennen.
// So bleibt die JSON-Datei auch bei einem Absturz mitten im Schreiben intakt.
// Zusätzlich wird pro Tag eine Sicherungskopie angelegt (shopfloor_storage.backup-JJJJ-MM-TT.json).
function saveData(data) {
  memoryCache = data;
  const json = JSON.stringify(data, null, 2);
  const tmpFile = `${STORAGE_FILE}.tmp`;
  try {
    fs.writeFileSync(tmpFile, json);
    fs.renameSync(tmpFile, STORAGE_FILE);
  } catch (err) {
    console.error("Atomares Speichern fehlgeschlagen, schreibe direkt:", err.message);
    try {
      fs.writeFileSync(STORAGE_FILE, json);
    } catch (err2) {
      console.error("Schreibfehler auf Festplatte:", err2);
    }
  }
  try {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const backupFile = path.join(STORAGE_DIR, `shopfloor_storage.backup-${stamp}.json`);
    if (!fs.existsSync(backupFile)) fs.writeFileSync(backupFile, json);
  } catch (err) {
    console.error("Tages-Backup fehlgeschlagen:", err.message);
  }
}

// Eskalations-Markierungen für eine Gruppe: { "13503-Qualität": { levelIndex, level, machineDown, ticketId } }
function buildEscalationMap(data, panelIds) {
  const map = {};
  const ids = new Set(panelIds);
  Object.values(data._actions || {}).forEach((t) => {
    if (t.status === 'Geschlossen') return;
    const pid = findPanelIdForTicket(data, t);
    if (!pid || !ids.has(pid)) return;
    const key = `${t.machineId}-${t.criterion}`;
    const idx = levelIndex(t.escalationLevel);
    if (!map[key] || map[key].levelIndex < idx) {
      map[key] = {
        levelIndex: idx,
        level: t.escalationLevel,
        machineDown: !!t.machineDown,
        ticketId: t.id,
        autoEscalated: !!t.autoEscalated,
        isRecurrence: t.recurrence?.decision === 'same'
      };
    }
  });
  return map;
}

function runEscalationCheck(data) {
  if (applyAutoEscalation(data, Date.now())) saveData(data);
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
  host: process.env.SMTP_HOST || 'mail.bruderer.com', 
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

// Hilfsfunktion: Speichert nachvollziehbar, wer was gelöscht hat
function logAudit(data, action, targetType, targetName, panelName, author) {
  if (!data._auditLog) data._auditLog = [];
  data._auditLog.push({
    timestamp: new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' }),
    timestampMs: Date.now(),
    action,
    targetType,
    targetName,
    panelName,
    author: author || 'Unbekannt'
  });
}

// --- BASE SHOPFLOOR API ---
app.get('/api/panels', (req, res) => {
  const data = loadData();
  // Filtert auch _auditLog heraus, damit es nicht als Tab erscheint
  const keys = getPanelKeys(data);
  const list = keys.map(key => ({ id: key, name: data[key].name }));
  list.unshift({ id: 'insel_ds', name: ' Insel-Sicht DS (Vorgesetzte)' });
  res.json(list);
});

// NEU: Gruppen-Tabs (Panels) verschieben
app.post('/api/panels/move', (req, res) => {
  const { panelId, direction } = req.body; // direction: 'left' oder 'right'
  const data = loadData();
  const keys = Object.keys(data).filter(
    key => key !== '_system' && key !== '_actions' && key !== '_auditLog'
  );

  const index = keys.indexOf(panelId);
  if (index === -1) return res.status(404).json({ error: 'Panel nicht gefunden' });

  const targetIndex = direction === 'left' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= keys.length) {
    return res.json({ success: true }); // Bereits am Rand
  }

  // Reihenfolge der Keys tauschen
  [keys[index], keys[targetIndex]] = [keys[targetIndex], keys[index]];

  // Neues Daten-Objekt in neuer Reihenfolge aufbauen
  const reorderedData = {};
  keys.forEach(k => { reorderedData[k] = data[k]; });
  if (data._system) reorderedData._system = data._system;
  if (data._actions) reorderedData._actions = data._actions;
  if (data._auditLog) reorderedData._auditLog = data._auditLog;

  saveData(reorderedData);
  res.json({ success: true });
});

// NEU: Gruppe (Panel) endgültig löschen + Audit-Log
app.delete('/api/panel/:id', (req, res) => {
  const { id } = req.params;
  const { author } = req.body;
  const data = loadData();

  if (!data[id] || id.startsWith('_')) {
    return res.status(404).json({ error: 'Panel nicht gefunden' });
  }

  const panelName = data[id].name || id;
  logAudit(data, 'DELETE_PANEL', 'Gruppe', panelName, panelName, author);

  delete data[id];
  saveData(data);
  res.json({ success: true });
});

app.get('/api/panel/:id', (req, res) => {
  const data = loadData();
  runEscalationCheck(data);
  if (req.params.id === 'insel_ds') {
    const aggregatedCells = {};
    const cellPanels = {};
    const keys = Object.keys(data).filter(
      key => key !== '_system' && key !== '_actions' && key !== '_auditLog'
    );
    keys.forEach((panelKey) => {
      const panel = data[panelKey];
      if (panel && panel.cells) {
        Object.keys(panel.cells).forEach((cellKey) => {
          if (panel.cells[cellKey]?.status === 'red') {
            aggregatedCells[cellKey] = panel.cells[cellKey];
            cellPanels[cellKey] = panelKey; // Ergänzt am 20.11.2026: zu welcher Gruppe gehört die Zelle?
          }
        });
      }
    });
    return res.json({
      name: 'Insel-Sicht DS',
      machines: [],
      criteria: [],
      cells: aggregatedCells,
      historyLog: [],
      cellPanels,
      escalations: buildEscalationMap(data, keys)
    });
  }

  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });
  if (!panel.historyLog) panel.historyLog = [];
  res.json({ ...panel, escalations: buildEscalationMap(data, [req.params.id]) });
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

// ERWEITERT: Struktur ändern (Hinzufügen, Verschieben, Löschen mit Audit-Log)
app.post('/api/panel/:id/structure', (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });

  const { action, type, value, direction, author } = req.body;
  const timeString = new Date().toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich'
  });

  if (type === 'machine') {
    if (action === 'add' && !panel.machines.includes(value)) {
      panel.machines.push(value);
    }
    if (action === 'move') {
      const idx = panel.machines.indexOf(value);
      const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (idx !== -1 && targetIdx >= 0 && targetIdx < panel.machines.length) {
        [panel.machines[idx], panel.machines[targetIdx]] = [panel.machines[targetIdx], panel.machines[idx]];
      }
    }
    if (action === 'delete') {
      panel.criteria.forEach(crit => {
        if (panel.cells[`${value}-${crit}`]?.status === 'red') {
          panel.historyLog.push({
            type: 'Maschine',
            name: value,
            time: timeString,
            timestampMs: Date.now(),
            note: `Mit ungelöstem Problem im Kriterium "${crit}" entfernt (durch ${author || 'Unbekannt'})`
          });
        }
      });
      logAudit(data, 'DELETE_MACHINE', 'Maschine', value, panel.name, author);
      panel.machines = panel.machines.filter(m => m !== value);
      Object.keys(panel.cells).forEach(k => {
        if (k.startsWith(`${value}-`)) delete panel.cells[k];
      });
    }
  } else if (type === 'criterion') {
    if (action === 'add' && !panel.criteria.includes(value)) {
      panel.criteria.push(value);
    }
    if (action === 'move') {
      const idx = panel.criteria.indexOf(value);
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx !== -1 && targetIdx >= 0 && targetIdx < panel.criteria.length) {
        [panel.criteria[idx], panel.criteria[targetIdx]] = [panel.criteria[targetIdx], panel.criteria[idx]];
      }
    }
    if (action === 'delete') {
      panel.machines.forEach(m => {
        if (panel.cells[`${m}-${value}`]?.status === 'red') {
          panel.historyLog.push({
            type: 'Kategorie',
            name: value,
            time: timeString,
            timestampMs: Date.now(),
            note: `Mit ungelöstem Problem auf Maschine "${m}" entfernt (durch ${author || 'Unbekannt'})`
          });
        }
      });
      logAudit(data, 'DELETE_CRITERION', 'Kategorie', value, panel.name, author);
      panel.criteria = panel.criteria.filter(c => c !== value);
      Object.keys(panel.cells).forEach(k => {
        if (k.endsWith(`-${value}`)) delete panel.cells[k];
      });
    }
  }

  saveData(data);
  res.json({ success: true, panel });
});

app.post('/api/panel/:id/status', async (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });

  const { machineId, criterion, status, note, author, machineDown } = req.body;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const cellKey = `${machineId}-${criterion}`;
  const previousStatus = panel.cells[cellKey] ? panel.cells[cellKey].status : "green";

  if (!panel.cells[cellKey]) {
    panel.cells[cellKey] = { status: "green", notes: [] };
  }

  panel.cells[cellKey].status = status;
  if (status === 'red' && typeof machineDown === 'boolean') panel.cells[cellKey].machineDown = machineDown;
  if (status === 'green') panel.cells[cellKey].machineDown = false;

  // Offene Tickets dieser Zelle (Maschine + Kriterium)
  const openTicketsOfCell = Object.values(data._actions || {}).filter(
    (t) => t.status !== 'Geschlossen' && String(t.machineId) === String(machineId) && t.criterion === String(criterion)
  );

  // Rot → Grün: Störung behoben, Eskalations-Uhr anhalten (KVP läuft separat weiter)
  if (status === 'green' && previousStatus === 'red') {
    openTicketsOfCell.forEach((t) => {
      stopClock(t, nowMs);
      if (!t.resolvedAt) t.resolvedAt = nowIso;
      t.updatedAt = nowIso;
      t.history = t.history || [];
      t.history.push({ event: 'resolved_on_shopfloor', user: author || 'Mitarbeiter', timestamp: nowIso, details: 'Störung am Shopfloor behoben (Zelle grün)' });
    });
  }

  // Bleibt rot: "Maschine steht" kann nachträglich geändert werden
  if (status === 'red' && previousStatus === 'red' && typeof machineDown === 'boolean') {
    openTicketsOfCell.forEach((t) => {
      if (!!t.machineDown !== machineDown) {
        t.machineDown = machineDown;
        t.updatedAt = nowIso;
        t.history = t.history || [];
        t.history.push({ event: 'machine_down_changed', user: author || 'Mitarbeiter', timestamp: nowIso, details: machineDown ? 'Maschine steht' : 'Maschine läuft wieder (eingeschränkt)' });
      }
    });
  }

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

    // Erzeuge das Ticket-Basisobjekt über deinen Service.
    // Hinweis: createActionObject übernimmt nur Titel/Maschine/Kriterium –
    // Status, Stufe usw. werden deshalb unten explizit gesetzt (Fehlerkorrektur 20.11.2026).
    const actionTicket = createActionObject({
      title: `${criterion}: ${note || 'Störung gemeldet'}`,
      panelId: String(req.params.id),
      machineId: String(machineId),
      criterion: String(criterion),
      creator: author || 'Mitarbeiter'
    });
    actionTicket.status = 'Analyse';
    actionTicket.escalationLevel = ESCALATION_LEVELS[0];
    actionTicket.tasks = [];
    actionTicket.cause = '';
    actionTicket.lessonsLearned = '';
    actionTicket.machineDown = machineDown === true;
    startClock(actionTicket, nowMs);

    // 🎯 DATEN-INJEKTION: Hier verankern wir alle Daten aus Ebene 1 bombenfest im JSON
    actionTicket.id = generateActionId(data);
    actionTicket.panelId = String(req.params.id); // geändert am 18.11.2026
    actionTicket.machineId = String(machineId);   // Speichert z.B. "13503"
    actionTicket.criterion = String(criterion);   // Speichert z.B. "DISPO" oder "Qualität"
    
    // Wiederholfall? Frühere Fälle gleicher Maschine + Kriterium merken
    const candidates = findRecurrenceCandidates(data, actionTicket, nowMs);
    if (candidates.length) {
      actionTicket.recurrence = { candidates, decision: null };
    }

    data._actions[actionTicket.id] = actionTicket;
    sendStatusAlert(machineId, criterion, note, author);
  }

  applyAutoEscalation(data, nowMs);
  saveData(data);
  res.json({ success: true, panel: { ...panel, escalations: buildEscalationMap(data, [req.params.id]) } });
});

// --- ACTION ENGINE API ---
app.get('/api/tickets', (req, res) => {
  const data = loadData();
  runEscalationCheck(data);
  const nowMs = Date.now();
  const list = Object.values(data._actions || {}).map((t) => {
    const pid = findPanelIdForTicket(data, t);
    return {
      ...t,
      panelId: pid,
      panelName: pid ? data[pid]?.name || pid : null,
      escalationInfo: escalationInfo(t, nowMs)
    };
  });
  res.json(list);
});

// Wiederholfall beantworten: "Ist das derselbe Fall?"
app.post('/api/ticket/:id/recurrence', (req, res) => {
  const { id } = req.params;
  const { decision, relatedId, whyFailed, nextStep, author } = req.body;
  const data = loadData();
  const ticket = data._actions?.[id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });
  if (decision !== 'same' && decision !== 'different') {
    return res.status(400).json({ error: 'decision muss "same" oder "different" sein' });
  }
  if (decision === 'same' && (!String(whyFailed || '').trim() || !String(nextStep || '').trim())) {
    return res.status(400).json({ error: 'Bitte beantworten: Warum hat die Massnahme nicht gegriffen, und was machen wir jetzt anders?' });
  }
  const nowIso = new Date().toISOString();
  ticket.recurrence = {
    ...(ticket.recurrence || { candidates: [] }),
    decision,
    relatedId: decision === 'same' ? relatedId || ticket.recurrence?.candidates?.[0]?.id || null : null,
    whyFailed: decision === 'same' ? String(whyFailed).trim() : '',
    nextStep: decision === 'same' ? String(nextStep).trim() : '',
    decidedAt: nowIso,
    decidedBy: author || 'Unbekannt'
  };
  ticket.history = ticket.history || [];
  ticket.history.push({
    event: 'recurrence_decided',
    user: author || 'Unbekannt',
    timestamp: nowIso,
    details: decision === 'same' ? `Wiederholfall von ${ticket.recurrence.relatedId}` : 'Kein Wiederholfall'
  });
  // Beim Vorgängerfall vermerken, dass sich das Problem wiederholt hat
  const related = ticket.recurrence.relatedId ? data._actions[ticket.recurrence.relatedId] : null;
  if (related) {
    related.recurredBy = Array.from(new Set([...(related.recurredBy || []), ticket.id]));
  }
  ticket.updatedAt = nowIso;
  saveData(data);
  res.json(ticket);
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

  const currentIdx = levelIndex(ticket.escalationLevel);
  if (currentIdx < ESCALATION_LEVELS.length - 1) {
    const nowIso = new Date().toISOString();
    ticket.escalationLevel = levelName(currentIdx + 1);
    ticket.escalatedAt = nowIso;
    ticket.updatedAt = nowIso;
    ticket.history = ticket.history || [];
    ticket.history.push({ event: 'escalated', user: req.body?.author || 'Manuell', timestamp: nowIso, details: `Manuell eskaliert auf ${ticket.escalationLevel}` });
  }

  saveData(data);
  res.json(ticket);
});

// 4b. Ticket eine Ebene de-eskalieren (Eskalationsstufe zurücknehmen)
app.post('/api/ticket/:id/de-escalate', (req, res) => {
  const { id } = req.params;
  const data = loadData();
  const ticket = data._actions?.[id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden' });

  const currentIdx = levelIndex(ticket.escalationLevel);

  // Wenn wir über Lvl 1 sind, können wir eine Stufe zurückgehen.
  // Die Automatik zählt danach ab der neuen Stufe weiter (statt sofort wieder hochzustufen).
  if (currentIdx > 0) {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    ticket.escalationLevel = levelName(currentIdx - 1);
    alignClockToLevel(ticket, currentIdx - 1, nowMs);
    ticket.updatedAt = nowIso;
    ticket.history = ticket.history || [];
    ticket.history.push({ event: 'de_escalated', user: req.body?.author || 'Manuell', timestamp: nowIso, details: `Zurückgestuft auf ${ticket.escalationLevel}` });
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

  // Wiederholfall muss zuerst beantwortet sein
  if (ticket.recurrence?.candidates?.length && !ticket.recurrence.decision) {
    return res.status(409).json({ error: 'Bitte zuerst beantworten, ob es sich um einen Wiederholfall handelt.' });
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  stopClock(ticket, nowMs);
  ticket.status = 'Geschlossen';
  ticket.cause = cause;
  ticket.lessonsLearned = lessonsLearned;
  ticket.tasks = ticket.tasks?.map(t => ({ ...t, status: 'completed' })) || [];
  ticket.closedAt = nowIso;
  ticket.updatedAt = nowIso;
  ticket.history = ticket.history || [];
  ticket.history.push({ event: 'closed', user: req.body?.author || 'Unbekannt', timestamp: nowIso, details: 'Lernschleife geschlossen' });

  saveData(data);
  res.json(ticket);
});

// =========================================================================
// STATISCHE DATEIEN (Liefert das React/Vite-Frontend aus)
// =========================================================================
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(frontendDistPath)) {
  // Wenn der dist-Ordner existiert, liefere die Dateien aus
  app.use(express.static(frontendDistPath));
  
  // Wichtig für React-Router: Alle übrigen Anfragen senden die index.html
  app.get('*', (req, res, next) => {
    // Falls eine API-Route aufgerufen wird, die nicht existiert, nicht die HTML senden
    if (req.path.startsWith('/api')) return next(); 
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // Sicherheits-Warnung auf der Konsole, falls der Build fehlt
  console.log(`⚠️ HINWEIS: Statischer Frontend-Ordner nicht gefunden unter: ${frontendDistPath}`);
  console.log(`Das Backend läuft als reine API. Bitte 'npm run build' im frontend-Ordner ausführen.`);
}

// =========================================================================
// SERVER START
// =========================================================================
// Automatische Eskalation: jede Minute prüfen
setInterval(() => {
  try {
    runEscalationCheck(loadData());
  } catch (err) {
    console.error('Eskalationsprüfung fehlgeschlagen:', err.message);
  }
}, 60 * 1000);

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 FactoryAI Server erfolgreich gestartet auf Port ${PORT}`);
  console.log(`💾 Datenbankordner für IT-Backup: ${STORAGE_DIR}`);
  console.log(`===================================================`);
});
