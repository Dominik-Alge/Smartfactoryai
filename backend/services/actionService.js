// =========================================================================
// TICKET-MODELL
// -------------------------------------------------------------------------
// Aufbau eines Tickets, Umwandlung alter Tickets (Version 1) und die Regeln,
// wann ein Ticket in die nächste Phase darf. Kein Zugriff auf Express oder
// Dateien – nur Funktionen, die ein Ticket-Objekt lesen oder verändern.
// =========================================================================

import { PHASES, CLOSED_STATUS } from '../config/actionFlow.js';
import { levelName, levelIndex } from './escalation.js';

export const TICKET_SCHEMA_VERSION = 2;

const nowIso = () => new Date().toISOString();
const phaseIndex = (id) => PHASES.findIndex((p) => p.id === id);
const phaseLabel = (id) => PHASES[phaseIndex(id)]?.label || id;

export function generateActionId(data) {
  if (!data._system) data._system = {};
  if (!data._system.nextActionId) data._system.nextActionId = 1;
  const id = `ACT-${String(data._system.nextActionId).padStart(6, '0')}`;
  data._system.nextActionId++;
  return id;
}

// Neues Ticket, wenn eine Zelle auf ROT gesetzt wird
export function createTicket({ id, title, panelId, machineId, criterion, note, author }) {
  const now = nowIso();
  const ticket = {
    id,
    schemaVersion: TICKET_SCHEMA_VERSION,
    type: 'shopfloor',
    title,
    description: note || '',
    panelId: String(panelId),
    machineId: String(machineId),
    criterion: String(criterion),
    source: { panelId: String(panelId), machineId: String(machineId), criterion: String(criterion) },
    creator: author || 'Terminal',
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    phase: PHASES[0].id,
    status: PHASES[0].label,
    escalationLevel: levelName(0),
    escalation: { history: [], dismissed: null },
    containment: '',
    whys: [],
    cause: '',
    tasks: [],
    effectiveness: null,
    lessonsLearned: '',
    history: []
  };
  addHistory(ticket, 'created', author, 'Ticket automatisch erstellt (Zelle ROT)');
  return ticket;
}

export function addHistory(ticket, event, user, details = '') {
  if (!Array.isArray(ticket.history)) ticket.history = [];
  ticket.updatedAt = nowIso();
  ticket.history.push({ event, user: user || 'Unbekannt', timestamp: ticket.updatedAt, details });
}

// Bringt ein Ticket aus Version 1 auf den aktuellen Aufbau.
// Es werden nur Felder ERGÄNZT – vorhandene Inhalte bleiben unverändert.
export function upgradeTicket(t) {
  if (t.schemaVersion === TICKET_SCHEMA_VERSION) return t;

  const legacyPhase = {
    new: 'sofort',
    Analyse: 'sofort',
    Massnahmen: 'massnahme',
    KVP: 'standard',
    [CLOSED_STATUS]: 'standard'
  };

  t.panelId = t.panelId ?? t.source?.panelId ?? null;
  t.machineId = String(t.machineId ?? t.source?.machineId ?? '');
  t.criterion = t.criterion ?? t.source?.criterion ?? '';
  t.createdAt = t.createdAt || nowIso();
  t.updatedAt = t.updatedAt || t.createdAt;
  t.phase = t.phase || legacyPhase[t.status] || 'sofort';
  t.escalationLevel = levelName(levelIndex(t.escalationLevel));
  t.escalation = t.escalation || { history: [], dismissed: null };
  t.containment = t.containment || '';
  t.whys = Array.isArray(t.whys) ? t.whys : [];
  t.cause = t.cause || '';
  t.tasks = (t.tasks || []).map((task) => ({ due: null, createdAt: null, doneAt: null, ...task }));
  t.effectiveness = t.effectiveness || null;
  t.lessonsLearned = t.lessonsLearned || '';
  t.history = Array.isArray(t.history) ? t.history : [];

  if (t.status === CLOSED_STATUS) {
    t.closedAt = t.closedAt || t.updatedAt;
  } else {
    t.closedAt = null;
    t.status = phaseLabel(t.phase);
  }
  t.schemaVersion = TICKET_SCHEMA_VERSION;
  return t;
}

// --- Phasen -----------------------------------------------------------------

