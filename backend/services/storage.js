// =========================================================================
// SPEICHER – liest und schreibt shopfloor_storage.json
// -------------------------------------------------------------------------
// Sicherheitsregeln für bestehende Daten:
//   • Vor der ersten Umwandlung auf ein neues Datenformat wird eine Kopie
//     der Datei angelegt (shopfloor_storage.backup-v1-<Zeit>.json).
//   • Geschrieben wird zuerst in eine temporäre Datei, die dann umbenannt
//     wird. Ein Absturz mitten im Schreiben zerstört so nie die Hauptdatei.
// =========================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { upgradeTicket, TICKET_SCHEMA_VERSION } from './actionService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STORAGE_DIR = path.join(__dirname, '..', 'shopfloor_data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'shopfloor_storage.json');

const DEFAULT_DATA = {
  drehen: {
    name: 'Gruppe Drehen',
    machines: ['12766', '12768', '12769', '12774'],
    criteria: ['Maschine', 'Qualität', 'Material', 'AVOR', 'Personal', 'Systemfehler/Shopfloor', 'Werkzeug', 'Neuteil 0%', 'Programme', 'Messen (anmelden)', 'Vorrichtung', 'Messmittel'],
    cells: {},
    historyLog: []
  },
  schleifen: {
    name: 'Gruppe Schleifen',
    machines: ['13402', '13404', '13503', '13507', '13509', '13510', '13602', '13704', '13750'],
    criteria: ['Maschine', 'Qualität', 'Material', 'AVOR', 'DISPO', 'Personal', 'Messmittel', 'Messen (anmelden)', 'Vorrichtung'],
    cells: {},
    historyLog: []
  },
  _system: { nextActionId: 1, schemaVersion: TICKET_SCHEMA_VERSION },
  _actions: {}
};

let memoryCache = null;

// Gruppen (Panels) sind alle Einträge, die nicht mit "_" beginnen
export const isPanelKey = (key) => !key.startsWith('_');
export const getPanelKeys = (data) => Object.keys(data).filter(isPanelKey);

function cleanOldHistory(panel) {
  if (!panel || !Array.isArray(panel.historyLog)) return;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  panel.historyLog = panel.historyLog.filter((log) => log.timestampMs > dayAgo);
}

function writeFileSafely(data) {
  const tmp = `${STORAGE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, STORAGE_FILE);
}

// Ältere Datenstände auf das aktuelle Format bringen – mit Sicherungskopie
function upgradeIfNeeded(data) {
  if ((data._system.schemaVersion || 1) >= TICKET_SCHEMA_VERSION) return;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(STORAGE_DIR, `shopfloor_storage.backup-v1-${stamp}.json`);
  fs.copyFileSync(STORAGE_FILE, backup);
  console.log(`Sicherungskopie vor Datenumwandlung angelegt: ${backup}`);

  Object.values(data._actions).forEach(upgradeTicket);
  data._system.schemaVersion = TICKET_SCHEMA_VERSION;
  writeFileSafely(data);
}

export function loadData() {
  if (memoryCache) return memoryCache;
  try {
    if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
    if (!fs.existsSync(STORAGE_FILE)) {
      memoryCache = structuredClone(DEFAULT_DATA);
      writeFileSafely(memoryCache);
      return memoryCache;
    }
    const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    data._system = data._system || { nextActionId: 1 };
    data._actions = data._actions || {};
    getPanelKeys(data).forEach((key) => cleanOldHistory(data[key]));
    upgradeIfNeeded(data);

    memoryCache = data;
    return data;
  } catch (err) {
    console.error('Fehler beim Laden der Daten, Arbeitsspeicher-Stand wird verwendet:', err);
    return memoryCache || structuredClone(DEFAULT_DATA);
  }
}

export function saveData(data) {
  memoryCache = data;
  try {
    writeFileSafely(data);
  } catch (err) {
    console.error('Fehler beim Schreiben der Daten:', err);
  }
}
