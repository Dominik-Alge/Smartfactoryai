// =========================================================================
// SCHICHTEN – gemeinsame Regeln für Panel und Cockpit
// -------------------------------------------------------------------------
// Muss mit backend/config/calendar.js übereinstimmen (SHIFT_SPLIT_CRITERIA,
// SHIFTS). Zweischicht-Maschinen zeigen bei diesen Kriterien je Schicht
// einen eigenen Punkt: grün = besetzt, rot = fehlt, grau = nicht besetzt.
// =========================================================================

export const SHIFT_SPLIT_CRITERIA = ['Personal'];
export const SHIFTS = [
  { id: 'frueh', short: 'F', label: 'Frühschicht' },
  { id: 'spaet', short: 'S', label: 'Spätschicht' }
];

const DEFAULT_CALENDAR = 'zweischicht'; // wie backend/config/calendar.js

export const calendarOf = (machineCalendars, machineId) => machineCalendars?.[machineId] || DEFAULT_CALENDAR;
export const isTwoShift = (machineCalendars, machineId) => calendarOf(machineCalendars, machineId) === 'zweischicht';
export const isSplit = (machineCalendars, machineId, criterion) =>
  SHIFT_SPLIT_CRITERIA.includes(criterion) && isTwoShift(machineCalendars, machineId);

// Zustand einer Schicht: 'green' | 'red' | 'off'
export const shiftState = (cell, shiftId) => cell?.shifts?.[shiftId] || 'green';
export const shiftLabel = (shiftId) => SHIFTS.find((s) => s.id === shiftId)?.label || '';
