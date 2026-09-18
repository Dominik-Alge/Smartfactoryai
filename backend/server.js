// backend/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const fs = require('fs'); // <-- NEU: Für dauerhafte Speicherung als Datei

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Speicher-Datei Pfad definieren
const STORAGE_FILE = path.join(__dirname, 'shopfloor_storage.json');

// Standard-Mappen (Falls die Datei noch leer oder neu ist)
const defaultData = {
  "drehen": {
    name: "Gruppe Drehen",
    machines: ["12771", "12772", "12773", "12774", "12766"],
    criteria: ["Maschine", "AVOR", "DISPO", "NCP", "Qualität", "Material"],
    cells: {} // Hier landen die Stati: "12771-AVOR": { status: "green", notes: [] }
  },
  "fraesen": {
    name: "Gruppe Fräsen",
    machines: ["20101", "20102"],
    criteria: ["Maschine", "AVOR", "Werkzeug", "Qualität"],
    cells: {}
  }
};

// Hilfsfunktionen zum Laden/Speichern der JSON-Datei
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

// === CONFIG: E-Mail-Verteiler für Kriterien ===
const criterionContacts = {
  "Maschine": { email: "dominik.alge@bruderer.com", label: "Technische Instandhaltung" },
  "AVOR": { email: "dominik.alge@bruderer.com", label: "Arbeitsvorbereitung" },
  "DISPO": { email: "dominik.alge@bruderer.com", label: "Materialdisposition" },
  "NCP": { email: "dominik.alge@bruderer.com", label: "NC-Programmierung" },
  "Qualität": { email: "dominik.alge@bruderer.com", label: "Qualitätssicherung" },
  "Material": { email: "dominik.alge@bruderer.com", label: "Logistik & Lager" },
  "Werkzeug": { email: "dominik.alge@bruderer.com", label: "Werkzeugbau" } // <-- Werkzeug für "Fräsen" ergänzt
};

// === MAIL-TRANSPORTER MIT DEBUGGING ===
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '://deinefirma.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'shopfloor-alert@firma.com',
    pass: process.env.SMTP_PASS || 'DeinSicheresPasswort'
  },
  debug: true,   // <-- NEU: Zeigt genaue SMTP-Protokolle im Render-Log
  logger: true   // <-- NEU: Protokolliert jeden Schritt im Terminal/Cloud-Log
});

const sendStatusAlert = async (machineId, criterion, note, author) => {
  const contact = criterionContacts[criterion];
  if (!contact || !contact.email) return;

  const mailOptions = {
    from: `"FactoryAI Alert" <${process.env.SMTP_USER || 'shopfloor-alert@firma.com'}>`,
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

// === API ENDPUNKTE (Echtes Multi-Mappen-System) ===

// 1. Alle verfügbaren Mappen (Panels) für die Navigation abrufen
app.get('/api/panels', (req, res) => {
  const data = loadData();
  const list = Object.keys(data).map(key => ({ id: key, name: data[key].name }));
  res.json(list);
});

// 2. Daten einer spezifischen Mappe abrufen
app.get('/api/panel/:id', (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });
  res.json(panel);
});

// 3. Neue Mappe (Excel-Blatt) anlegen
app.post('/api/panel', (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ error: "id und name erforderlich" });
  
  const data = loadData();
  if (data[id]) return res.status(400).json({ error: "ID existiert bereits" });

  data[id] = { name, machines: [], criteria: [], cells: {} };
  saveData(data);
  res.json({ success: true, panels: data });
});

// 4. Struktur anpassen (Maschinen/Kriterien hinzufügen oder permanent löschen!)
app.post('/api/panel/:id/structure', (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  if (!panel) return res.status(404).json({ error: "Panel nicht gefunden" });

  const { action, type, value } = req.body; // action: 'add'/'delete', type: 'machine'/'criterion'

  if (type === 'machine') {
    if (action === 'add' && !panel.machines.includes(value)) panel.machines.push(value);
    if (action === 'delete') {
      panel.machines = panel.machines.filter(m => m !== value);
      // Optionale Bereinigung verwaister Zellen
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

// 5. Ampel-Status in einer Mappe ändern
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

app.get('/', (req, res) => { res.send('<h1>FactoryAI Multi-Panel Engine läuft!</h1>'); });

app.listen(PORT, () => { console.log(`Server läuft auf Port ${PORT}`); });
