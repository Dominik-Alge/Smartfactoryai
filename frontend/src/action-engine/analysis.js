// =========================================================================
// AUSWERTUNG – reine Rechenfunktionen für "Historie & Auswertung"
// -------------------------------------------------------------------------
// Filtern, Kennzahlen, Aufschlüsselungen, Wiederholer und CSV-Export.
// Keine Darstellung – die steckt in AnalysisView.jsx.
// =========================================================================

const DAY = 24 * 3600 * 1000;

export const PERIODS = [
  { id: 'month', label: 'Aktueller Monat' },
  { id: '30', label: 'Letzte 30 Tage' },
  { id: '90', label: 'Letzte 90 Tage' },
  { id: 'year', label: 'Dieses Jahr' },
  { id: '365', label: 'Letzte 12 Monate' },
  { id: 'all', label: 'Alles' },
  { id: 'custom', label: 'Frei wählen …' }
];

export const DEFAULT_FILTERS = {
  period: '90',
  from: '',
  to: '',
  panel: 'all',
  machine: 'all',
  criterion: 'all',
  status: 'all', // all | open | closed
  minLevel: 0,
  effectiveness: 'all', // all | failed (mind. einmal "nicht wirksam")
  text: ''
};

// Wiederholer: gleiche Maschine + gleiches Kriterium innerhalb dieser Tage
export const REPEAT_WINDOW_DAYS = 90;

// --- Abgeleitete Werte je Ticket ------------------------------------------------

// Höchste je erreichte Stufe (nicht nur die aktuelle)
export const maxLevel = (t) =>
  Math.max(t.escalationInfo.currentLevel, ...(t.escalation?.history || []).map((h) => h.to));

export const wasEscalated = (t) => (t.escalation?.history || []).some((h) => h.to > h.from);

export const failedChecks = (t) =>
  (t.history || []).filter((h) => h.event === 'effectiveness' && h.details?.startsWith('Nicht wirksam')).length;

const searchText = (t) =>
  [t.id, t.title, t.machineId, t.criterion, t.containment, t.cause, t.lessonsLearned, ...(t.whys || []), ...(t.tasks || []).map((x) => `${x.title} ${x.owner}`)]
    .join(' ')
    .toLowerCase();

// --- Zeitraum ------------------------------------------------------------------------

export function periodRange(f, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (f.period) {
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case 'custom':
      return {
        from: f.from ? new Date(`${f.from}T00:00:00`) : null,
        to: f.to ? new Date(`${f.to}T23:59:59`) : now
      };
    case 'all':
      return { from: null, to: now };
    default:
      return { from: new Date(start.getTime() - (Number(f.period) - 1) * DAY), to: now };
  }
}

// --- Filtern -------------------------------------------------------------------------

