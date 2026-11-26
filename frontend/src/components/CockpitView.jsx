import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Matrix from './Matrix';

/* =========================================================================
   SHOPFLOOR COCKPIT – v4
   -------------------------------------------------------------------------
   Drei neutrale Ansichten mit klarer Perspektive:
     • Betrieb     → Produktivität (Insel-/Abteilungsleitung)
     • Steuerung   → Risiken & Statistik (Produktionsleitung)
     • Prävention  → Qualität, Wiederholungen, Frühwarnung (Qualitätsleitung)

   Alles Anpassbare wird im Browser (localStorage) gespeichert:
     Ansicht, Abteilungen, Zoom, Layout je Ansicht, Filter je Ansicht,
     Punktgrösse, Rotationsintervall, Qualitätskriterien,
     Position/Grösse aller Fenster, Abschnitte im Maschinen-Detail.

   Props sind identisch zur bisherigen Version → App.jsx muss nicht angepasst werden.
   ========================================================================= */

// -------------------------------------------------------------------------
// 1. KONFIGURATION
// -------------------------------------------------------------------------

const DESIGN_WIDTH = 1900; // Referenzbreite (Full-HD) für den Auto-Zoom
const ZOOM_MIN = 60;
const ZOOM_MAX = 250;

// Gewichte für das Risiko-Ranking (bewusst einfach und nachvollziehbar)
const RISK_WEIGHTS = { redNow: 3, openTicket: 2, incident30d: 1, repeat30d: 2 };

// Frühwarnung: Vergleichsfenster und Auslöseschwelle
const EARLY_WINDOW_DAYS = 28;
const EARLY_MIN_CASES = 3;
const EARLY_FACTOR = 1.5;

const ESCALATION_LEVELS = [
  'Shopfloor (Lvl 1)',
  'Schichtleitung (Lvl 2)',
  'Produktionsleitung (Lvl 3)',
  'Werksleitung (Lvl 4)'
];

const DEFAULT_QUALITY_CRITERIA = ['Qualität', 'Messmittel', 'Messen (anmelden)', 'Neuteil 0%'];

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const PERIOD_PRESETS = [
  { value: 'current_month', label: 'Aktueller Monat' },
  { value: 'last_30', label: 'Letzte 30 Tage' },
  { value: 'last_90', label: 'Letzte 90 Tage' },
  { value: 'ytd', label: 'Dieses Jahr' },
  { value: 'last_12m', label: 'Letzte 12 Monate' },
  { value: 'custom', label: 'Frei wählen …' }
];

const WIDGETS = {
  kpis: { title: 'Kennzahlen' },
  lines: { title: 'Produktionslinien' },
  alarms: { title: 'Aktive Störungen & Aufgaben' },
  trend14: { title: 'Tages-Verlauf (14 Tage)' },
  blockers: { title: 'Blockaden jetzt (nach Ursache)' },
  aging: { title: 'Offene Tickets nach Alter' },
  analysis: { title: 'Tracker & Schwerpunkte' },
  risk: { title: 'Risiko-Ranking Maschinen' },
  escalation: { title: 'Eskalationsstufen (offen)' },
  earlywarning: { title: 'Frühwarnung' },
  repeats: { title: 'Wiederholer' },
  forecast: { title: 'Trend-Schätzung' },
  quality: { title: 'Qualitätsrelevante Vorfälle' },
  lessons: { title: 'Ursachen & Lessons Learned' }
};

// Widgets, die den Auswertungs-Zeitraum / die Filter verwenden
const PERIOD_WIDGETS = ['analysis', 'repeats', 'quality', 'lessons', 'earlywarning', 'forecast'];

const VIEWS = {
  betrieb: {
    label: 'Betrieb',
    hint: 'Produktivität: Was steht jetzt, was blockiert, was ist zu tun?',
    showCockpit: true,
    autoRotate: true,
    preset: 'current_month',
    columns: [['kpis', 'lines'], ['alarms', 'trend14'], ['blockers', 'aging']]
  },
  steuerung: {
    label: 'Steuerung',
    hint: 'Risiken & Statistik: Wo häufen sich Probleme, was eskaliert?',
    showCockpit: true,
    autoRotate: false,
    preset: 'ytd',
    columns: [['kpis', 'risk', 'lines'], ['analysis', 'alarms'], ['escalation', 'aging', 'repeats']]
  },
  praevention: {
    label: 'Prävention',
    hint: 'Qualität & Vorbeugung: Wiederholungen, Frühwarnungen, Trends',
    showCockpit: true,
    autoRotate: false,
    preset: 'last_90',
    columns: [['kpis', 'earlywarning', 'repeats'], ['forecast', 'quality'], ['lessons', 'analysis']]
  }
};

const COLUMN_SPANS = ['lg:col-span-5', 'lg:col-span-4', 'lg:col-span-3'];
const COLUMN_NAMES = ['Links', 'Mitte', 'Rechts'];

const DOT_SIZES = {
  S: 'w-4 h-4',
  M: 'w-5 h-5',
  L: 'w-7 h-7',
  XL: 'w-9 h-9'
};

const DEFAULT_SETTINGS = {
  dotSize: 'M',
  rotateSec: 15,
  qualityCriteria: DEFAULT_QUALITY_CRITERIA
};

const DEFAULT_FILTERS = { from: '', to: '', machine: 'all', criterion: 'all', status: 'all' };

const DETAIL_SECTIONS = {
  status: 'Status aller Kriterien',
  kpis: 'Kennzahlen im Zeitraum',
  history: 'Verlauf 12 Wochen',
  focus: 'Schwerpunkte (Kriterien)',
  repeats: 'Wiederholer',
  open: 'Offene Tickets',
  notes: 'Schichtnotizen',
  closed: 'Abgeschlossene Tickets & Ursachen'
};
const DEFAULT_DETAIL_SECTIONS = Object.keys(DETAIL_SECTIONS).map((id) => ({ id, on: true }));

// -------------------------------------------------------------------------
// 2. HILFSFUNKTIONEN
// -------------------------------------------------------------------------

const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7)); // Montag
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (d) => (d ? d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
const fmtShort = (d) => (d ? d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }) : '–');
const fmtDateTime = (d) =>
  d ? `${fmtDate(d)} ${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}` : '–';

const isoWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / DAY + 1) / 7);
};

// Versteht ISO ("2026-11-20T07:56:00Z") und Schweizer Format ("20.11.2026, 07:56:12")
const parseAnyDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  const ch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ch) return new Date(+ch[3], +ch[2] - 1, +ch[1], +(ch[4] || 0), +(ch[5] || 0), +(ch[6] || 0));
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDuration = (ms) => {
  if (ms == null || isNaN(ms) || ms < 0) return '–';
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${pad(min % 60)} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
};

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function normTicket(t) {
  const created = parseAnyDate(t.createdAt);
  const closed = parseAnyDate(t.closedAt);
  return {
    ...t,
    machineId: String(t.machineId ?? t.source?.machineId ?? ''),
    criterion: t.criterion ?? t.source?.criterion ?? '',
    panelId: t.panelId ?? t.source?.panelId ?? null,
    created,
    closed,
    isOpen: t.status !== 'Geschlossen',
    level: ESCALATION_LEVELS.includes(t.escalationLevel) ? t.escalationLevel : ESCALATION_LEVELS[0]
  };
}

function resolvePeriod(f, now) {
  const today = startOfDay(now);
  switch (f.preset) {
    case 'last_30':
      return { start: addDays(today, -29), end: endOfDay(now) };
    case 'last_90':
      return { start: addDays(today, -89), end: endOfDay(now) };
    case 'ytd':
      return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
    case 'last_12m':
      return { start: new Date(now.getFullYear(), now.getMonth() - 11, 1), end: endOfDay(now) };
    case 'custom': {
      const a = parseAnyDate(f.from) || new Date(now.getFullYear(), 0, 1);
      const b = parseAnyDate(f.to) || today;
      const [s, e] = a <= b ? [a, b] : [b, a];
      return { start: startOfDay(s), end: endOfDay(e) };
    }
    default:
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
      };
  }
}

// Zeitachse für den Tracker: Tage (≤ 45 T.), Wochen (≤ 190 T.) oder Monate
function buildBuckets(start, end, now) {
  const spanDays = Math.round((startOfDay(end) - startOfDay(start)) / DAY) + 1;
  const gran = spanDays <= 45 ? 'day' : spanDays <= 190 ? 'week' : 'month';
  const multiYear = start.getFullYear() !== end.getFullYear();
  const out = [];
  if (gran === 'day') {
    for (let d = startOfDay(start); d <= end; d = addDays(d, 1)) {
      out.push({ key: ymd(d), label: String(d.getDate()), title: fmtDate(d), start: d, end: endOfDay(d) });
    }
  } else if (gran === 'week') {
    for (let d = startOfWeek(start); d <= end; d = addDays(d, 7)) {
      const e = endOfDay(addDays(d, 6));
      out.push({
        key: `W${ymd(d)}`,
        label: `KW${isoWeek(d)}`,
        title: `KW ${isoWeek(d)} (${fmtShort(d)} – ${fmtShort(e)})`,
        start: d < start ? start : d,
        end: e > end ? end : e
      });
    }
  } else {
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const e = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      out.push({
        key: `M${ymd(d)}`,
        label: multiYear ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : MONTHS[d.getMonth()],
        title: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        start: d < start ? start : d,
        end: e > end ? end : e
      });
    }
  }
  out.forEach((b) => {
    b.isFuture = b.start > now;
  });
  return { gran, buckets: out };
}

// Ampel-Logik der Tracker-Kacheln:
//  Tage            → absolut: 0 grün · 1 gelb · 2+ rot
//  Wochen / Monate → relativ zum Durchschnitt des Zeitraums: 0 grün · bis Ø+20 % gelb · darüber rot
const RELATIVE_FACTOR = 1.2;
function tileScale(gran, buckets) {
  if (gran === 'day') {
    return { level: (n) => (n >= 2 ? 2 : n >= 1 ? 1 : 0), legend: ['0 Fälle', '1 Fall', '2+ Fälle'] };
  }
  const past = buckets.filter((b) => !b.isFuture);
  const avg = past.length ? past.reduce((s, b) => s + b.tickets.length, 0) / past.length : 0;
  const limit = avg * RELATIVE_FACTOR;
  return {
    level: (n) => (n === 0 ? 0 : n > limit ? 2 : 1),
    legend: ['0 Fälle', `≤ Ø+20 % (${limit.toFixed(1)})`, `> Ø+20 %`]
  };
}

function weeklySeries(tickets, now, n = 12) {
  const ws = startOfWeek(now);
  const weeks = [];
  for (let i = n; i >= 1; i--) {
    const s = addDays(ws, -7 * i);
    const e = addDays(s, 7);
    weeks.push({
      key: ymd(s),
      label: `KW${isoWeek(s)}`,
      title: `KW ${isoWeek(s)} (${fmtShort(s)} – ${fmtShort(addDays(s, 6))})`,
      count: tickets.filter((t) => t.created && t.created >= s && t.created < e).length
    });
  }
  return weeks;
}

