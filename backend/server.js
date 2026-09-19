// backend/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import nodemailer from 'nodemailer';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();

// PORT-Zuweisung absolut sauber priorisieren
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// Permanenter Speicherpfad im beschreibbaren Linux-/tmp-Verzeichnis für Render
const STORAGE_FILE = process.env.RENDER 
  ? '/tmp/shopfloor_storage.json' 
  : path.join(__dirname, 'shopfloor_storage.json');

const defaultData = {
  "drehen": {
    name: "Gruppe Drehen",
    machines: ["12771", "12772", "12773", "12774", "12766"],
    criteria: ["Maschine", "AVOR", "DISPO", "NCP", "Qualität", "Material"],
    cells: {},
    historyLog: [] // NEU: Verlaufsspeicher für gelöschte Alarme
  },
  "fraesen": {
    name: "Gruppe Schleifen",
    machines: ["13404", "13402", "13602", "13507", "13509", "13510", "13750"],
    criteria: ["Maschine", "AVOR", "DISPO", "NCP", "Qualität", "Material"],
    cells: {},
    historyLog: [] // NEU: Verlaufsspeicher für gelöschte Alarme
  }
};

// Hilfsfunktion: Bereinigt die Historie um Einträge, die älter als 24 Stunden sind
function cleanOldHistory(panel) {
  if (!panel.historyLog) {
    panel.historyLog = [];
    return;
  }
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  panel.historyLog = panel.historyLog.filter(log => log.timestampMs > twentyFourHoursAgo);
}

function loadData() {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    const data = JSON.parse(raw);
    
    // Historie beim Laden für alle Panels bereinigen
    Object.keys(data).forEach(key => {
      cleanOldHistory(data[key]);
    });
    
    return data;
  } catch (err) {
    console.error("Fehler beim Laden der Speicherdatei:", err);
    return defaultData;
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fehler beim Speichern der Datei:", err);
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
  },
  debug: true,
  logger: true
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
    console.log(`[Email] Erfolgreich gesendet an ${contact.email}`);
  } catch (error) {
    console.error('[Email-Fehler] Ausführliches Log für Render:', error);
  }
};

// === API ENDPUNKTE ===

app.get('/api/panels', (req, res) => {
  const data = loadData();
  const list = Object.keys(data).map(key => ({ id: key, name: data[key].name }));
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
  
  // Sicherstellen, dass das historyLog-Feld existiert beim Ausliefern
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

// MODIFIZIERT: Sichert ungelöste Probleme in historyLog vor dem Löschen
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
      // Vor dem Löschen prüfen, ob ein Kriterium für diese Maschine rot war
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
      // Vor dem Löschen prüfen, ob eine Maschine bei diesem Kriterium rot war
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

// === FRONTEND ANBINDUNG ===
const finalDistPath = '/app/frontend/dist';
app.use(express.static(finalDistPath));

app.get('*', (req, res) => {
  const indexPath = path.join(finalDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`<h1>Fehler: index.html nicht gefunden</h1>`);
  }
});

app.listen(PORT, () => { console.log(`Server läuft auf Port ${PORT}`); });


