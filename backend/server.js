// =========================================================================
// FACTORYAI SHOPFLOOR SERVER
// -------------------------------------------------------------------------
// Aufbau:
//   server.js            Start, Gruppen-/Panel-Routen, Auslieferung Frontend
//   routes/tickets.js    Action Engine (Tickets, Phasen, Eskalation, Kalender)
//   services/            Speicher, Ticket-Modell, Eskalation, Kalender, Mail
//   config/              Alles, was der Betrieb anpassen kann
// =========================================================================

// Fängt versteckte Startfehler ab und schreibt sie ins Log
process.on('uncaughtException', (err) => {
  console.error('KRITISCHER STARTFEHLER:', err.message);
  console.error(err.stack);
  process.exit(1);
});

import './services/loadEnv.js'; // muss zuerst kommen: liest backend/.env
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { loadData, saveData, getPanelKeys, STORAGE_DIR } from './services/storage.js';
import { generateActionId, createTicket, addHistory } from './services/actionService.js';
import { isSplitCell, applyShiftStatus, shiftLabel, SHIFT_STATES } from './services/shiftCells.js';
import { SHIFTS } from './config/calendar.js';
import { sendStatusAlert } from './services/emailService.js';
import ticketRoutes from './routes/tickets.js';
import { seedDemoData } from './demo/seedDemo.js';

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

// Nur für Vorführungen (Render): Beispieltickets erzeugen, wenn DEMO_DATA=true
if (process.env.DEMO_DATA === 'true') seedDemoData(loadData(), saveData);

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
  const keys = getPanelKeys(data);

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
  if (req.params.id === 'insel_ds') {
    const aggregatedCells = {};
    const keys = getPanelKeys(data);
    keys.forEach((panelKey) => {
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

  const { machineId, criterion, status, note, author, shift } = req.body;
  const cellKey = `${machineId}-${criterion}`;
  if (!panel.cells[cellKey]) panel.cells[cellKey] = { status: 'green', notes: [] };
  const cell = panel.cells[cellKey];
  const previousStatus = cell.status;

  // Zweischicht-Maschine, geteiltes Kriterium (z. B. Personal): Status je Schicht
  const perShift = shift && isSplitCell(panel, machineId, criterion);
  if (perShift) {
    if (!SHIFT_STATES.includes(status)) return res.status(400).json({ error: 'Unbekannter Status.' });
    const before = cell.shifts?.[shift];
    applyShiftStatus(cell, shift, status);
    // Ist schon ein Ticket offen und fehlt jetzt zusätzlich die andere Schicht, wird das dort vermerkt
    if (status === 'red' && before !== 'red' && previousStatus === 'red') {
      const open = Object.values(data._actions).find(
        (t) => !t.closedAt && t.panelId === String(req.params.id) && t.machineId === String(machineId) && t.criterion === criterion
      );
      if (open) addHistory(open, 'shift', author, `Zusätzlich betroffen: ${shiftLabel(shift)}. ${note || ''}`.trim());
    }
  } else {
    cell.status = status;
    // Ganze Zelle ohne Schichtangabe geändert (z. B. aus Insel-Sicht oder Cockpit-Detail):
    // GRÜN setzt rote Schichten zurück, ROT gilt für alle besetzten Schichten.
    if (isSplitCell(panel, machineId, criterion) || cell.shifts) {
      const from = status === 'green' ? 'red' : 'green';
      for (const s of SHIFTS) {
        const now = cell.shifts?.[s.id] || 'green';
        if (now === from) applyShiftStatus(cell, s.id, status);
      }
      cell.status = status;
    }
  }

  if (note && note.trim() !== "") {
    cell.notes.push({
      author: author || "Mitarbeiter",
      text: perShift ? `[${shiftLabel(shift)}] ${note}` : note,
      timestamp: new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })
    });
  }

  // Automatisch ein Ticket erstellen, wenn die Zelle neu auf ROT geht
  if (cell.status === 'red' && previousStatus !== 'red') {
    const label = perShift ? `${criterion} (${shiftLabel(shift)})` : criterion;
    const ticket = createTicket({
      id: generateActionId(data),
      title: `${label}: ${note || 'Störung gemeldet'}`,
      panelId: req.params.id,
      machineId,
      criterion,
      note,
      author
    });
    data._actions[ticket.id] = ticket;
    sendStatusAlert(machineId, label, note, author);
  }

  saveData(data);
  res.json({ success: true, panel });
});

// --- ACTION ENGINE API (siehe routes/tickets.js) ---
app.use('/api', ticketRoutes);


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
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 FactoryAI Server erfolgreich gestartet auf Port ${PORT}`);
  console.log(`💾 Datenordner (bitte regelmässig sichern): ${STORAGE_DIR}`);
  console.log(`===================================================`);
});