function linFit(ys) {
  const n = ys.length;
  if (!n) return { a: 0, b: 0, mean: 0 };
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  ys.forEach((y, i) => {
    num += (i - mx) * (y - my);
    den += (i - mx) ** 2;
  });
  const b = den ? num / den : 0;
  return { a: my - b * mx, b, mean: my };
}

function compareWindows(tickets, keyFn, now, days = EARLY_WINDOW_DAYS) {
  const t0 = startOfDay(now).getTime() + DAY;
  const r0 = t0 - days * DAY;
  const p0 = r0 - days * DAY;
  const m = {};
  tickets.forEach((t) => {
    if (!t.created) return;
    const k = keyFn(t);
    if (!k) return;
    const ts = t.created.getTime();
    if (!m[k]) m[k] = { key: k, recent: 0, prev: 0 };
    if (ts >= r0 && ts < t0) m[k].recent += 1;
    else if (ts >= p0 && ts < r0) m[k].prev += 1;
  });
  return Object.values(m)
    .filter((x) => x.recent + x.prev > 0)
    .map((x) => ({
      ...x,
      delta: x.recent - x.prev,
      flagged: x.recent >= EARLY_MIN_CASES && x.recent >= EARLY_FACTOR * Math.max(1, x.prev)
    }))
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.delta - a.delta || b.recent - a.recent);
}

function findRepeats(tickets) {
  const m = {};
  tickets.forEach((t) => {
    const k = `${t.machineId}|${t.criterion}`;
    if (!m[k]) m[k] = { key: k, machineId: t.machineId, criterion: t.criterion, list: [] };
    m[k].list.push(t);
  });
  return Object.values(m)
    .filter((x) => x.list.length >= 2)
    .map((x) => {
      const ds = x.list.map((t) => t.created).filter(Boolean).sort((a, b) => a - b);
      const gaps = ds.slice(1).map((d, i) => (d - ds[i]) / DAY);
      return {
        ...x,
        count: x.list.length,
        first: ds[0] || null,
        last: ds[ds.length - 1] || null,
        avgGap: mean(gaps),
        open: x.list.filter((t) => t.isOpen).length
      };
    })
    .sort((a, b) => b.count - a.count || (b.last || 0) - (a.last || 0));
}

function sanitizeLayout(stored, def) {
  if (!stored || !Array.isArray(stored.columns) || stored.columns.length !== 3) {
    return def.map((c) => [...c]);
  }
  const seen = new Set();
  return stored.columns.map((col) =>
    (Array.isArray(col) ? col : []).filter((id) => {
      if (!WIDGETS[id] || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
  );
}

function sanitizeSections(stored) {
  const list = Array.isArray(stored) ? stored.filter((s) => s && DETAIL_SECTIONS[s.id]) : [];
  Object.keys(DETAIL_SECTIONS).forEach((id) => {
    if (!list.some((s) => s.id === id)) list.push({ id, on: true });
  });
  return list;
}

// Zustand, der im Browser gespeichert bleibt
function usePersistentState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) return JSON.parse(raw);
    } catch (e) {
      /* localStorage nicht verfügbar → Standardwert */
    }
    return typeof initial === 'function' ? initial() : initial;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      /* ignorieren */
    }
  }, [key, val]);
  return [val, setVal];
}

// -------------------------------------------------------------------------
// 3. KLEINE BAUSTEINE
// -------------------------------------------------------------------------

