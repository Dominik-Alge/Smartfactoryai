// =========================================================================
// ESKALATION & WIEDERHOLFÄLLE
// -------------------------------------------------------------------------
// Alle Regeln stehen hier zentral und können angepasst werden.
// =========================================================================

export const ESCALATION_LEVELS = [
  'Shopfloor (Lvl 1)',
  'Gruppenleitung (Lvl 2)',
  'Inselleitung (Lvl 3)',
  'Produktionsleitung (Lvl 4)'
];

// Schwellen in Stunden AKTIVER Störungszeit (Zelle rot), ab Meldung gezählt.
// Index = Stufe (1 = Lvl 2, 2 = Lvl 3, 3 = Lvl 4)
export const ESCALATION_RULES = {
  normal: { 1: 4, 2: 16, 3: 72 },      // Gruppenleitung 4 h, Inselleitung 2 Schichten, Produktionsleitung 3 Tage
  machineDown: { 1: 2, 2: 8, 3: 36 }   // Maschine steht: halbe Zeit
};

// false = nur Montag–Freitag zählen (Wochenende pausiert die Uhr)
export const COUNT_WEEKENDS = false;

// Wiederholfall: gleiche Maschine + gleiches Kriterium innerhalb dieser Tage
export const RECURRENCE_WINDOW_DAYS = 90;

const HOUR = 3600000;
const DAY = 24 * HOUR;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Versteht neue und alte Bezeichnungen ("Schichtleitung (Lvl 2)" → Index 1)
export function levelIndex(name) {
  if (!name) return 0;
  const m = String(name).match(/Lvl\s*(\d)/i);
  if (m) return clamp(Number(m[1]) - 1, 0, ESCALATION_LEVELS.length - 1);
  const i = ESCALATION_LEVELS.indexOf(name);
  return i < 0 ? 0 : i;
}
export const levelName = (idx) => ESCALATION_LEVELS[clamp(idx, 0, ESCALATION_LEVELS.length - 1)];

// Zeit zwischen zwei Zeitpunkten, optional ohne Wochenenden (lokale Serverzeit)
export function workingMs(fromMs, toMs) {
  if (!fromMs || toMs <= fromMs) return 0;
  if (COUNT_WEEKENDS) return toMs - fromMs;
  let total = 0;
  let cur = fromMs;
  while (cur < toMs) {
    const d = new Date(cur);
    const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const end = Math.min(nextMidnight, toMs);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) total += end - cur;
    cur = end;
  }
  return total;
}

// ---- Uhr pro Ticket: läuft nur, solange die Zelle rot ist ----
export function startClock(t, nowMs) {
  if (!t.clock) t.clock = { activeMs: 0, runningSince: null, offsetMs: 0 };
  if (!t.clock.runningSince) t.clock.runningSince = new Date(nowMs).toISOString();
}
export function stopClock(t, nowMs) {
  if (t.clock?.runningSince) {
    t.clock.activeMs += workingMs(Date.parse(t.clock.runningSince), nowMs);
    t.clock.runningSince = null;
  }
}
export function activeMs(t, nowMs) {
  const c = t.clock;
  if (!c) return 0;
  return c.activeMs + (c.runningSince ? workingMs(Date.parse(c.runningSince), nowMs) : 0);
}

const rulesFor = (t) => (t.machineDown ? ESCALATION_RULES.machineDown : ESCALATION_RULES.normal);
const thresholdMs = (t, idx) => (idx <= 0 ? 0 : rulesFor(t)[idx] * HOUR);

export function targetLevelIndex(t, nowMs) {
  const effective = activeMs(t, nowMs) - (t.clock?.offsetMs || 0);
  let idx = 0;
  for (let i = 1; i < ESCALATION_LEVELS.length; i++) {
    if (effective >= thresholdMs(t, i)) idx = i;
  }
  return idx;
}

// Info für die Oberfläche (wird nicht gespeichert)
export function escalationInfo(t, nowMs) {
  const idx = levelIndex(t.escalationLevel);
  const effective = activeMs(t, nowMs) - (t.clock?.offsetMs || 0);
  const next = idx + 1 < ESCALATION_LEVELS.length ? idx + 1 : null;
  return {
    levelIndex: idx,
    activeHours: Math.round((activeMs(t, nowMs) / HOUR) * 10) / 10,
    running: !!t.clock?.runningSince,
    nextLevel: next != null ? levelName(next) : null,
    nextInHours: next != null ? Math.max(0, Math.round(((thresholdMs(t, next) - effective) / HOUR) * 10) / 10) : null
  };
}

