// =========================================================================
// ESKALATION – berechnet, welche Stufe für ein Ticket fällig ist
// -------------------------------------------------------------------------
// Reine Rechenfunktionen. Das Ergebnis ist immer ein VORSCHLAG; geändert
// wird die Stufe nur über die API (bestätigen oder begründet ablehnen).
// =========================================================================

import { ESCALATION_LEVELS, LEGACY_LEVEL_NAMES } from '../config/escalation.js';
import { workingMsBetween, reachWorkingMs, dayLengthMs } from './shiftCalendar.js';

const HOUR = 60 * 60 * 1000;
const LAST = ESCALATION_LEVELS.length - 1;
const clamp = (i) => Math.min(LAST, Math.max(0, i));

// Stufe als Index (0 … 4). Versteht Index, neue und alte Bezeichnungen.
export function levelIndex(value) {
  if (typeof value === 'number') return clamp(value);
  if (!value) return 0;
  if (value in LEGACY_LEVEL_NAMES) return LEGACY_LEVEL_NAMES[value];
  const found = ESCALATION_LEVELS.findIndex((l) => l.name === value);
  return found >= 0 ? found : 0;
}

export const levelName = (index) => ESCALATION_LEVELS[clamp(index)].name;

// Ab wie viel Arbeitszeit (ms) eine Stufe fällig ist
export function thresholdMs(index, calendarId) {
  const after = ESCALATION_LEVELS[clamp(index)].after;
  if (after.workdays != null) return after.workdays * dayLengthMs(calendarId);
  return (after.hours || 0) * HOUR;
}

/**
 * Eskalations-Lage eines Tickets.
 * @returns {{
 *   workedMs: number,        Arbeitszeit seit Meldung
 *   currentLevel: number,    aktuelle Stufe
 *   dueLevel: number,        Stufe, die nach Arbeitszeit fällig wäre
 *   suggestedLevel: number|null,  Vorschlag (nächste Stufe) oder null
 *   dismissed: object|null,  begründet abgelehnter Vorschlag
 *   nextLevel: number|null,  nächsthöhere Stufe
 *   nextAtMs: number|null,   Arbeitszeit, ab der sie fällig ist
 *   nextDueAt: string|null,  Zeitpunkt (ISO), ab dem sie fällig ist
 *   progress: number|null,   workedMs / nextAtMs (1 = 100 %)
 *   state: 'ok'|'warn'|'due'|'closed'
 * }}
 */
export function evaluateEscalation(ticket, calendarId, nowMs = Date.now()) {
  const startMs = Date.parse(ticket.createdAt);
  const closedMs = ticket.closedAt ? Date.parse(ticket.closedAt) : null;
  const workedMs = workingMsBetween(startMs, closedMs ?? nowMs, calendarId);
  const currentLevel = levelIndex(ticket.escalationLevel);

  let dueLevel = 0;
  ESCALATION_LEVELS.forEach((_, i) => {
    if (workedMs >= thresholdMs(i, calendarId)) dueLevel = i;
  });

  const nextLevel = currentLevel < LAST ? currentLevel + 1 : null;
  const nextAtMs = nextLevel != null ? thresholdMs(nextLevel, calendarId) : null;
  const progress = nextAtMs ? workedMs / nextAtMs : null;

  // Ein begründet abgelehnter Vorschlag gilt, bis die nächste Stufe fällig wird
  const dismissed = ticket.escalation?.dismissed || null;
  const isDismissed = dismissed && dismissed.dueLevel >= dueLevel;
  const suggestedLevel = !closedMs && dueLevel > currentLevel && !isDismissed ? currentLevel + 1 : null;

  let state = 'ok';
  if (closedMs) state = 'closed';
  else if (progress != null && progress >= 1) state = 'due';
  else if (progress != null && progress >= 0.5) state = 'warn';

  const dueAt = !closedMs && nextAtMs != null ? reachWorkingMs(startMs, nextAtMs, calendarId) : null;

  return {
    workedMs,
    currentLevel,
    dueLevel,
    suggestedLevel,
    dismissed: isDismissed ? dismissed : null,
    nextLevel,
    nextAtMs,
    nextDueAt: dueAt != null ? new Date(dueAt).toISOString() : null,
    progress,
    state
  };
}