function Card({ title, right, children, grow }) {
  return (
    <section
      className={`bg-[#273549] border border-slate-600/60 rounded-xl p-4 shadow-md flex flex-col min-w-0 ${
        grow ? 'flex-1' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-600 pb-1.5 mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 truncate">{title}</h2>
        {right}
      </div>
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </section>
  );
}

function Empty({ children, tone = 'slate' }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : 'bg-[#1e293b]/60 border-slate-700 text-slate-400';
  return <div className={`text-xs text-center py-5 px-3 rounded-lg border ${cls}`}>{children}</div>;
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-800 text-slate-300 border-slate-600',
    red: 'bg-red-500/20 text-red-300 border-red-500/40',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    blue: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
  };
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Kpi({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: ['border-slate-700', 'text-slate-400', 'text-white'],
    green: ['border-emerald-500/40', 'text-emerald-300', 'text-emerald-400'],
    red: ['border-red-500/50', 'text-red-300', 'text-red-400'],
    amber: ['border-amber-500/50', 'text-amber-300', 'text-amber-400'],
    blue: ['border-sky-500/40', 'text-sky-300', 'text-sky-300']
  };
  const [b, l, v] = tones[tone] || tones.slate;
  return (
    <div className={`bg-[#1e293b] p-3 rounded-lg border ${b} text-center min-w-0`}>
      <div className={`text-xs ${l} truncate`}>{label}</div>
      <div className={`text-2xl font-black ${v} mt-0.5 leading-tight`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function HBar({ label, value, max, sub, onClick, active, tone = 'heat' }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  const fill =
    tone === 'red'
      ? 'bg-red-500'
      : tone === 'blue'
      ? 'bg-sky-400'
      : tone === 'green'
      ? 'bg-emerald-400'
      : 'bg-gradient-to-r from-amber-500 to-red-500';
  const body = (
    <>
      <div className="flex justify-between gap-2 text-xs font-bold mb-1">
        <span className="text-slate-200 truncate">{label}</span>
        <span className="text-amber-400 shrink-0">
          {value}
          {sub ? <span className="text-slate-400 font-normal"> {sub}</span> : null}
        </span>
      </div>
      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </>
  );
  if (!onClick) return <div>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left rounded-md p-1 -m-1 transition hover:bg-slate-800/70 ${
        active ? 'ring-1 ring-amber-400 bg-slate-800/70' : ''
      }`}
    >
      {body}
    </button>
  );
}

function WeekChart({ weeks, fit, forecast, height = 96 }) {
  const cols = weeks.length + (forecast ? 1 : 0);
  const max = Math.max(1, ...weeks.map((w) => w.count), forecast ? forecast.hi : 0);
  const x = (i) => ((i + 0.5) / cols) * 100;
  const y = (v) => 100 - (Math.max(0, v) / max) * 80;
  return (
    <div>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {weeks.map((w) => (
          <div key={w.key} className="flex-1 h-full flex flex-col justify-end items-center min-w-0" title={`${w.title}: ${w.count}`}>
            <span className="text-[10px] text-slate-300 leading-none mb-0.5">{w.count || ''}</span>
            <div
              className={`w-full rounded-t ${w.count ? 'bg-amber-500/80' : 'bg-slate-700'}`}
              style={{ height: `${Math.max(3, (w.count / max) * 80)}%` }}
            />
          </div>
        ))}
        {forecast && (
          <div
            className="flex-1 h-full flex flex-col justify-end items-center min-w-0"
            title={`Erwartung nächste 7 Tage: ${forecast.value} (Bandbreite ${forecast.lo}–${forecast.hi})`}
          >
            <span className="text-[10px] text-sky-300 font-bold leading-none mb-0.5">~{forecast.value}</span>
            <div
              className="w-full rounded-t border-2 border-dashed border-sky-400 bg-sky-500/20"
              style={{ height: `${Math.max(3, (forecast.value / max) * 80)}%` }}
            />
          </div>
        )}
        {fit && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1={x(0)}
              y1={y(fit.a)}
              x2={x(cols - 1)}
              y2={y(fit.a + fit.b * (cols - 1))}
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}
      </div>
      <div className="flex gap-1 mt-1">
        {weeks.map((w, i) => (
          <span key={w.key} className="flex-1 text-center text-[9px] font-mono text-slate-500 truncate">
            {i % 2 === weeks.length % 2 ? w.label.replace('KW', '') : ''}
          </span>
        ))}
        {forecast && <span className="flex-1 text-center text-[9px] font-bold text-sky-300">+7T</span>}
      </div>
    </div>
  );
}

// Verschiebbares, in der Grösse veränderbares Fenster (Position & Grösse werden gespeichert)
function FloatingWindow({ storageKey, title, subtitle, scale, onClose, headerExtra, defaultSize, children }) {
  const [geom, setGeom] = usePersistentState(storageKey, null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const dragRef = useRef(null);

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const w = geom?.w || defaultSize.w;
  const hWanted = geom?.h || defaultSize.h;
  const h = Math.min(hWanted, Math.max(240, (vp.h - 16) / scale));
  const x = clamp(geom?.x ?? (vp.w - w * scale) / 2, 0, Math.max(0, vp.w - 140));
  const y = clamp(geom?.y ?? (vp.h - h * scale) / 2, 0, Math.max(0, vp.h - 48));

  const start = (e, mode) => {
    if (e.button !== 0) return;
    if (mode === 'move' && e.target.closest('button, select, input, label, a')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, g: { x, y, w, h: hWanted } };
  };
  const move = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === 'move') setGeom({ ...d.g, x: d.g.x + dx, y: d.g.y + dy });
    else setGeom({ ...d.g, w: Math.max(420, d.g.w + dx / scale), h: Math.max(260, d.g.h + dy / scale) });
  };
  const end = () => {
    dragRef.current = null;
  };

  return (
    <div className="fixed z-50" style={{ left: x, top: y }}>
      <div
        style={{ zoom: scale, width: w, height: h }}
        className="relative flex flex-col bg-[#0f172a] border border-slate-500 rounded-2xl shadow-2xl shadow-black/60 text-slate-100 overflow-hidden"
      >
        <div
          onPointerDown={(e) => start(e, 'move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="cursor-move select-none touch-none flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-700 bg-[#111c33]"
        >
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-amber-400 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {headerExtra}
            <button
              type="button"
              title="Position und Grösse zurücksetzen"
              onClick={() => setGeom(null)}
              className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              ⟲
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded text-sm font-bold bg-slate-700 text-white hover:bg-slate-600"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">{children}</div>
        <div
          onPointerDown={(e) => start(e, 'resize')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          title="Grösse ändern"
          className="absolute right-0 bottom-0 w-6 h-6 cursor-se-resize touch-none flex items-end justify-end p-1 text-slate-500 hover:text-amber-400 text-xs leading-none"
        >
          ◢
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// 4. MASCHINEN-DETAIL
// -------------------------------------------------------------------------

function MachineDetail({ target, model, panelsMap, scale, onClose, onEdit, onOpenBoard }) {
  const [storedSections, setSections] = usePersistentState('sfc_detail_sections', DEFAULT_DETAIL_SECTIONS);
  const [menuOpen, setMenuOpen] = useState(false);
  const sections = sanitizeSections(storedSections);
  const { machineId, panelId, focus } = target;
  const panel = panelsMap[panelId];

  const d = useMemo(() => {
    if (!panel) return null;
    const now = model.now;
    const criteria = panel.criteria || [];
    const status = criteria.map((c) => {
      const cell = panel.cells?.[`${machineId}-${c}`];
      const alarm = model.alarms.find((a) => a.machineId === machineId && a.criterion === c);
      return { criterion: c, isRed: cell?.status === 'red', notes: cell?.notes || [], alarm };
    });
    const all = model.scopeTickets.filter((t) => t.machineId === machineId);
    const inPeriod = all.filter((t) => t.created && t.created >= model.period.start && t.created <= model.period.end);
    const open = all.filter((t) => t.isOpen).sort((a, b) => (a.created || 0) - (b.created || 0));
    const closed = all
      .filter((t) => !t.isOpen)
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .slice(0, 12);
    const last = all.reduce((m, t) => (t.created && (!m || t.created > m) ? t.created : m), null);
    const focusCounts = {};
    inPeriod.forEach((t) => {
      focusCounts[t.criterion] = (focusCounts[t.criterion] || 0) + 1;
    });
    const leads = all.filter((t) => t.closed && t.created).map((t) => t.closed - t.created);
    const notes = status
      .flatMap((s) => s.notes.map((n) => ({ ...n, criterion: s.criterion, at: parseAnyDate(n.timestamp) })))
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, 40);
    return {
      status,
      inPeriod,
      open,
      closed,
      last,
      daysSince: last ? Math.floor((now - last) / DAY) : null,
      weeks: weeklySeries(all, now, 12),
      focus: Object.entries(focusCounts).sort((a, b) => b[1] - a[1]),
      repeats: findRepeats(inPeriod),
      avgLead: mean(leads),
      notes,
      risk: model.risk.find((r) => r.machineId === machineId)
    };
  }, [panel, machineId, model]);

  const toggle = (id) => setSections(sections.map((s) => (s.id === id ? { ...s, on: !s.on } : s)));
  const moveSec = (idx, dir) => {
    const next = [...sections];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setSections(next);
  };

  const redCount = d ? d.status.filter((s) => s.isRed).length : 0;

  const headerExtra = (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className={`px-2 py-1 rounded text-xs font-bold border ${
            menuOpen ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
          }`}
        >
          ⚙ Abschnitte
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-10 w-72 bg-[#0b1324] border border-slate-600 rounded-lg shadow-xl p-2 space-y-1">
            <p className="text-[11px] text-slate-400 px-1 pb-1">Ein-/ausblenden und Reihenfolge – wird gespeichert.</p>
            {sections.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-1.5 text-xs">
                <label className="flex-1 flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-800">
                  <input type="checkbox" checked={s.on} onChange={() => toggle(s.id)} className="accent-amber-400" />
                  <span className={s.on ? 'text-slate-200' : 'text-slate-500'}>{DETAIL_SECTIONS[s.id]}</span>
                </label>
                <button type="button" onClick={() => moveSec(idx, -1)} className="px-1.5 rounded bg-slate-800 hover:bg-slate-700">
                  ↑
                </button>
                <button type="button" onClick={() => moveSec(idx, 1)} className="px-1.5 rounded bg-slate-800 hover:bg-slate-700">
                  ↓
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSections(DEFAULT_DETAIL_SECTIONS)}
              className="w-full mt-1 text-[11px] font-bold text-amber-300 hover:underline"
            >
              Standard wiederherstellen
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpenBoard(panelId)}
        className="px-2 py-1 rounded text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30"
      >
        Board →
      </button>
    </>
  );

  const renderSection = (id) => {
    switch (id) {
      case 'status':
        return (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
            {d.status.map((s) => (
              <button
                key={s.criterion}
                type="button"
                onClick={() => onEdit(machineId, s.criterion, panelId)}
                className={`text-left rounded-lg p-2.5 border transition ${
                  s.isRed
                    ? 'bg-red-500/15 border-red-500/60 hover:bg-red-500/25'
                    : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                } ${focus === s.criterion ? 'ring-2 ring-amber-400' : ''}`}
                title="Klick: Status ändern"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{s.criterion}</span>
                  <span className={`w-3 h-3 rounded-full shrink-0 ${s.isRed ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                </div>
                {s.isRed && (
                  <div className="text-[11px] text-red-200 mt-1">
                    seit {s.alarm?.since ? fmtDuration(model.now - s.alarm.since) : 'unbekannt'}
                    {s.alarm?.latestNote?.text && (
                      <div className="italic text-slate-300 truncate">«{s.alarm.latestNote.text}»</div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        );
      case 'kpis':
        return (
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="Vorfälle (Zeitraum)" value={d.inPeriod.length} tone={d.inPeriod.length ? 'amber' : 'green'} />
            <Kpi label="Offene Tickets" value={d.open.length} tone={d.open.length ? 'red' : 'green'} />
            <Kpi label="Aktive Störungen" value={redCount} tone={redCount ? 'red' : 'green'} />
            <Kpi label="Letzte Störung" value={fmtShort(d.last)} sub={d.daysSince == null ? 'keine erfasst' : d.daysSince === 0 ? 'heute' : d.daysSince === 1 ? 'gestern' : `vor ${d.daysSince} Tagen`} />
            <Kpi
              label="Ø Durchlaufzeit"
              value={d.avgLead != null ? fmtDuration(d.avgLead) : '–'}
              sub={d.avgLead != null ? 'Meldung → Abschluss' : 'kein closedAt im Backend'}
            />
            <Kpi
              label="Risiko-Score"
              value={d.risk ? d.risk.score : 0}
              tone={d.risk && d.risk.score >= 6 ? 'red' : d.risk && d.risk.score > 0 ? 'amber' : 'green'}
              sub={d.risk ? `${d.risk.redNow} rot · ${d.risk.open} offen · ${d.risk.inc30} in 30 T.` : ''}
            />
          </div>
        );
      case 'history':
        return <WeekChart weeks={d.weeks} height={90} />;
      case 'focus':
        return d.focus.length === 0 ? (
          <Empty>Keine Vorfälle im gewählten Zeitraum.</Empty>
        ) : (
          <div className="space-y-2.5">
            {d.focus.slice(0, 8).map(([c, n]) => (
              <HBar key={c} label={c} value={n} max={d.focus[0][1]} />
            ))}
          </div>
        );
      case 'repeats':
        return d.repeats.length === 0 ? (
          <Empty tone="green">Keine wiederholten Störungen im Zeitraum.</Empty>
        ) : (
          <div className="space-y-1.5">
            {d.repeats.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-2 text-xs bg-[#1e293b] border border-slate-700 rounded-md px-2.5 py-1.5">
                <span className="font-bold text-white">{r.criterion}</span>
                <span className="text-slate-400">
                  {r.count}× · zuletzt {fmtShort(r.last)}
                  {r.avgGap != null ? ` · Ø alle ${r.avgGap.toFixed(1)} T.` : ''}
                </span>
              </div>
            ))}
          </div>
        );
      case 'open':
        return d.open.length === 0 ? (
          <Empty tone="green">Keine offenen Tickets.</Empty>
        ) : (
          <div className="space-y-2">
            {d.open.map((t) => {
              const tasks = t.tasks || [];
              const done = tasks.filter((k) => k.status === 'completed').length;
              return (
                <div key={t.id} className="bg-[#1e293b] border-l-4 border-red-500 border border-slate-700 rounded-lg p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-bold text-amber-400">{t.id}</span>
                    <div className="flex gap-1">
                      <Badge tone="red">{t.status}</Badge>
                      <Badge tone="blue">{t.level}</Badge>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-white mt-1">{t.criterion}</div>
                  <div className="text-xs text-slate-300">{t.title}</div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                    <span>offen seit {t.created ? fmtDuration(model.now - t.created) : '–'}</span>
                    <span>{tasks.length ? `Massnahmen ${done}/${tasks.length}` : 'noch keine Massnahmen'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      case 'notes':
        return d.notes.length === 0 ? (
          <Empty>Keine Schichtnotizen hinterlegt.</Empty>
        ) : (
          <div className="space-y-1.5">
            {d.notes.map((n, i) => (
              <div key={i} className="text-xs bg-slate-900/60 border border-slate-700/80 rounded p-2">
                <div className="flex justify-between gap-2 text-[11px] text-slate-400 mb-0.5">
                  <span>
                    <span className="font-bold text-amber-300">{n.criterion}</span> · {n.author || 'Shopfloor'}
                  </span>
                  <span>{n.timestamp}</span>
                </div>
                <div className="text-slate-200 italic">«{n.text}»</div>
              </div>
            ))}
          </div>
        );
      case 'closed':
        return d.closed.length === 0 ? (
          <Empty>Noch keine abgeschlossenen Tickets.</Empty>
        ) : (
          <div className="space-y-1.5">
            {d.closed.map((t) => (
              <div key={t.id} className="text-xs bg-[#1e293b] border border-slate-700 rounded p-2">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-white">
                    {t.criterion} <span className="font-mono text-slate-500">{t.id}</span>
                  </span>
                  <span className="text-slate-400">{fmtShort(t.created)}</span>
                </div>
                {t.cause ? (
                  <div className="text-emerald-300 mt-0.5">
                    <strong>Ursache:</strong> {t.cause}
                  </div>
                ) : (
                  <div className="text-amber-300 mt-0.5">Ursache nicht dokumentiert</div>
                )}
                {t.lessonsLearned && <div className="text-slate-300 mt-0.5">💡 {t.lessonsLearned}</div>}
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <FloatingWindow
      storageKey="sfc_win_detail"
      title={`Maschine ${machineId}`}
      subtitle={`${panel?.name || panelId} · ${redCount ? `${redCount} aktive Störung(en)` : 'alles grün'} · Zeitraum ${fmtShort(
        model.period.start
      )} – ${fmtShort(model.period.end)}`}
      scale={scale}
      onClose={onClose}
      headerExtra={headerExtra}
      defaultSize={{ w: 780, h: 680 }}
    >
      {!d ? (
        <Empty>Daten der Gruppe werden geladen …</Empty>
      ) : (
        <div className="space-y-5" onClick={() => menuOpen && setMenuOpen(false)}>
          {sections
            .filter((s) => s.on)
            .map((s) => (
              <div key={s.id}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{DETAIL_SECTIONS[s.id]}</div>
                {renderSection(s.id)}
              </div>
            ))}
        </div>
      )}
    </FloatingWindow>
  );
}

// -------------------------------------------------------------------------
// 5. HAUPTKOMPONENTE
// -------------------------------------------------------------------------

export default function CockpitView({
  apiUrl,
  panels,
  onCellClick,
  onAddMachine,
  onAddCriterion,
  onDeleteMachine,
  onDeleteCriterion,
  onCloseView
}) {
  const availableGroups = useMemo(() => (panels || []).filter((p) => p.id !== 'insel_ds'), [panels]);

  // --- gespeicherte Einstellungen ---
  const [activeView, setActiveView] = usePersistentState('sfc_view', 'betrieb');
  const view = VIEWS[activeView] ? activeView : 'betrieb';
  const [storedGroups, setStoredGroups] = usePersistentState('sfc_groups', []);
  const [settingsRaw, setSettings] = usePersistentState('sfc_settings', DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...settingsRaw };
  const [layouts, setLayouts] = usePersistentState('sfc_layouts', {});
  const [filtersAll, setFiltersAll] = usePersistentState('sfc_filters', {});
  const [zoom, setZoom] = usePersistentState('sfc_zoom', { auto: true, value: 100 });

  // --- Laufzeit-Zustand ---
  const [showCockpit, setShowCockpit] = useState(VIEWS[view].showCockpit);
  const [autoRotate, setAutoRotate] = useState(VIEWS[view].autoRotate);
  const [slideIndex, setSlideIndex] = useState(0);
  const [panelsMap, setPanelsMap] = useState({});
  const [tickets, setTickets] = useState([]);
  const [loadInfo, setLoadInfo] = useState({ error: null, at: null });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [viewportW, setViewportW] = useState(() => window.innerWidth);
  const [detail, setDetail] = useState(null);
  const [periodModal, setPeriodModal] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selectedGroupIds = useMemo(() => {
    const valid = (storedGroups || []).filter((id) => availableGroups.some((g) => g.id === id));
    return valid.length ? valid : availableGroups.map((g) => g.id);
  }, [storedGroups, availableGroups]);
  const groupsKey = selectedGroupIds.join('|');

  const layout = useMemo(() => sanitizeLayout(layouts[view], VIEWS[view].columns), [layouts, view]);
  const filters = { ...DEFAULT_FILTERS, preset: VIEWS[view].preset, ...(filtersAll[view] || {}) };
  const setFilter = (patch) => setFiltersAll((prev) => ({ ...prev, [view]: { ...(prev[view] || {}), ...patch } }));

  // --- Zoom ---
  const zoomPct = zoom.auto
    ? clamp(Math.round(((viewportW / DESIGN_WIDTH) * 100) / 5) * 5, 80, ZOOM_MAX)
    : clamp(zoom.value || 100, ZOOM_MIN, ZOOM_MAX);
  const scale = zoomPct / 100;
  const setManualZoom = (v) => setZoom({ auto: false, value: clamp(v, ZOOM_MIN, ZOOM_MAX) });

  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // --- Uhr ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const minuteKey = Math.floor(currentTime.getTime() / 60000);
  const nowMin = useMemo(() => new Date(minuteKey * 60000), [minuteKey]);

  // --- Daten laden (alle 20 s und bei Fokus) ---
  const loadCockpitData = useCallback(async () => {
    if (selectedGroupIds.length === 0) return;
    try {
      const [loadedPanels, loadedTickets] = await Promise.all([
        Promise.all(
          selectedGroupIds.map((id) =>
            fetch(`${apiUrl}/api/panel/${id}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        ),
        fetch(`${apiUrl}/api/tickets`).then((r) => (r.ok ? r.json() : []))
      ]);
      const map = {};
      selectedGroupIds.forEach((id, idx) => {
        if (loadedPanels[idx]) map[id] = loadedPanels[idx];
      });
      setPanelsMap(map);
      setTickets(Array.isArray(loadedTickets) ? loadedTickets : []);
      setLoadInfo({ error: null, at: new Date() });
    } catch (err) {
      console.error('Fehler beim Laden der Cockpit-Daten:', err);
      setLoadInfo((prev) => ({ ...prev, error: 'Verbindung zum Server fehlgeschlagen' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsKey, apiUrl]);

  useEffect(() => {
    loadCockpitData();
    const refresh = setInterval(loadCockpitData, 20000);
    window.addEventListener('focus', loadCockpitData);
    return () => {
      clearInterval(refresh);
      window.removeEventListener('focus', loadCockpitData);
    };
  }, [loadCockpitData]);

  // --- Slides & Rotation ---
  const slides = useMemo(() => {
    const list = [];
    if (showCockpit) list.push({ type: 'cockpit', id: 'cockpit', label: 'Gesamt-Cockpit' });
    selectedGroupIds.forEach((id) => {
      const p = panelsMap[id];
      if (p) list.push({ type: 'board', id, label: p.name || id });
    });
    return list.length > 0 ? list : [{ type: 'cockpit', id: 'cockpit', label: 'Gesamt-Cockpit' }];
  }, [showCockpit, selectedGroupIds, panelsMap]);

  const overlayOpen = !!detail || !!periodModal || settingsOpen;
  const rotateSec = settings.rotateSec || 15;

  useEffect(() => {
    if (!autoRotate || overlayOpen || slides.length <= 1) return;
    const interval = setInterval(() => setSlideIndex((prev) => (prev + 1) % slides.length), rotateSec * 1000);
    return () => clearInterval(interval);
  }, [autoRotate, overlayOpen, slides.length, rotateSec]);

  useEffect(() => {
    if (slideIndex >= slides.length) setSlideIndex(0);
  }, [slides.length, slideIndex]);

  // Esc schliesst das oberste Fenster
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (periodModal) setPeriodModal(null);
      else if (detail) setDetail(null);
      else if (settingsOpen) setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [periodModal, detail, settingsOpen]);

  const jumpToBoard = (panelId) => {
    const idx = slides.findIndex((s) => s.type === 'board' && s.id === panelId);
    if (idx !== -1) {
      setSlideIndex(idx);
      setAutoRotate(false);
      setDetail(null);
    }
  };

  const applyView = (key) => {
    setActiveView(key);
    setShowCockpit(VIEWS[key].showCockpit);
    setAutoRotate(VIEWS[key].autoRotate);
    setSlideIndex(0);
  };

  const toggleGroup = (id) => {
    const next = selectedGroupIds.includes(id)
      ? selectedGroupIds.length > 1
        ? selectedGroupIds.filter((x) => x !== id)
        : selectedGroupIds
      : [...selectedGroupIds, id];
    setStoredGroups(next);
  };

  const openDetail = (panelId, machineId, focus = null) => setDetail({ panelId, machineId: String(machineId), focus });
  const editCell = (machineId, criterion, panelId) => onCellClick(machineId, criterion, panelId);

  // -----------------------------------------------------------------------
  // DATEN-MODELL (alle Auswertungen an einer Stelle)
  // -----------------------------------------------------------------------
  const qualityKey = (settings.qualityCriteria || []).join('|');

  const model = useMemo(() => {
    const now = nowMin;
    const machinePanel = {};
    const machines = [];
    const criteriaSet = new Set();
    selectedGroupIds.forEach((pid) => {
      const p = panelsMap[pid];
      if (!p) return;
      (p.machines || []).forEach((m) => {
        machinePanel[String(m)] = pid;
        machines.push({ id: String(m), panelId: pid, panelName: p.name || pid });
      });
      (p.criteria || []).forEach((c) => criteriaSet.add(c));
    });

    const scopeTickets = tickets
      .map(normTicket)
      .filter((t) => (t.panelId && selectedGroupIds.includes(t.panelId)) || machinePanel[t.machineId]);

    // jüngstes offenes Ticket je Maschine+Kriterium → "rot seit"
    const openByPair = {};
    scopeTickets.forEach((t) => {
      if (!t.isOpen) return;
      const k = `${t.machineId}|${t.criterion}`;
      const cur = openByPair[k];
      if (!cur || (t.created && (!cur.created || t.created > cur.created))) openByPair[k] = t;
    });

    // aktive Störungen (rote Zellen)
    const alarms = [];
    const redByMachine = {};
    selectedGroupIds.forEach((pid) => {
      const p = panelsMap[pid];
      if (!p) return;
      (p.machines || []).forEach((m0) => {
        const m = String(m0);
        (p.criteria || []).forEach((c) => {
          const cell = p.cells?.[`${m0}-${c}`];
          if (cell?.status !== 'red') return;
          const notes = cell.notes || [];
          const latestNote = notes[notes.length - 1];
          const ticket = openByPair[`${m}|${c}`];
          const since = ticket?.created || parseAnyDate(latestNote?.timestamp);
          alarms.push({ panelId: pid, panelName: p.name || pid, machineId: m, criterion: c, latestNote, ticket, since });
          redByMachine[m] = (redByMachine[m] || 0) + 1;
        });
      });
    });
    const BIG = Number.MAX_SAFE_INTEGER;
    alarms.sort((a, b) => (a.since ? a.since.getTime() : BIG) - (b.since ? b.since.getTime() : BIG));

    // Zeitraum & Filter
    const period = resolvePeriod(filters, now);
    const matches = (t) =>
      (filters.machine === 'all' || t.machineId === String(filters.machine)) &&
      (filters.criterion === 'all' || t.criterion === filters.criterion);
    const baseTickets = scopeTickets.filter(matches);
    const periodTickets = baseTickets.filter(
      (t) =>
        t.created &&
        t.created >= period.start &&
        t.created <= period.end &&
        (filters.status === 'all' || (filters.status === 'open' ? t.isOpen : !t.isOpen))
    );
    const { gran, buckets } = buildBuckets(period.start, period.end, now);
    buckets.forEach((b) => {
      b.tickets = periodTickets.filter((t) => t.created >= b.start && t.created <= b.end);
    });

    const critCounts = {};
    periodTickets.forEach((t) => {
      if (t.criterion) critCounts[t.criterion] = (critCounts[t.criterion] || 0) + 1;
    });
    const criteriaStats = Object.entries(critCounts).sort((a, b) => b[1] - a[1]);

    // 14-Tage-Verlauf
    const today = startOfDay(now);
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      const e = endOfDay(d);
      last14.push({
        key: ymd(d),
        label: `${pad(d.getDate())}.`,
        title: fmtDate(d),
        start: d,
        end: e,
        tickets: scopeTickets.filter((t) => t.created && t.created >= d && t.created <= e)
      });
    }

    // offene Tickets (alle) und gefiltert (für Ticket-Auswertungen)
    const openAll = scopeTickets.filter((t) => t.isOpen);
    const openTickets = baseTickets.filter((t) => t.isOpen);
    const ageOf = (t) => (t.created ? now - t.created : null);
    const agingDefs = [
      { label: '< 24 h', test: (a) => a < DAY },
      { label: '1–3 Tage', test: (a) => a >= DAY && a < 3 * DAY },
      { label: '3–7 Tage', test: (a) => a >= 3 * DAY && a < 7 * DAY },
      { label: '> 7 Tage', test: (a) => a >= 7 * DAY }
    ];
    const aging = agingDefs.map((def) => ({
      label: def.label,
      count: openTickets.filter((t) => ageOf(t) != null && def.test(ageOf(t))).length
    }));
    const oldestOpen = [...openTickets].filter((t) => t.created).sort((a, b) => a.created - b.created);

    const escalation = ESCALATION_LEVELS.map((lvl) => ({
      level: lvl,
      tickets: openTickets.filter((t) => t.level === lvl)
    }));

    // Risiko je Maschine (letzte 30 Tage)
    const since30 = addDays(today, -29);
    const t30 = scopeTickets.filter((t) => t.created && t.created >= since30);
    const rep30 = findRepeats(t30);
    const risk = machines
      .map((m) => {
        const redNow = redByMachine[m.id] || 0;
        const open = openAll.filter((t) => t.machineId === m.id).length;
        const inc30 = t30.filter((t) => t.machineId === m.id).length;
        const repeats = rep30.filter((r) => r.machineId === m.id).reduce((s, r) => s + (r.count - 1), 0);
        const score =
          RISK_WEIGHTS.redNow * redNow +
          RISK_WEIGHTS.openTicket * open +
          RISK_WEIGHTS.incident30d * inc30 +
          RISK_WEIGHTS.repeat30d * repeats;
        return { machineId: m.id, panelId: m.panelId, panelName: m.panelName, redNow, open, inc30, repeats, score };
      })
      .sort((a, b) => b.score - a.score);

    // Prävention
    const earlyCriteria = compareWindows(baseTickets, (t) => t.criterion, now);
    const earlyMachines = compareWindows(baseTickets, (t) => t.machineId, now);
    const repeats = findRepeats(periodTickets);

    const weeks = weeklySeries(baseTickets, now, 12);
    const fit = linFit(weeks.map((w) => w.count));
    const total12 = weeks.reduce((s, w) => s + w.count, 0);
    const weeksWithData = weeks.filter((w) => w.count > 0).length;
    const earliest = baseTickets.reduce((m, t) => (t.created && (!m || t.created < m) ? t.created : m), null);
    const historyWeeks = earliest ? (now - earliest) / (7 * DAY) : 0;
    const reliable = total12 >= 10 && weeksWithData >= 4 && historyWeeks >= 8;
    const lambda = Math.max(0, fit.a + fit.b * weeks.length);
    const forecast = {
      reliable,
      total12,
      historyWeeks,
      value: Math.round(lambda),
      lo: Math.max(0, Math.floor(lambda - 1.96 * Math.sqrt(lambda))),
      hi: Math.ceil(lambda + 1.96 * Math.sqrt(lambda)),
      direction: fit.mean > 0 ? (fit.b / fit.mean > 0.1 ? 'steigend' : fit.b / fit.mean < -0.1 ? 'fallend' : 'stabil') : 'stabil',
      slopePct: fit.mean > 0 ? Math.round((fit.b / fit.mean) * 100) : 0
    };

    const qualitySet = new Set(settings.qualityCriteria || []);
    const qualityTickets = periodTickets.filter((t) => qualitySet.has(t.criterion));

    const closedInPeriod = periodTickets.filter((t) => !t.isOpen);
    const withCause = closedInPeriod.filter((t) => t.cause && String(t.cause).trim());
    const hasClosedAt = scopeTickets.some((t) => t.closed);
    const leadTimes = periodTickets.filter((t) => t.closed && t.created).map((t) => t.closed - t.created);

    const recent28 = baseTickets.filter((t) => t.created && t.created >= addDays(today, -27)).length;
    const prev28 = baseTickets.filter(
      (t) => t.created && t.created >= addDays(today, -55) && t.created < addDays(today, -27)
    ).length;

    return {
      now,
      machines,
      criteriaList: Array.from(criteriaSet),
      scopeTickets,
      alarms,
      period,
      periodTickets,
      gran,
      buckets,
      criteriaStats,
      last14,
      openTickets,
      aging,
      oldestOpen,
      escalation,
      risk,
      earlyCriteria,
      earlyMachines,
      repeats,
      weeks,
      fit,
      forecast,
      qualityTickets,
      closedInPeriod,
      withCause,
      hasClosedAt,
      avgLead: mean(leadTimes),
      recent28,
      prev28,
      todayCount: last14[last14.length - 1].tickets.length,
      machinesFree: machines.filter((m) => !redByMachine[m.id]).length
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelsMap, tickets, groupsKey, nowMin, JSON.stringify(filters), qualityKey]);

  const dotClass = DOT_SIZES[settings.dotSize] || DOT_SIZES.M;
  const currentSlide = slides[slideIndex] || slides[0];
  const visibleWidgets = layout.flat();
  const showFilterBar = visibleWidgets.some((id) => PERIOD_WIDGETS.includes(id)) || view !== 'betrieb';

  // -----------------------------------------------------------------------
  // WIDGETS
  // -----------------------------------------------------------------------

  const periodLabel = `${fmtShort(model.period.start)}${
    model.period.start.getFullYear() !== model.period.end.getFullYear() ? `.${model.period.start.getFullYear()}` : ''
  } – ${fmtDate(model.period.end)}`;

  const renderKpis = () => {
    if (view === 'betrieb') {
      const oldest = model.alarms[0];
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="Maschinen frei"
            value={`${model.machinesFree}/${model.machines.length}`}
            tone={model.machinesFree === model.machines.length ? 'green' : 'amber'}
          />
          <Kpi label="Aktive Störungen" value={model.alarms.length} tone={model.alarms.length ? 'red' : 'green'} />
          <Kpi
            label="Längste Störung"
            value={oldest?.since ? fmtDuration(model.now - oldest.since) : '–'}
            sub={oldest ? `${oldest.machineId} · ${oldest.criterion}` : 'keine'}
            tone={oldest ? 'red' : 'green'}
          />
          <Kpi label="Heute gemeldet" value={model.todayCount} tone="blue" />
        </div>
      );
    }
    if (view === 'steuerung') {
      const n = model.periodTickets.length;
      const closedShare = n ? Math.round((model.closedInPeriod.length / n) * 100) : null;
      const avgOpenAge = mean(model.openTickets.filter((t) => t.created).map((t) => model.now - t.created));
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Vorfälle (Zeitraum)" value={n} tone="amber" sub={periodLabel} />
          <Kpi label="Offene Tickets" value={model.openTickets.length} tone={model.openTickets.length ? 'red' : 'green'} />
          <Kpi label="Ø Alter offen" value={avgOpenAge != null ? fmtDuration(avgOpenAge) : '–'} />
          <Kpi
            label={model.hasClosedAt ? 'Ø Durchlaufzeit' : 'Abschlussquote'}
            value={model.hasClosedAt ? fmtDuration(model.avgLead) : closedShare != null ? `${closedShare}%` : '–'}
            sub={model.hasClosedAt ? `Abschlussquote ${closedShare ?? '–'}%` : 'im Zeitraum'}
            tone="blue"
          />
        </div>
      );
    }
    const causeShare = model.closedInPeriod.length
      ? Math.round((model.withCause.length / model.closedInPeriod.length) * 100)
      : null;
    const trend = model.prev28 ? Math.round(((model.recent28 - model.prev28) / model.prev28) * 100) : null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Qualitätsvorfälle" value={model.qualityTickets.length} sub={periodLabel} tone="amber" />
        <Kpi
          label="Wiederholer"
          value={model.repeats.length}
          sub="Maschine+Kriterium ≥ 2×"
          tone={model.repeats.length ? 'red' : 'green'}
        />
        <Kpi
          label="Ursache dokumentiert"
          value={causeShare != null ? `${causeShare}%` : '–'}
          sub={`${model.withCause.length}/${model.closedInPeriod.length} geschlossen`}
          tone={causeShare == null ? 'slate' : causeShare >= 80 ? 'green' : 'amber'}
        />
        <Kpi
          label="Trend 28 Tage"
          value={trend == null ? (model.recent28 ? 'neu' : '–') : `${trend > 0 ? '+' : ''}${trend}%`}
          sub={`${model.recent28} vs. ${model.prev28} Vorperiode`}
          tone={trend == null ? 'slate' : trend > 20 ? 'red' : trend < -20 ? 'green' : 'amber'}
        />
      </div>
    );
  };

  const renderLines = () => (
    <div className="space-y-4">
      {selectedGroupIds.map((panelId) => {
        const panel = panelsMap[panelId];
        if (!panel) return null;
        return (
          <div key={panelId} className="bg-[#1e293b] p-3 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => jumpToBoard(panelId)}
              className="text-sm font-bold text-amber-300 hover:text-amber-200 flex items-center gap-2 mb-2 group"
              title="Board dieser Gruppe öffnen"
            >
              {panel.name}
              <span className="text-xs opacity-70 group-hover:translate-x-1 transition-transform">→ Board</span>
            </button>
            <div className="space-y-1">
              {(panel.machines || []).map((machineId) => {
                const reds = (panel.criteria || []).filter((c) => panel.cells?.[`${machineId}-${c}`]?.status === 'red').length;
                return (
                  <div
                    key={machineId}
                    className={`flex items-center gap-2 rounded-md px-1.5 py-1 border ${
                      reds ? 'bg-red-500/10 border-red-500/30' : 'border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openDetail(panelId, machineId)}
                      className="w-16 shrink-0 text-left text-xs font-mono font-bold text-slate-200 hover:text-amber-300 hover:underline"
                      title="Maschinen-Details öffnen"
                    >
                      {machineId}
                    </button>
                    <div className="flex flex-wrap gap-1 flex-1">
                      {(panel.criteria || []).map((crit) => {
                        const isRed = panel.cells?.[`${machineId}-${crit}`]?.status === 'red';
                        return (
                          <button
                            type="button"
                            key={crit}
                            title={`${machineId} · ${crit}: ${isRed ? 'STÖRUNG' : 'OK'}`}
                            onClick={() => openDetail(panelId, machineId, crit)}
                            className={`${dotClass} rounded-sm transition-transform hover:scale-125 ${
                              isRed ? 'bg-red-500 ring-2 ring-red-300 animate-pulse' : 'bg-emerald-400/90 hover:bg-emerald-300'
                            }`}
                          />
                        );
                      })}
                    </div>
                    {reds > 0 && <Badge tone="red">{reds}</Badge>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderAlarms = (compact) =>
    model.alarms.length === 0 ? (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
        <div className="text-3xl mb-2">✓</div>
        <div className="text-base font-bold text-emerald-300">Alle ausgewählten Bereiche im grünen Bereich!</div>
        <div className="text-xs text-slate-400 mt-1">Keine offenen Störungen vorhanden.</div>
      </div>
    ) : (
      <div className="space-y-3">
        {model.alarms.map((a) => (
          <div
            key={`${a.panelId}-${a.machineId}-${a.criterion}`}
            onClick={() => openDetail(a.panelId, a.machineId, a.criterion)}
            className="bg-[#1e293b] hover:bg-slate-800 border-l-4 border-red-500 border border-slate-700 rounded-lg p-3 cursor-pointer transition shadow"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-300 truncate">
                {a.criterion}
              </span>
              <span className="text-[11px] font-semibold text-amber-300 truncate">{a.panelName}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-base font-bold text-white">Maschine {a.machineId}</div>
              <div className="text-xs font-bold text-red-300 whitespace-nowrap">
                {a.since ? `seit ${fmtDuration(model.now - a.since)}` : ''}
              </div>
            </div>
            {!compact && (
              <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2 rounded border border-slate-700/80 mt-1">
                «{a.latestNote?.text || 'Keine Schichtnotiz hinterlegt.'}»
              </p>
            )}
            <div className="flex justify-between items-center mt-2 gap-2 text-[11px] text-slate-400">
              <span className="truncate">
                {a.latestNote?.author || 'Shopfloor'}
                {a.ticket ? ` · ${a.ticket.level}` : ''}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  editCell(a.machineId, a.criterion, a.panelId);
                }}
                className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold"
              >
                Status ändern
              </button>
            </div>
          </div>
        ))}
      </div>
    );

  const renderTrend14 = () => (
    <div className="flex items-end justify-between gap-1 pt-1">
      {model.last14.map((d) => {
        const n = d.tickets.length;
        return (
          <button
            type="button"
            key={d.key}
            onClick={() => setPeriodModal({ title: `Vorfälle am ${d.title}`, tickets: d.tickets })}
            className="flex flex-col items-center group flex-1 min-w-0"
            title={`${d.title}: ${n} Vorfälle`}
          >
            <span className="text-[10px] font-bold text-slate-300 h-3 leading-3">{n || ''}</span>
            <span
              className={`w-full h-3.5 rounded-sm transition group-hover:scale-110 ${
                n >= 2 ? 'bg-red-500' : n === 1 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span className="text-[10px] font-mono text-slate-400 mt-1">{d.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderBlockers = () => {
    const counts = {};
    model.alarms.forEach((a) => {
      if (!counts[a.criterion]) counts[a.criterion] = [];
      counts[a.criterion].push(a.machineId);
    });
    const rows = Object.entries(counts).sort((a, b) => b[1].length - a[1].length);
    if (!rows.length) return <Empty tone="green">Nichts blockiert die Produktion.</Empty>;
    return (
      <div className="space-y-2.5">
        {rows.map(([c, ms]) => (
          <div key={c}>
            <HBar label={c} value={ms.length} max={rows[0][1].length} tone="red" sub={ms.length === 1 ? 'Maschine' : 'Maschinen'} />
            <div className="flex flex-wrap gap-1 mt-1">
              {ms.map((m) => (
                <span key={m} className="text-[10px] font-mono px-1.5 rounded bg-slate-800 text-slate-300">
                  {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAging = () => {
    const max = Math.max(1, ...model.aging.map((a) => a.count));
    return (
      <div className="space-y-2.5">
        {model.aging.map((a, i) => (
          <HBar key={a.label} label={a.label} value={a.count} max={max} tone={i >= 2 ? 'red' : i === 1 ? 'heat' : 'green'} />
        ))}
        {model.oldestOpen.length > 0 && (
          <div className="pt-2 mt-1 border-t border-slate-700 space-y-1">
            <div className="text-[11px] text-slate-400 font-bold">Älteste offene Tickets</div>
            {model.oldestOpen.slice(0, 3).map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => machinePanelOpen(t.machineId, t.criterion)}
                className="w-full flex justify-between gap-2 text-xs hover:bg-slate-800 rounded px-1"
              >
                <span className="text-white font-bold truncate">
                  {t.machineId} · {t.criterion}
                </span>
                <span className="text-red-300 whitespace-nowrap">{fmtDuration(model.now - t.created)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const machinePanelOpen = (machineId, focus) => {
    const m = model.machines.find((x) => x.id === String(machineId));
    if (m) openDetail(m.panelId, m.id, focus);
  };

  const renderAnalysis = () => {
    const ts = tileScale(model.gran, model.buckets);
    const legend = { green: ts.legend[0], amber: ts.legend[1], red: ts.legend[2] };
    const lead = model.gran === 'day' ? (model.buckets[0].start.getDay() + 6) % 7 : 0;
    const cols = model.gran === 'day' ? 'grid-cols-7' : model.gran === 'week' ? 'grid-cols-5' : 'grid-cols-4';
    const maxCrit = model.criteriaStats[0]?.[1] || 1;
    return (
      <div className="space-y-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            {model.gran === 'day' ? 'Tage' : model.gran === 'week' ? 'Wochen' : 'Monate'} · {periodLabel}
          </div>
          <div className={`grid ${cols} gap-1.5`}>
            {model.gran === 'day' &&
              WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[10px] font-bold text-slate-500">
                  {w}
                </div>
              ))}
            {Array.from({ length: lead }).map((_, i) => (
              <div key={`lead${i}`} />
            ))}
            {model.buckets.map((tile) => {
              const n = tile.tickets.length;
              const lvl = ts.level(n);
              let style = 'bg-emerald-400 text-slate-950 hover:bg-emerald-300';
              if (tile.isFuture) style = 'bg-slate-800/80 text-slate-500 cursor-default';
              else if (lvl === 2) style = 'bg-red-500 text-white hover:bg-red-400 ring-1 ring-red-300';
              else if (lvl === 1) style = 'bg-amber-400 text-slate-950 hover:bg-amber-300';
              return (
                <button
                  type="button"
                  key={tile.key}
                  disabled={tile.isFuture}
                  onClick={() => setPeriodModal({ title: `Vorfälle ${tile.title}`, tickets: tile.tickets })}
                  title={tile.isFuture ? 'Zukünftig' : `${tile.title}: ${n} Vorfälle`}
                  className={`${
                    model.gran === 'day' ? 'aspect-square' : 'py-1.5'
                  } rounded flex flex-col items-center justify-center text-xs font-bold transition leading-tight ${style}`}
                >
                  <span>{tile.label}</span>
                  {model.gran !== 'day' && !tile.isFuture && <span className="text-[10px] font-black opacity-80">{n}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-700">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> {legend.green}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> {legend.amber}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> {legend.red}
            </span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Schwerpunkte</span>
            {filters.criterion !== 'all' && (
              <button type="button" onClick={() => setFilter({ criterion: 'all' })} className="text-[11px] text-amber-300 hover:underline">
                Filter «{filters.criterion}» ✕
              </button>
            )}
          </div>
          {model.criteriaStats.length === 0 ? (
            <Empty>Keine Vorfälle für diese Auswahl.</Empty>
          ) : (
            <div className="space-y-2">
              {model.criteriaStats.slice(0, 6).map(([crit, count]) => (
                <HBar
                  key={crit}
                  label={crit}
                  value={count}
                  max={maxCrit}
                  sub={`(${Math.round((count / model.periodTickets.length) * 100)}%)`}
                  active={filters.criterion === crit}
                  onClick={() => setFilter({ criterion: filters.criterion === crit ? 'all' : crit })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRisk = () => {
    const rows = model.risk.filter((r) => r.score > 0).slice(0, 8);
    if (!rows.length) return <Empty tone="green">Kein erhöhtes Risiko in den letzten 30 Tagen.</Empty>;
    return (
      <div className="space-y-2.5">
        {rows.map((r) => (
          <HBar
            key={r.machineId}
            label={`${r.machineId} · ${r.panelName.replace('Gruppe ', '')}`}
            value={r.score}
            max={rows[0].score}
            sub={`${r.redNow} rot · ${r.open} offen · ${r.inc30}× · ${r.repeats} Wdh.`}
            onClick={() => openDetail(r.panelId, r.machineId)}
          />
        ))}
        <p className="text-[10px] text-slate-500 pt-1">
          Score = {RISK_WEIGHTS.redNow}×rot jetzt + {RISK_WEIGHTS.openTicket}×offene Tickets + {RISK_WEIGHTS.incident30d}×Vorfälle 30 T. +{' '}
          {RISK_WEIGHTS.repeat30d}×Wiederholungen. Heuristik, keine Wahrscheinlichkeit.
        </p>
      </div>
    );
  };

  const renderEscalation = () => {
    const max = Math.max(1, ...model.escalation.map((e) => e.tickets.length));
    const high = model.escalation.slice(2).flatMap((e) => e.tickets);
    return (
      <div className="space-y-2.5">
        {model.escalation.map((e, i) => (
          <HBar key={e.level} label={e.level} value={e.tickets.length} max={max} tone={i >= 2 ? 'red' : i === 1 ? 'heat' : 'blue'} />
        ))}
        {high.length > 0 && (
          <div className="pt-2 border-t border-slate-700 space-y-1">
            {high.slice(0, 4).map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => machinePanelOpen(t.machineId, t.criterion)}
                className="w-full flex justify-between gap-2 text-xs hover:bg-slate-800 rounded px-1"
              >
                <span className="text-white font-bold truncate">
                  {t.machineId} · {t.criterion}
                </span>
                <span className="text-red-300 whitespace-nowrap">{t.level.replace(/ \(Lvl \d\)/, '')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderEarlyRows = (rows, isMachine) =>
    rows.slice(0, 5).map((r) => (
      <button
        type="button"
        key={r.key}
        onClick={() => (isMachine ? machinePanelOpen(r.key) : setFilter({ criterion: r.key }))}
        className={`w-full flex items-center justify-between gap-2 text-xs rounded-md px-2 py-1.5 border transition hover:bg-slate-800 ${
          r.flagged ? 'bg-red-500/10 border-red-500/40' : 'bg-[#1e293b] border-slate-700'
        }`}
      >
        <span className="font-bold text-white truncate">
          {r.flagged ? '⚠ ' : ''}
          {r.key}
        </span>
        <span className="whitespace-nowrap">
          <span className="text-slate-400">{r.prev} → </span>
          <span className={r.delta > 0 ? 'text-red-300 font-bold' : r.delta < 0 ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
            {r.recent} {r.delta > 0 ? '▲' : r.delta < 0 ? '▼' : '■'}
          </span>
        </span>
      </button>
    ));

  const renderEarlyWarning = () => {
    const flagged = model.earlyCriteria.filter((r) => r.flagged).length + model.earlyMachines.filter((r) => r.flagged).length;
    return (
      <div className="space-y-3">
        <div className={`text-xs rounded-lg px-3 py-2 border ${flagged ? 'bg-red-500/10 border-red-500/40 text-red-200' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}`}>
          {flagged ? `${flagged} auffällige Anstiege` : 'Keine auffälligen Anstiege'} · letzte {EARLY_WINDOW_DAYS} Tage vs. {EARLY_WINDOW_DAYS} Tage davor
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Kriterien</div>
          <div className="space-y-1">{model.earlyCriteria.length ? renderEarlyRows(model.earlyCriteria, false) : <Empty>Keine Daten.</Empty>}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Maschinen</div>
          <div className="space-y-1">{model.earlyMachines.length ? renderEarlyRows(model.earlyMachines, true) : <Empty>Keine Daten.</Empty>}</div>
        </div>
        <p className="text-[10px] text-slate-500">
          ⚠ = mind. {EARLY_MIN_CASES} Fälle und ≥ {EARLY_FACTOR}× Vorperiode. Kleine Zahlen schwanken stark – Signal, kein Beweis.
        </p>
      </div>
    );
  };

  const renderRepeats = () =>
    model.repeats.length === 0 ? (
      <Empty tone="green">Keine Wiederholungen im Zeitraum.</Empty>
    ) : (
      <div className="space-y-1.5">
        {model.repeats.slice(0, 8).map((r) => (
          <button
            type="button"
            key={r.key}
            onClick={() => machinePanelOpen(r.machineId, r.criterion)}
            className="w-full text-left text-xs bg-[#1e293b] border border-slate-700 hover:bg-slate-800 rounded-md px-2.5 py-1.5"
          >
            <div className="flex justify-between gap-2">
              <span className="font-bold text-white truncate">
                {r.machineId} · {r.criterion}
              </span>
              <Badge tone={r.count >= 3 ? 'red' : 'amber'}>{r.count}×</Badge>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              zuletzt {fmtShort(r.last)}
              {r.avgGap != null ? ` · Ø alle ${r.avgGap.toFixed(1)} Tage` : ''}
              {r.open ? ` · ${r.open} offen` : ''}
            </div>
          </button>
        ))}
      </div>
    );

  const renderForecast = () => {
    const f = model.forecast;
    return (
      <div className="space-y-3">
        <WeekChart weeks={model.weeks} fit={f.reliable ? model.fit : null} forecast={f.reliable ? f : null} height={120} />
        {f.reliable ? (
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="Nächste 7 Tage" value={`~${f.value}`} sub={`Bandbreite ${f.lo}–${f.hi}`} tone="blue" />
            <Kpi
              label="Richtung"
              value={f.direction}
              sub={`${f.slopePct > 0 ? '+' : ''}${f.slopePct}% pro Woche`}
              tone={f.direction === 'steigend' ? 'red' : f.direction === 'fallend' ? 'green' : 'slate'}
            />
            <Kpi label="Ø pro Woche" value={model.fit.mean.toFixed(1)} sub="letzte 12 Wochen" />
          </div>
        ) : (
          <Empty>
            Zu wenig Daten für eine belastbare Schätzung ({f.total12} Vorfälle in 12 Wochen, Historie {Math.floor(f.historyWeeks)} Wochen).
            Benötigt: ≥ 10 Vorfälle, ≥ 4 Wochen mit Daten, ≥ 8 Wochen Historie.
          </Empty>
        )}
        <p className="text-[10px] text-slate-500">
          Lineare Regression über 12 abgeschlossene Wochen (Filter Maschine/Kriterium berücksichtigt). Bandbreite ≈ 95 % unter
          Poisson-Annahme. Statistische Fortschreibung, keine KI-Vorhersage.
        </p>
      </div>
    );
  };

  const renderQuality = () => {
    const q = model.qualityTickets;
    const byMachine = {};
    q.forEach((t) => {
      byMachine[t.machineId] = (byMachine[t.machineId] || 0) + 1;
    });
    const rows = Object.entries(byMachine).sort((a, b) => b[1] - a[1]);
    const crit = settings.qualityCriteria || [];
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {crit.map((c) => (
            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {c}
            </span>
          ))}
          <button type="button" onClick={() => setSettingsOpen(true)} className="text-[10px] text-amber-300 hover:underline px-1">
            anpassen
          </button>
        </div>
        {q.length === 0 ? (
          <Empty tone="green">Keine qualitätsrelevanten Vorfälle im Zeitraum.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Kpi label="Vorfälle" value={q.length} tone="amber" />
              <Kpi label="davon offen" value={q.filter((t) => t.isOpen).length} tone="red" />
              <Kpi label="Maschinen betroffen" value={rows.length} />
            </div>
            <div className="space-y-2">
              {rows.slice(0, 6).map(([m, n]) => (
                <HBar key={m} label={`Maschine ${m}`} value={n} max={rows[0][1]} onClick={() => machinePanelOpen(m)} />
              ))}
            </div>
            <div className="space-y-1 pt-2 border-t border-slate-700">
              {[...q]
                .sort((x, y) => y.created - x.created)
                .slice(0, 4)
                .map((t) => (
                  <div key={t.id} className="flex justify-between gap-2 text-xs">
                    <span className="text-slate-200 truncate">
                      {fmtShort(t.created)} · {t.machineId} · {t.criterion}
                    </span>
                    <Badge tone={t.isOpen ? 'red' : 'green'}>{t.isOpen ? 'offen' : 'erledigt'}</Badge>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderLessons = () => {
    const closed = model.closedInPeriod;
    const missing = closed.length - model.withCause.length;
    const recent = [...model.withCause].sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 5);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Kpi label="Geschlossen" value={closed.length} sub={periodLabel} />
          <Kpi label="ohne Ursache" value={missing} tone={missing ? 'amber' : 'green'} sub="KVP-Lücke" />
        </div>
        {recent.length === 0 ? (
          <Empty>Noch keine dokumentierten Ursachen im Zeitraum.</Empty>
        ) : (
          <div className="space-y-1.5">
            {recent.map((t) => (
              <div key={t.id} className="text-xs bg-[#1e293b] border border-slate-700 rounded p-2">
                <div className="flex justify-between gap-2 text-[11px] text-slate-400">
                  <span className="font-bold text-amber-300">
                    {t.machineId} · {t.criterion}
                  </span>
                  <span>{fmtShort(t.created)}</span>
                </div>
                <div className="text-emerald-300 mt-0.5">{t.cause}</div>
                {t.lessonsLearned && <div className="text-slate-300 mt-0.5">💡 {t.lessonsLearned}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderWidget = (id, grow) => {
    let content = null;
    let right = null;
    let title = WIDGETS[id]?.title || id;
    switch (id) {
      case 'kpis':
        content = renderKpis();
        title = `Kennzahlen · ${selectedGroupIds.length} ${selectedGroupIds.length === 1 ? 'Gruppe' : 'Gruppen'}`;
        break;
      case 'lines':
        content = renderLines();
        right = <span className="text-[11px] text-slate-400">Gruppe → Board · Maschine/Punkt → Details</span>;
        break;
      case 'alarms':
        content = renderAlarms(view !== 'betrieb' && !grow);
        right = <Badge tone={model.alarms.length ? 'red' : 'green'}>{model.alarms.length} Offen</Badge>;
        break;
      case 'trend14':
        content = renderTrend14();
        break;
      case 'blockers':
        content = renderBlockers();
        break;
      case 'aging':
        content = renderAging();
        right = <Badge tone={model.openTickets.length ? 'red' : 'green'}>{model.openTickets.length} offen</Badge>;
        break;
      case 'analysis':
        content = renderAnalysis();
        right = <Badge>{model.periodTickets.length} Vorfälle</Badge>;
        break;
      case 'risk':
        content = renderRisk();
        right = <span className="text-[11px] text-slate-400">letzte 30 Tage</span>;
        break;
      case 'escalation':
        content = renderEscalation();
        break;
      case 'earlywarning':
        content = renderEarlyWarning();
        break;
      case 'repeats':
        content = renderRepeats();
        right = <Badge tone={model.repeats.length ? 'amber' : 'green'}>{model.repeats.length}</Badge>;
        break;
      case 'forecast':
        content = renderForecast();
        right = <span className="text-[11px] text-slate-400">Vorfälle pro Woche</span>;
        break;
      case 'quality':
        content = renderQuality();
        break;
      case 'lessons':
        content = renderLessons();
        break;
      default:
        return null;
    }
    return (
      <Card key={id} title={title} right={right} grow={grow}>
        {content}
      </Card>
    );
  };

  // -----------------------------------------------------------------------
  // LAYOUT-BEARBEITUNG
  // -----------------------------------------------------------------------
  const saveLayout = (columns) => setLayouts((prev) => ({ ...prev, [view]: { columns } }));
  const moveWidget = (col, idx, dCol, dIdx) => {
    const cols = layout.map((c) => [...c]);
    const [id] = cols[col].splice(idx, 1);
    if (dCol) {
      const target = clamp(col + dCol, 0, 2);
      cols[target].splice(Math.min(idx, cols[target].length), 0, id);
    } else {
      cols[col].splice(clamp(idx + dIdx, 0, cols[col].length), 0, id);
    }
    saveLayout(cols);
  };
  const removeWidget = (col, idx) => {
    const cols = layout.map((c) => [...c]);
    cols[col].splice(idx, 1);
    saveLayout(cols);
  };
  const addWidget = (id, col) => {
    const cols = layout.map((c) => [...c]);
    cols[col].push(id);
    saveLayout(cols);
  };
  const hiddenWidgets = Object.keys(WIDGETS).filter((id) => !visibleWidgets.includes(id));

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  const btn = 'px-2.5 py-1 rounded text-xs font-bold border transition';
  const selectCls =
    'bg-[#0f172a] border border-slate-600 rounded-lg px-2 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-400';

  return (
    <div className="min-h-screen bg-[#1e293b] text-slate-100 font-sans">
      <div style={{ zoom: scale }} className="p-4 select-none">
        {/* ===== STEUERLEISTE ===== */}
        <div className="bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-2.5 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">Ansicht:</span>
            {Object.entries(VIEWS).map(([key, v]) => (
              <button
                type="button"
                key={key}
                title={v.hint}
                onClick={() => applyView(key)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  view === key ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">Abteilungen:</span>
            {availableGroups.map((grp) => {
              const active = selectedGroupIds.includes(grp.id);
              return (
                <button
                  type="button"
                  key={grp.id}
                  onClick={() => toggleGroup(grp.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition ${
                    active
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-800/60 border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {active ? '✓ ' : '+ '}
                  {grp.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2 py-1">
              <span className="text-[11px] font-bold text-slate-400">Zoom</span>
              <button
                type="button"
                onClick={() => setZoom(zoom.auto ? { auto: false, value: zoomPct } : { ...zoom, auto: true })}
                className={`px-1.5 rounded text-[11px] font-bold ${zoom.auto ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}
                title="Auto: passt sich der Bildschirmbreite an"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setManualZoom(zoomPct - 10)}
                className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-bold flex items-center justify-center"
              >
                −
              </button>
              <input
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step="5"
                value={zoomPct}
                onChange={(e) => setManualZoom(Number(e.target.value))}
                className="w-20 accent-amber-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setManualZoom(zoomPct + 10)}
                className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-bold flex items-center justify-center"
              >
                +
              </button>
              <span className="text-[11px] font-mono font-bold text-amber-400 w-10 text-right">{zoomPct}%</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCockpit(!showCockpit)}
              className={`${btn} ${showCockpit ? 'border-blue-400 bg-blue-500/20 text-blue-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
            >
              Cockpit {showCockpit ? 'AN' : 'AUS'}
            </button>
            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              className={`${btn} ${autoRotate ? 'border-amber-400 bg-amber-500/20 text-amber-300' : 'border-slate-700 bg-slate-800 text-slate-400'}`}
            >
              {autoRotate ? (overlayOpen ? '❚❚ pausiert' : `▶ Rotation (${rotateSec}s)`) : '❚❚ Manuell'}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={`${btn} border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700`}
            >
              ⚙ Anpassen
            </button>
            <button
              type="button"
              onClick={loadCockpitData}
              title={loadInfo.at ? `Zuletzt aktualisiert ${loadInfo.at.toLocaleTimeString('de-CH')}` : 'Aktualisieren'}
              className={`${btn} border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700`}
            >
              ↻
            </button>
            <button type="button" onClick={onCloseView} className="ml-1 px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold">
              ✕ Beenden
            </button>
          </div>
        </div>

        {/* ===== KOPFZEILE ===== */}
        <div className="flex flex-wrap items-center justify-between px-2 mb-3 gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl md:text-4xl font-extrabold text-amber-400 tracking-tight">Shopfloor Übersicht</h1>
            <div className="flex flex-wrap items-center gap-1.5 bg-[#0f172a] p-1 rounded-lg border border-slate-700">
              {slides.map((s, idx) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSlideIndex(idx)}
                  className={`px-3 py-1 rounded text-xs font-bold transition ${
                    slideIndex === idx ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {loadInfo.error && <Badge tone="red">⚠ {loadInfo.error}</Badge>}
          </div>
          <div className="text-2xl md:text-3xl font-mono font-bold text-amber-400">
            {fmtDate(currentTime)} {currentTime.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {currentSlide?.type === 'cockpit' ? (
          <>
            {/* ===== FILTERLEISTE ===== */}
            <div className="flex flex-wrap items-center gap-2 px-2 mb-3">
              <span className="text-xs text-slate-400 italic mr-2">
                <span className="font-bold not-italic text-slate-200">{VIEWS[view].label}:</span> {VIEWS[view].hint}
              </span>
              {showFilterBar && (
                <div className="flex flex-wrap items-center gap-2 ml-auto bg-[#0f172a]/80 border border-slate-700 rounded-lg px-2 py-1.5">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider text-slate-400"
                    title="Filter gelten für Ticket-Auswertungen. Live-Status (Linien, Störungen, Risiko) zeigt immer alles."
                  >
                    Auswertung ⓘ
                  </span>
                  <select value={filters.preset} onChange={(e) =>
                      setFilter(
                        e.target.value === 'custom'
                          ? { preset: 'custom', from: ymd(model.period.start), to: ymd(model.period.end) }
                          : { preset: e.target.value }
                      )
                    } className={selectCls}>
                    {PERIOD_PRESETS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {filters.preset === 'custom' && (
                    <>
                      <input
                        type="date"
                        value={filters.from || ymd(model.period.start)}
                        onChange={(e) => setFilter({ from: e.target.value })}
                        className={selectCls}
                      />
                      <span className="text-xs text-slate-400">bis</span>
                      <input
                        type="date"
                        value={filters.to || ymd(model.period.end)}
                        onChange={(e) => setFilter({ to: e.target.value })}
                        className={selectCls}
                      />
                    </>
                  )}
                  <select value={filters.machine} onChange={(e) => setFilter({ machine: e.target.value })} className={selectCls}>
                    <option value="all">Alle Maschinen ({model.machines.length})</option>
                    {model.machines.map((m) => (
                      <option key={`${m.panelId}-${m.id}`} value={m.id}>
                        {m.id} ({m.panelName.replace('Gruppe ', '')})
                      </option>
                    ))}
                  </select>
                  <select value={filters.criterion} onChange={(e) => setFilter({ criterion: e.target.value })} className={selectCls}>
                    <option value="all">Alle Kriterien</option>
                    {model.criteriaList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} className={selectCls}>
                    <option value="all">Alle Tickets</option>
                    <option value="open">Nur offene</option>
                    <option value="closed">Nur geschlossene</option>
                  </select>
                  {(filters.machine !== 'all' || filters.criterion !== 'all' || filters.status !== 'all' || filters.preset !== VIEWS[view].preset) && (
                    <button
                      type="button"
                      onClick={() => setFiltersAll((prev) => ({ ...prev, [view]: {} }))}
                      className="text-[11px] font-bold text-amber-300 hover:underline"
                    >
                      Zurücksetzen
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ===== COCKPIT-RASTER ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {layout.map((col, ci) => (
                <div key={ci} className={`${COLUMN_SPANS[ci]} flex flex-col gap-4 min-w-0`}>
                  {col.map((id, wi) => renderWidget(id, col.includes('alarms') ? id === 'alarms' : wi === col.length - 1))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white text-slate-900 rounded-xl p-4 shadow-xl">
            {panelsMap[currentSlide.id] && (
              <Matrix
                data={panelsMap[currentSlide.id].cells || {}}
                machines={panelsMap[currentSlide.id].machines || []}
                criteria={panelsMap[currentSlide.id].criteria || []}
                historyLog={panelsMap[currentSlide.id].historyLog || []}
                currentPanelName={panelsMap[currentSlide.id].name}
                onCellClick={(m, c) => onCellClick(m, c, currentSlide.id)}
                onAddMachine={onAddMachine}
                onAddCriterion={onAddCriterion}
                onDeleteMachine={onDeleteMachine}
                onDeleteCriterion={onDeleteCriterion}
              />
            )}
          </div>
        )}
      </div>

      {/* ===== FENSTER ===== */}
      {detail && (
        <MachineDetail
          target={detail}
          model={model}
          panelsMap={panelsMap}
          scale={scale}
          onClose={() => setDetail(null)}
          onEdit={(m, c, p) => editCell(m, c, p)}
          onOpenBoard={jumpToBoard}
        />
      )}

      {periodModal && (
        <FloatingWindow
          storageKey="sfc_win_period"
          title={periodModal.title}
          subtitle={`${periodModal.tickets.length} Vorfälle · ${selectedGroupIds.length} Gruppen · aktuelle Filter`}
          scale={scale}
          onClose={() => setPeriodModal(null)}
          defaultSize={{ w: 560, h: 520 }}
        >
          {periodModal.tickets.length === 0 ? (
            <Empty tone="green">In diesem Zeitraum wurden keine Störungen gemeldet.</Empty>
          ) : (
            <div className="space-y-2">
              {[...periodModal.tickets]
                .sort((a, b) => (b.created || 0) - (a.created || 0))
                .map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => {
                      machinePanelOpen(t.machineId, t.criterion);
                      setPeriodModal(null);
                    }}
                    className={`w-full text-left bg-[#1e293b] hover:bg-slate-800 border-l-4 ${
                      t.isOpen ? 'border-red-500' : 'border-emerald-500'
                    } border border-slate-700 p-3 rounded-lg`}
                  >
                    <div className="flex justify-between items-center text-xs mb-1 gap-2">
                      <span className="font-mono font-bold text-amber-400">{t.id}</span>
                      <span className="text-slate-400">{fmtDateTime(t.created)}</span>
                      <Badge tone={t.isOpen ? 'red' : 'green'}>{t.status}</Badge>
                    </div>
                    <div className="font-bold text-sm text-white">
                      Maschine {t.machineId} — {t.criterion}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">{t.title}</div>
                    {t.cause && (
                      <div className="text-xs text-emerald-300 mt-1.5 bg-slate-900/70 p-2 rounded">
                        <strong>Ursache:</strong> {t.cause}
                      </div>
                    )}
                  </button>
                ))}
            </div>
          )}
        </FloatingWindow>
      )}

      {settingsOpen && (
        <FloatingWindow
          storageKey="sfc_win_settings"
          title="Cockpit anpassen"
          subtitle={`Ansicht «${VIEWS[view].label}» · alle Änderungen werden auf diesem Gerät gespeichert`}
          scale={scale}
          onClose={() => setSettingsOpen(false)}
          defaultSize={{ w: 640, h: 640 }}
        >
          <div className="space-y-5 text-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Layout dieser Ansicht</span>
                <button
                  type="button"
                  onClick={() => setLayouts((prev) => ({ ...prev, [view]: undefined }))}
                  className="text-[11px] font-bold text-amber-300 hover:underline"
                >
                  Standard wiederherstellen
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {layout.map((col, ci) => (
                  <div key={ci} className="bg-[#1e293b] border border-slate-700 rounded-lg p-2 space-y-1.5 min-w-0">
                    <div className="text-[11px] font-bold text-slate-400">{COLUMN_NAMES[ci]}</div>
                    {col.length === 0 && <div className="text-[11px] text-slate-500 italic">leer</div>}
                    {col.map((id, wi) => (
                      <div key={id} className="bg-slate-800 rounded p-1.5">
                        <div className="text-xs font-bold text-white truncate mb-1">{WIDGETS[id].title}</div>
                        <div className="flex gap-1 text-[11px]">
                          <button type="button" onClick={() => moveWidget(ci, wi, 0, -1)} className="px-1.5 rounded bg-slate-700 hover:bg-slate-600" title="nach oben">
                            ↑
                          </button>
                          <button type="button" onClick={() => moveWidget(ci, wi, 0, 1)} className="px-1.5 rounded bg-slate-700 hover:bg-slate-600" title="nach unten">
                            ↓
                          </button>
                          <button
                            type="button"
                            disabled={ci === 0}
                            onClick={() => moveWidget(ci, wi, -1, 0)}
                            className="px-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
                            title="Spalte links"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            disabled={ci === 2}
                            onClick={() => moveWidget(ci, wi, 1, 0)}
                            className="px-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30"
                            title="Spalte rechts"
                          >
                            →
                          </button>
                          <button
                            type="button"
                            onClick={() => removeWidget(ci, wi)}
                            className="ml-auto px-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                            title="ausblenden"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {hiddenWidgets.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-bold text-slate-400 mb-1.5">Weitere Bausteine hinzufügen</div>
                  <div className="space-y-1">
                    {hiddenWidgets.map((id) => (
                      <div key={id} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 text-slate-300">{WIDGETS[id].title}</span>
                        {COLUMN_NAMES.map((n, ci) => (
                          <button
                            type="button"
                            key={n}
                            onClick={() => addWidget(id, ci)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                          >
                            + {n}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Punktgrösse Produktionslinien</div>
                <div className="flex gap-1">
                  {Object.keys(DOT_SIZES).map((k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setSettings({ ...settings, dotSize: k })}
                      className={`${btn} ${settings.dotSize === k ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rotations-Intervall</div>
                <div className="flex gap-1">
                  {[10, 15, 30, 60].map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSettings({ ...settings, rotateSec: s })}
                      className={`${btn} ${rotateSec === s ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 border-slate-600 text-slate-300'}`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Qualitätsrelevante Kriterien (für «Prävention»)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set([...model.criteriaList, ...(settings.qualityCriteria || [])])).map((c) => {
                  const on = (settings.qualityCriteria || []).includes(c);
                  return (
                    <button
                      type="button"
                      key={c}
                      onClick={() =>
                        setSettings({
                          ...settings,
                          qualityCriteria: on ? settings.qualityCriteria.filter((x) => x !== c) : [...(settings.qualityCriteria || []), c]
                        })
                      }
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${
                        on ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-slate-800/60 border-slate-700 text-slate-400'
                      }`}
                    >
                      {on ? '✓ ' : '+ '}
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-700 flex justify-between items-center">
              <span className="text-[11px] text-slate-500">Fenster lassen sich an der Titelleiste verschieben und unten rechts in der Grösse ändern.</span>
              <button
                type="button"
                onClick={() => {
                  setLayouts({});
                  setFiltersAll({});
                  setSettings(DEFAULT_SETTINGS);
                  setZoom({ auto: true, value: 100 });
                }}
                className="text-[11px] font-bold text-red-300 hover:underline whitespace-nowrap ml-3"
              >
                Alles zurücksetzen
              </button>
            </div>
          </div>
        </FloatingWindow>
      )}
    </div>
  );
}




