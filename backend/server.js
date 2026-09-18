const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer'); // <-- NEU: Für den Mailversand

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Serviert die statischen React-Dateien aus dem "public"-Ordner
app.use(express.static(path.join(__dirname, 'public')));

// === CONFIG: E-Mail-Zuständigkeiten für die Kriterien ===
const criterionContacts = {
  "Maschine": { email: "instandhaltung@firma.com", label: "Technische Instandhaltung" },
  "AVOR": { email: "avor.team@firma.com", label: "Arbeitsvorbereitung" },
  "DISPO": { email: "disposition@firma.com", label: "Materialdisposition" },
  "NCP": { email: "nc-programmierung@firma.com", label: "NC-Programmierung" },
  "Qualität": { email: "qs-notfall@firma.com", label: "Qualitätssicherung" },
  "Material": { email: "logistik@firma.com", label: "Logistik & Lager" }
};

// === CONFIG: Mailserver (Nutzt Umgebungsvariablen aus der .env) ===
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '://deinefirma.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'shopfloor-alert@firma.com',
    pass: process.env.SMTP_PASS || 'DeinSicheresPasswort'
  }
});

// === HILFSFUNKTION: E-Mail senden ===
const sendStatusAlert = async (machineId, criterion, note, author) => {
  const contact = criterionContacts[criterion];
  
  if (!contact || !contact.email) {
    console.log(`[Email] Keine E-Mail-Adresse für Kriterium "${criterion}" hinterlegt.`);
    return;
  }

  const mailOptions = {
    from: `"FactoryAI Alert" <${process.env.SMTP_USER || 'shopfloor-alert@firma.com'}>`,
    to: contact.email,
    subject: `⚠️ ALARM: Status ROT bei Spalte ${machineId} (${criterion})`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; max-width: 600px;">
        <h2 style="color: #ef4444; margin-top: 0;">⚠️ Shopfloor Alert – Handlungsbedarf!</h2>
        <p>Am Shopfloor-Panel wurde soeben ein Kriterium auf <strong>ROT</strong> gesetzt.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0; width: 40%;">Maschine / Spalte:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${machineId}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Kriterium / Bereich:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${criterion} (${contact.label})</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Gemeldet von:</td>
            <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${author || 'Mitarbeiter am Terminal'}</td>
          </tr>
        </table>

        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin-top: 15px;">
          <strong>Hinterlegte Notiz / Grund:</strong><br>
          <span style="font-style: italic; color: #991b1b;">"${note || 'Keine nähere Beschreibung angegeben.'}"</span>
        </div>

        <p style="font-size: 12px; color: #64748b; margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px;">
          Diese E-Mail wurde automatisch vom FactoryAI Shopfloor-System generiert. Bitte nicht direkt antworten.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Alert-Mail erfolgreich an ${contact.email} gesendet.`);
  } catch (error) {
    console.error('[Email-Fehler] Fehler beim Senden:', error);
  }
};

// === TEMPORÄRER SPEICHER ===
let shopfloorData = {};

// === API ENDPUNKTE ===

app.get('/api/status', (req, res) => {
  res.json(shopfloorData);
});

app.post('/api/status', (req, res) => {
  const { machineId, criterion, status, note, author } = req.body;
  
  if (!machineId || !criterion || !status) {
    return res.status(400).json({ error: "Fehlende Daten (machineId, criterion, status erforderlich)" });
  }

  const key = `${machineId}-${criterion}`;

  // Vorherigen Status merken, um Fehlalarme bei doppelten Klicks/reinen Notiz-Updates zu vermeiden
  const previousStatus = shopfloorData[key] ? shopfloorData[key].status : "green";

  // Falls der Eintrag noch nicht existiert, neu anlegen
  if (!shopfloorData[key]) {
    shopfloorData[key] = { status: "green", notes: [] };
  }

  // Status aktualisieren
  shopfloorData[key].status = status;

  // Wenn eine Notiz mitgeschickt wurde
  if (note && note.trim() !== "") {
    shopfloorData[key].notes.push({
      author: author || "Mitarbeiter",
      text: note,
      timestamp: new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })
    });
  }

  console.log(`[Update] ${key} gesetzt auf ${status}. Notizen-Anzahl: ${shopfloorData[key].notes.length}`);

  // TRIGGER: E-Mail nur abschicken, wenn der neue Status ROT ist und er vorher NICHT rot war
  if (status === 'red' && previousStatus !== 'red') {
    // "Fire & Forget" im Hintergrund starten, damit das Frontend nicht blockiert
    sendStatusAlert(machineId, criterion, note, author);
  }
  
  res.json({ success: true, updatedNode: shopfloorData[key] });
});

// Test-Route für den Browser
app.get('/', (req, res) => {
  res.send('<h1>FactoryAI API-Server läuft!</h1><p>Bereit für die Verbindung mit dem Frontend.</p>');
});

// Server starten
app.listen(PORT, () => {
  console.log(`Server erfolgreich gestartet auf Port ${PORT}`);
});