// Manuelles Zurückstufen: Uhr so verschieben, dass die Automatik ab der neuen Stufe weiterzählt
export function alignClockToLevel(t, idx, nowMs) {
  if (!t.clock) t.clock = { activeMs: 0, runningSince: null, offsetMs: 0 };
  t.clock.offsetMs = activeMs(t, nowMs) - thresholdMs(t, idx);
}

// Hebt offene Tickets automatisch an (senkt nie). Gibt true zurück, wenn etwas geändert wurde.
export function applyAutoEscalation(data, nowMs = Date.now()) {
  let changed = false;
  Object.values(data._actions || {}).forEach((t) => {
    if (t.status === 'Geschlossen') return;
    const cur = levelIndex(t.escalationLevel);
    const target = targetLevelIndex(t, nowMs);
    if (target > cur) {
      const ts = new Date(nowMs).toISOString();
      t.escalationLevel = levelName(target);
      t.escalatedAt = ts;
      t.autoEscalated = true;
      t.updatedAt = ts;
      if (!Array.isArray(t.history)) t.history = [];
      t.history.push({
        event: 'auto_escalated',
        user: 'System',
        timestamp: ts,
        details: `Automatisch eskaliert auf ${t.escalationLevel} (aktive Störungszeit ${(activeMs(t, nowMs) / HOUR).toFixed(1)} h${
          t.machineDown ? ', Maschine steht' : ''
        })`
      });
      changed = true;
    }
  });
  return changed;
}

// Mögliche Vorgängerfälle (gleiche Maschine + Kriterium, innerhalb des Zeitfensters)
export function findRecurrenceCandidates(data, ticket, nowMs = Date.now()) {
  const since = nowMs - RECURRENCE_WINDOW_DAYS * DAY;
  const createdMs = Date.parse(ticket.createdAt) || nowMs;
  return Object.values(data._actions || {})
    .filter(
      (o) =>
        o.id !== ticket.id &&
        String(o.machineId) === String(ticket.machineId) &&
        o.criterion === ticket.criterion &&
        (Date.parse(o.createdAt) || 0) >= since &&
        (Date.parse(o.createdAt) || 0) < createdMs
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3)
    .map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      createdAt: o.createdAt,
      closedAt: o.closedAt || null,
      cause: o.cause || '',
      lessonsLearned: o.lessonsLearned || ''
    }));
}

// Sucht die Ampel-Zelle eines Tickets (für Altdaten ohne panelId über die Maschine)
export function findCellForTicket(data, t) {
  const key = `${t.machineId}-${t.criterion}`;
  const panelKeys = Object.keys(data).filter((k) => !k.startsWith('_'));
  if (t.panelId && data[t.panelId]?.cells) return data[t.panelId].cells[key] || null;
  for (const pk of panelKeys) {
    const p = data[pk];
    if (p?.machines?.map(String).includes(String(t.machineId))) return p.cells?.[key] || null;
  }
  return null;
}

export function findPanelIdForTicket(data, t) {
  if (t.panelId && data[t.panelId]) return t.panelId;
  const pk = Object.keys(data)
    .filter((k) => !k.startsWith('_'))
    .find((k) => data[k]?.machines?.map(String).includes(String(t.machineId)));
  return pk || null;
}

// Einmalige Bereinigung beim Laden: alte Stufennamen, fehlende Felder, Uhr nachrüsten
export function migrateTickets(data) {
  let changed = false;
  Object.values(data._actions || {}).forEach((t) => {
    const norm = levelName(levelIndex(t.escalationLevel));
    if (t.escalationLevel !== norm) {
      t.escalationLevel = norm;
      changed = true;
    }
    if (t.status === 'new') {
      t.status = Array.isArray(t.tasks) && t.tasks.length ? 'Massnahmen' : 'Analyse';
      changed = true;
    }
    if (!Array.isArray(t.tasks)) { t.tasks = []; changed = true; }
    if (t.cause == null) { t.cause = ''; changed = true; }
    if (t.lessonsLearned == null) { t.lessonsLearned = ''; changed = true; }
    if (!t.panelId) {
      const pid = findPanelIdForTicket(data, t);
      if (pid) { t.panelId = pid; changed = true; }
    }
    if (!t.clock) {
      const cell = findCellForTicket(data, t);
      const running = t.status !== 'Geschlossen' && cell?.status === 'red';
      t.clock = { activeMs: 0, runningSince: running ? t.createdAt || new Date().toISOString() : null, offsetMs: 0 };
      // bestehende Stufe beibehalten (Automatik hebt nur an)
      changed = true;
    }
  });
  return changed;
}
