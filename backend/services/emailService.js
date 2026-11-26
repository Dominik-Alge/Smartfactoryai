// =========================================================================
// E-MAIL – Alarm bei ROT und Benachrichtigung bei Eskalation
// -------------------------------------------------------------------------
// Zugangsdaten kommen ausschliesslich aus Umgebungsvariablen:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
// Ohne SMTP_HOST werden keine Mails verschickt (z. B. auf Render, oder solange
// die IT den Versand nicht freigibt). Jede Mail – verschickt oder nicht –
// landet im Postausgang (die letzten 30, nur im Arbeitsspeicher). Dort kann
// man sie in der Action Engine als Vorschau ansehen.
// Ein Mailfehler bricht nie eine Speicherung ab.
// =========================================================================

import nodemailer from 'nodemailer';
import { criterionContacts, escalationContacts } from '../config/notifications.js';

const SENDER = process.env.SMTP_USER || 'shopfloor-alert@bruderer.com';
const APP_URL = process.env.APP_URL || '';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_PASS ? { user: SENDER, pass: process.env.SMTP_PASS } : undefined
    })
  : null;

// Benutzereingaben dürfen kein HTML in die Mail einschleusen
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// --- Postausgang -------------------------------------------------------------

const OUTBOX_SIZE = 30;
const outbox = [];

export const mailEnabled = () => Boolean(transporter);
export const getOutbox = () => outbox;

function record(entry) {
  outbox.unshift(entry);
  outbox.length = Math.min(outbox.length, OUTBOX_SIZE);
  return entry;
}

async function send({ to, subject, html, kind }) {
  if (!to) return null;
  const entry = record({
    id: `M-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    kind,
    to,
    subject,
    html,
    status: transporter ? 'wird gesendet' : 'nicht verschickt (Mailversand nicht freigegeben)'
  });
  if (!transporter) {
    console.log(`[Mail deaktiviert] an ${to}: ${subject}`);
    return entry;
  }
  try {
    await transporter.sendMail({ from: `"FactoryAI Shopfloor" <${SENDER}>`, to, subject, html });
    entry.status = 'gesendet';
    console.log(`Mail an ${to} gesendet: ${subject}`);
  } catch (error) {
    entry.status = `Fehler: ${error.message}`;
    console.error('Fehler beim Senden der Mail:', error.message);
  }
  return entry;
}

function frame(color, heading, rows, quote) {
  const tableRows = rows
    .map(([k, v]) => `<tr><td style="padding:6px 8px;font-weight:bold;border-bottom:1px solid #e2e8f0">${esc(k)}</td><td style="padding:6px 8px;border-bottom:1px solid #e2e8f0">${esc(v)}</td></tr>`)
    .join('');
  const link = APP_URL ? `<p><a href="${esc(APP_URL)}">Im Shopfloor-Panel öffnen</a></p>` : '';
  return `<div style="font-family:Arial,sans-serif;border:2px solid ${color};border-radius:8px;padding:20px;max-width:600px">
    <h2 style="color:${color};margin-top:0">${esc(heading)}</h2>
    <table style="width:100%;border-collapse:collapse;margin:12px 0">${tableRows}</table>
    ${quote ? `<div style="background:#f8fafc;border-left:4px solid ${color};padding:10px"><em>${esc(quote)}</em></div>` : ''}
    ${link}
    <p style="font-size:12px;color:#64748b;margin-top:20px">Automatisch erzeugt vom FactoryAI Shopfloor-System.</p>
  </div>`;
}

export function sendStatusAlert(machineId, criterion, note, author) {
  const contact = criterionContacts[criterion];
  if (!contact) return;
  return send({
    kind: 'Alarm ROT',
    to: contact.email,
    subject: `Shopfloor: Status ROT bei ${machineId} (${criterion})`,
    html: frame('#ef4444', 'Shopfloor Alert – Status ROT', [
      ['Maschine', machineId],
      ['Kriterium', `${criterion} (${contact.label})`],
      ['Gemeldet von', author || 'Terminal']
    ], note || 'Keine Beschreibung')
  });
}

export function sendEscalationMail(ticket, toLevel, reason, author) {
  const contact = escalationContacts[toLevel];
  if (!contact) return;
  return send({
    kind: 'Eskalation',
    to: contact.email,
    subject: `Eskalation an ${contact.label}: ${ticket.id} – Maschine ${ticket.machineId}`,
    html: frame('#f59e0b', `Ticket an ${contact.label} eskaliert`, [
      ['Ticket', ticket.id],
      ['Vorfall', ticket.title],
      ['Maschine', ticket.machineId],
      ['Phase', ticket.status],
      ['Eskaliert von', author || 'Unbekannt']
    ], `Begründung: ${reason}`)
  });
}
