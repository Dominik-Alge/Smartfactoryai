// =========================================================================
// SCHICHT-PUNKTE – Status je Schicht für geteilte Kriterien (z. B. Personal)
// -------------------------------------------------------------------------
// Eine Zelle einer Zweischicht-Maschine kann je Schicht einen Zustand haben:
//   green = besetzt / ok,  red = fehlt / Störung,  off = nicht besetzt (grau)
// Der Gesamtstatus der Zelle (cell.status) ist ROT, sobald eine Schicht rot
// ist. So funktionieren Cockpit, Insel-Sicht und Tickets unverändert weiter.
// =========================================================================

import { SHIFT_SPLIT_CRITERIA, SHIFTS } from '../config/calendar.js';
import { resolveCalendarId } from './shiftCalendar.js';

export const SHIFT_STATES = ['green', 'red', 'off'];
export const shiftLabel = (id) => SHIFTS.find((s) => s.id === id)?.label || id;

export function isSplitCell(panel, machineId, criterion) {
  return (
    SHIFT_SPLIT_CRITERIA.includes(criterion) &&
    resolveCalendarId(panel?.machineCalendars?.[machineId]) === 'zweischicht'
  );
}

// Setzt den Zustand einer Schicht und leitet daraus den Gesamtstatus ab
export function applyShiftStatus(cell, shiftId, state) {
  // Fehlende Schichtangaben übernehmen den bisherigen Zellstatus (alte Daten vor dem Update)
  const fallback = cell.status === 'red' ? 'red' : 'green';
  cell.shifts = { ...Object.fromEntries(SHIFTS.map((s) => [s.id, fallback])), ...(cell.shifts || {}) };
  cell.shifts[shiftId] = state;
  cell.status = Object.values(cell.shifts).includes('red') ? 'red' : 'green';
  return cell;
}