export function applyFilters(tickets, f) {
  const { from, to } = periodRange(f);
  const words = f.text.toLowerCase().split(/\s+/).filter(Boolean);
  return tickets.filter((t) => {
    const created = new Date(t.createdAt);
    if (from && created < from) return false;
    if (to && created > to) return false;
    if (f.panel !== 'all' && t.panelId !== f.panel) return false;
    if (f.machine !== 'all' && t.machineId !== f.machine) return false;
    if (f.criterion !== 'all' && t.criterion !== f.criterion) return false;
    if (f.status === 'open' && t.closedAt) return false;
    if (f.status === 'closed' && !t.closedAt) return false;
    if (maxLevel(t) < f.minLevel) return false;
    if (f.effectiveness === 'failed' && failedChecks(t) === 0) return false;
    if (words.length) {
      const text = searchText(t);
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  });
}

// --- Kennzahlen ----------------------------------------------------------------------

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function kpis(list) {
  const closed = list.filter((t) => t.closedAt);
  return {
    total: list.length,
    open: list.length - closed.length,
    closed: closed.length,
    avgWorkMs: mean(closed.map((t) => t.escalationInfo.workedMs)),
    escalationRate: list.length ? list.filter(wasEscalated).length / list.length : null,
    failedChecks: list.filter((t) => failedChecks(t) > 0).length,
    repeats: findRepeats(list).length
  };
}

// Anzahl je Schlüssel, absteigend sortiert: [{ key, label, count }]
export function countBy(list, keyFn, labelFn = (k) => k) {
  const map = new Map();
  for (const t of list) {
    const key = keyFn(t);
    if (key === '' || key == null) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map].map(([key, count]) => ({ key, label: labelFn(key), count })).sort((a, b) => b.count - a.count);
}

// Verlauf: Anzahl je Woche (bis 120 Tage) oder je Monat
export function timeline(list, f) {
  const { from, to } = periodRange(f);
  const first = from || (list.length ? new Date(Math.min(...list.map((t) => Date.parse(t.createdAt)))) : to);
  const byWeek = to - first <= 120 * DAY;
  const keyOf = (d) => {
    if (!byWeek) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monday = new Date(d);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return monday.toISOString().slice(0, 10);
  };
  const buckets = new Map();
  const cursor = new Date(first);
  while (cursor <= to) {
    buckets.set(keyOf(cursor), 0);
    cursor.setDate(cursor.getDate() + (byWeek ? 7 : 28));
  }
  buckets.set(keyOf(to), buckets.get(keyOf(to)) || 0);
  for (const t of list) {
    const k = keyOf(new Date(t.createdAt));
    if (buckets.has(k)) buckets.set(k, buckets.get(k) + 1);
  }
  const label = (k) => (byWeek ? `${k.slice(8, 10)}.${k.slice(5, 7)}.` : `${k.slice(5, 7)}.${k.slice(2, 4)}`);
  return { unit: byWeek ? 'Woche' : 'Monat', points: [...buckets].sort().map(([k, count]) => ({ key: k, label: label(k), count })) };
}

// Gleiche Maschine + gleiches Kriterium mehrfach innerhalb REPEAT_WINDOW_DAYS
export function findRepeats(list) {
  const groups = new Map();
  for (const t of list) {
    const key = `${t.machineId}|${t.criterion}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const result = [];
  for (const [key, items] of groups) {
    if (items.length < 2) continue;
    const sorted = items.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    const withinWindow = sorted.some((t, i) => i > 0 && Date.parse(t.createdAt) - Date.parse(sorted[i - 1].createdAt) <= REPEAT_WINDOW_DAYS * DAY);
    if (!withinWindow) continue;
    const [machineId, criterion] = key.split('|');
    result.push({ machineId, criterion, tickets: sorted, causes: [...new Set(sorted.map((t) => t.cause).filter(Boolean))] });
  }
  return result.sort((a, b) => b.tickets.length - a.tickets.length);
}

// --- CSV-Export (Excel-tauglich: Semikolon, UTF-8 mit BOM) -----------------------------

export function toCsv(list, levels) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const header = ['ID', 'Gemeldet', 'Geschlossen', 'Gruppe', 'Maschine', 'Kriterium', 'Vorfall', 'Status', 'Höchste Stufe', 'Arbeitszeit (h)', 'Sofortmassnahme', '5x Warum', 'Ursache', 'Massnahmen', 'Nicht wirksam (Anzahl)', 'Lessons Learned'];
  const rows = list.map((t) => [
    t.id,
    t.createdAt?.slice(0, 16).replace('T', ' '),
    t.closedAt?.slice(0, 16).replace('T', ' ') || '',
    t.panelId,
    t.machineId,
    t.criterion,
    t.title,
    t.status,
    levels[maxLevel(t)].short,
    (t.escalationInfo.workedMs / 3.6e6).toFixed(1).replace('.', ','),
    t.containment,
    (t.whys || []).join(' / '),
    t.cause,
    (t.tasks || []).map((x) => `${x.title} (${x.owner})`).join(' / '),
    failedChecks(t),
    t.lessonsLearned
  ]);
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
}

export function downloadCsv(list, levels) {
  const blob = new Blob([toCsv(list, levels)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `action-engine-auswertung-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
