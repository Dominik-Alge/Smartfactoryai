// backend/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import nodemailer from 'nodemailer';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();

// REPARATUR 1: Port-Zuweisung absolut sauber priorisieren
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// REPARATUR 2: Permanenter Speicherpfad im beschreibbaren Linux-/tmp-Verzeichnis für Render
const STORAGE_FILE = process.env.RENDER 
  ? '/tmp/shopfloor_storage.json' 
  : path.join(__dirname, 'shopfloor_storage.json');

const defaultData = {
  "drehen": {
    name: "Gruppe Drehen",
    machines: ["12771", "12772", "12773", "12774", "12766"],
    criteria: ["Maschine", "AVOR", "DISPO", "NCP", "Qualität", "Material"],
    cells: {}
  },
  "fraesen": {
    name: "Gruppe Fräsen",
    machines: ["20101", "20102"],
    criteria: ["Maschine", "AVOR", "Werkzeug", "Qualität"],
    cells: {}
  }
};

function loadData() {
  try {
    if (!fs.existsSync(STORAGE_FILE)) {
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    return JSON.parse(raw);
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

// REPARATUR 3: Die Vorgesetzten-Sicht wird hier bombensicher an die Registerkarten übergeben
app.get('/api/panels', (req, res) => {
  const data = loadData();
  const list = Object.keys(data).map(key => ({ id: key, name: data[key].name }));
  
  // Setzt die Vorgesetzten-Sicht als allerersten Tab fest
  list.unshift({ id: 'insel_ds', name: '👁️ Insel-Sicht DS (Vorgesetzte)' });
  res.json(list);
});

// REPARATUR 4: Aggregiert alle roten Störungen live aus allen Mappen
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
      cells: aggregatedCells
    });
  }

  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });
  res.json(panel);
});

app.post('/api/panel', (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ error: "id und name erforderlich" });
  
  const data = loadData();
  if (data[id]) return res.status(400).json({ error: "ID existiert bereits" });

  data[id] = { name, machines: [], criteria: [], cells: {} };
  saveData(data);
  res.json({ success: true, panels: data });
});

app.post('/api/panel/:id/structure', (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });

  const { action, type, value } = req.body;

  if (type === 'machine') {
    if (action === 'add' && !panel.machines.includes(value)) panel.machines.push(value);
    if (action === 'delete') {
      panel.machines = panel.machines.filter(m => m !== value);
      Object.keys(panel.cells).forEach(k => { if (k.startsWith(`${value}-`)) delete panel.cells[k]; });
    }
  } else if (type === 'criterion') {
    if (action === 'add' && !panel.criteria.includes(value)) panel.criteria.push(value);
    if (action === 'delete') {
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

// Server auf dem von Render zugewiesenen Port starten
app.listen(PORT, () => { console.log(`Server läuft auf Port ${PORT}`); });


