// =========================================================================
// UMGEBUNGSVARIABLEN AUS backend/.env LADEN
// -------------------------------------------------------------------------
// Auf dem Windows-Server stehen Zugangsdaten (z. B. SMTP) in backend/.env.
// Diese Datei wird hier eingelesen, bevor andere Module starten.
// Bereits gesetzte Variablen (z. B. auf Render) werden nicht überschrieben.
// Die Datei .env gehört nie ins Repository (siehe .gitignore).
// =========================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!match || line.trim().startsWith('#')) continue;
    const [, key, raw] = match;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
  console.log('Einstellungen aus backend/.env geladen.');
}
