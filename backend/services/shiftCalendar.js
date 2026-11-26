// =========================================================================
// SCHICHTKALENDER – reine Rechenfunktionen, kein Zugriff auf Daten oder API
// -------------------------------------------------------------------------
// Beantwortet zwei Fragen:
//   1. Wie viel Arbeitszeit liegt zwischen zwei Zeitpunkten?
//   2. Wann ist eine bestimmte Menge Arbeitszeit erreicht?
// Gerechnet wird immer in Schweizer Ortszeit, auch wenn der Server (z. B.
// Render) in UTC läuft. Sommer-/Winterzeit wird berücksichtigt.
// =========================================================================

import {
  TIME_ZONE,
  SHIFT_CALENDARS,
  DEFAULT_CALENDAR,
  WORKDAYS,
  FIXED_HOLIDAYS,
  EASTER_HOLIDAYS,
  COMPANY_HOLIDAYS
} from '../config/calendar.js';

const MINUTE = 60 * 1000;
const MAX_DAYS = 3660; // Schutz gegen Endlosschleifen (10 Jahre)

// --- Zeitzone -------------------------------------------------------------

const zurichFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

// Zeitpunkt → { year, month, day, hour, minute, second } in Zürcher Ortszeit
function zurichParts(ms) {
  const parts = {};
  for (const p of zurichFormat.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return parts;
}

// Abstand Ortszeit – UTC in ms (+1 h im Winter, +2 h im Sommer)
function zurichOffset(ms) {
  const whole = Math.floor(ms / 1000) * 1000;
  const p = zurichParts(whole);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - whole;
}

// Zürcher Ortszeit (Datum + Minuten seit Mitternacht) → Zeitpunkt in ms
function zurichToMs(day, minutesOfDay) {
  const guess = Date.UTC(day.year, day.month - 1, day.day, 0, minutesOfDay);
  const first = guess - zurichOffset(guess);
  return guess - zurichOffset(first);
}

// --- Kalendertage -----------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;

function dayOf(ms) {
  const p = zurichParts(ms);
  return { year: p.year, month: p.month, day: p.day };
}

function nextDay(d) {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + 1));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

function weekday(d) {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

// Ostersonntag nach der gregorianischen Osterformel (Meeus/Jones/Butcher)
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

const holidayCache = new Map();

// Alle gesetzlichen Feiertage eines Jahres: Map "JJJJ-MM-TT" → Bezeichnung
export function holidaysOf(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const map = new Map();
  for (const h of FIXED_HOLIDAYS) map.set(`${year}-${h.date}`, h.label);
  const easter = easterSunday(year);
  for (const h of EASTER_HOLIDAYS) {
    const t = new Date(Date.UTC(year, easter.month - 1, easter.day + h.offset));
    map.set(`${year}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`, h.label);
  }
  holidayCache.set(year, map);
  return map;
}

function isCompanyHoliday(key) {
  return COMPANY_HOLIDAYS.some((p) => key >= p.from && key <= p.to);
}

export function isWorkingDay(d) {
  if (!WORKDAYS.includes(weekday(d))) return false;
  const key = dayKey(d);
  return !holidaysOf(d.year).has(key) && !isCompanyHoliday(key);
}

// --- Kalender ---------------------------------------------------------------

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function resolveCalendarId(id) {
  return SHIFT_CALENDARS[id] ? id : DEFAULT_CALENDAR;
}

function windowOf(calendarId) {
  const cal = SHIFT_CALENDARS[resolveCalendarId(calendarId)];
  return { start: toMinutes(cal.start), end: toMinutes(cal.end) };
}

// Länge eines Arbeitstags in ms (Einschicht 10 h, Zweischicht 17,5 h)
export function dayLengthMs(calendarId) {
  const w = windowOf(calendarId);
  return (w.end - w.start) * MINUTE;
}

// --- Die beiden Kernfunktionen ----------------------------------------------

// Arbeitszeit in ms zwischen zwei Zeitpunkten
export function workingMsBetween(fromMs, toMs, calendarId) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 0;
  const w = windowOf(calendarId);
  const lastKey = dayKey(dayOf(toMs));
  let d = dayOf(fromMs);
  let total = 0;

  for (let i = 0; i < MAX_DAYS && dayKey(d) <= lastKey; i++) {
    if (isWorkingDay(d)) {
      const start = Math.max(zurichToMs(d, w.start), fromMs);
      const end = Math.min(zurichToMs(d, w.end), toMs);
      if (end > start) total += end - start;
    }
    d = nextDay(d);
  }
  return total;
}

// Zeitpunkt, an dem ab fromMs genau neededMs Arbeitszeit erreicht sind
export function reachWorkingMs(fromMs, neededMs, calendarId) {
  if (!Number.isFinite(fromMs)) return null;
  if (neededMs <= 0) return fromMs;
  const w = windowOf(calendarId);
  let rest = neededMs;
  let d = dayOf(fromMs);

  for (let i = 0; i < MAX_DAYS; i++) {
    if (isWorkingDay(d)) {
      const start = Math.max(zurichToMs(d, w.start), fromMs);
      const end = zurichToMs(d, w.end);
      if (end > start) {
        if (end - start >= rest) return start + rest;
        rest -= end - start;
      }
    }
    d = nextDay(d);
  }
  return null;
}
