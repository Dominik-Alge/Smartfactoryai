const express = require('express');
const cors = require('cors');

const app = express();
// Render vergibt automatisch einen Port, lokal nutzen wir 10000
const PORT = process.env.PORT || 10000;

// Erlaubt dem Frontend (das auf einer anderen URL läuft), mit dem Backend zu sprechen
app.use(cors());
app.use(express.json());

// === TEMPORÄRER SPEICHER (Wird später durch PostgreSQL ersetzt) ===
// Hier speichern wir die Stati der Maschinen und die Notizen
let shopfloorData = {
  // Struktur: "MaschinenID-Kriterium": { status: "green"/"red", notes: [] }
};

// === API ENDPUNKTE ===

// 1. Alle aktuellen Zustände abrufen
app.get('/api/status', (req, res) => {
  res.json(shopfloorData);
});

// 2. Status ändern (z.B. von Grün auf Rot) und Notiz hinzufügen
app.post('/api/status', (req, res) => {
  const { machineId, criterion, status, note, author } = req.body;
  
  if (!machineId || !criterion || !status) {
    return res.status(400).json({ error: "Fehlende Daten (machineId, criterion, status erforderlich)" });
  }

  const key = `${machineId}-${criterion}`;

  // Falls der Eintrag noch nicht existiert, neu anlegen
  if (!shopfloorData[key]) {
    shopfloorData[key] = { status: "green", notes: [] };
  }

  // Status aktualisieren
  shopfloorData[key].status = status;

  // Wenn eine Notiz mitgeschickt wurde (besonders wichtig bei Status "red")
  if (note && note.trim() !== "") {
    shopfloorData[key].notes.push({
      author: author || "Mitarbeiter",
      text: note,
      timestamp: new Date().toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })
    });
  }

  console.log(`[Update] ${key} gesetzt auf ${status}. Notizen-Anzahl: ${shopfloorData[key].notes.length}`);
  
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