// Darf das Ticket in die nächste Phase? Liefert den Grund, falls nicht.
export function checkAdvance(t) {
  switch (t.phase) {
    case 'sofort':
      return t.containment.trim() ? null : 'Beschreibe zuerst die Sofortmassnahme.';
    case 'ursache':
      return t.cause.trim() ? null : 'Halte zuerst die wahre Ursache fest.';
    case 'massnahme':
      if (t.tasks.length === 0) return 'Lege mindestens eine Abstellmassnahme an.';
      return t.tasks.every((x) => x.status === 'completed') ? null : 'Erledige zuerst alle offenen Massnahmen.';
    case 'wirksamkeit':
      return t.effectiveness?.result === 'wirksam' ? null : 'Bestätige zuerst, dass die Massnahme wirksam ist.';
    case 'standard':
      return t.lessonsLearned.trim() ? null : 'Halte zuerst die Lessons Learned fest.';
    default:
      return 'Unbekannte Phase.';
  }
}

function setPhase(t, phaseId) {
  t.phase = phaseId;
  t.status = phaseLabel(phaseId);
}

// Nächste Phase oder – nach "Standard" – Ticket abschliessen
export function advancePhase(t, author) {
  const reason = checkAdvance(t);
  if (reason) return reason;

  const i = phaseIndex(t.phase);
  if (i === PHASES.length - 1) {
    t.status = CLOSED_STATUS;
    t.closedAt = nowIso();
    addHistory(t, 'closed', author, 'Lernschleife geschlossen');
  } else {
    setPhase(t, PHASES[i + 1].id);
    addHistory(t, 'phase', author, `Weiter zu "${phaseLabel(t.phase)}"`);
  }
  return null;
}

export function backPhase(t, author) {
  const i = phaseIndex(t.phase);
  if (t.closedAt || i <= 0) return 'Das Ticket ist bereits in der ersten Phase oder geschlossen.';
  setPhase(t, PHASES[i - 1].id);
  addHistory(t, 'phase', author, `Zurück zu "${phaseLabel(t.phase)}"`);
  return null;
}

// Ergebnis der Wirksamkeitsprüfung. "nicht wirksam" → zurück zur Ursache.
export function recordEffectiveness(t, { result, note, author }) {
  if (t.phase !== 'wirksamkeit') return 'Die Wirksamkeit wird in der Phase "Wirksamkeit" geprüft.';
  if (!['wirksam', 'nicht_wirksam'].includes(result)) return 'Unbekanntes Ergebnis.';

  t.effectiveness = { result, note: note || '', by: author || 'Unbekannt', at: nowIso() };
  if (result === 'nicht_wirksam') {
    setPhase(t, 'ursache');
    addHistory(t, 'effectiveness', author, `Nicht wirksam – zurück zur Ursache. ${note || ''}`.trim());
  } else {
    addHistory(t, 'effectiveness', author, `Wirksam bestätigt. ${note || ''}`.trim());
  }
  return null;
}

// --- Eskalation ---------------------------------------------------------------

export function changeLevel(t, { direction, reason, author }) {
  if (!reason || !reason.trim()) return 'Bitte eine Begründung angeben.';
  const from = levelIndex(t.escalationLevel);
  const to = direction === 'up' ? from + 1 : from - 1;
  if (to < 0 || levelName(to) === t.escalationLevel) return 'Diese Stufe gibt es nicht.';

  t.escalationLevel = levelName(to);
  t.escalation.dismissed = null;
  t.escalation.history.push({ from, to, reason: reason.trim(), by: author || 'Unbekannt', at: nowIso() });
  addHistory(t, direction === 'up' ? 'escalated' : 'deescalated', author, `${levelName(from)} → ${levelName(to)}: ${reason.trim()}`);
  return null;
}

// Vorschlag begründet ablehnen. Gilt, bis die nächste Stufe fällig wird.
export function dismissSuggestion(t, { reason, dueLevel, author }) {
  if (!reason || !reason.trim()) return 'Bitte begründen, warum nicht eskaliert wird.';
  t.escalation.dismissed = { dueLevel, reason: reason.trim(), by: author || 'Unbekannt', at: nowIso() };
  addHistory(t, 'escalation_dismissed', author, `Nicht eskaliert: ${reason.trim()}`);
  return null;
}
