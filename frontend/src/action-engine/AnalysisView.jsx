// =========================================================================
// HISTORIE & AUSWERTUNG
// -------------------------------------------------------------------------
// Gezielt suchen und auswerten: Zeitraum, Gruppe, Maschine, Kriterium,
// Status, erreichte Stufe, Wirksamkeit und Volltext (Ursache, 5× Warum,
// Massnahmen, Lessons Learned). Ein Klick auf einen Balken setzt den Filter.
// Die Filter bleiben im Browser gespeichert.
// =========================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Badge, Button, Empty, inputClass } from './ui.jsx';
import { formatDate, formatWorkTime } from './format.js';
import { api } from './api.js';
import {
  PERIODS,
  DEFAULT_FILTERS,
  REPEAT_WINDOW_DAYS,
  applyFilters,
  kpis,
  countBy,
  timeline,
  findRepeats,
  maxLevel,
  failedChecks,
  downloadCsv
} from './analysis.js';

const FILTER_KEY = 'sf-action-engine-filters';
const selectClass = 'bg-[#0f172a] border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400';

function usePersistentFilters() {
  const [filters, setFilters] = useState(() => {
    try {
      return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(FILTER_KEY) || '{}') };
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {
      /* ohne Browserspeicher gelten die Filter nur für diese Sitzung */
    }
  }, [filters]);
  return [filters, setFilters];
}

// --- Bausteine ---------------------------------------------------------------------

function Kpi({ label, value, sub, tone = 'text-white' }) {
  return (
    <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-3 text-center min-w-0">
      <div className="text-xs text-slate-400 truncate">{label}</div>
      <div className={`text-2xl font-black mt-0.5 ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 truncate">{sub}</div>}
    </div>
  );
}

// Horizontale Balken; Klick setzt bzw. löst den Filter
function Bars({ rows, active, onPick, limit = 8, color = 'bg-amber-400' }) {
  if (!rows.length) return <Empty>Keine Daten im gewählten Filter.</Empty>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-1.5">
      {rows.slice(0, limit).map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onPick(active === r.key ? 'all' : r.key)}
          className={`text-left rounded-md px-1.5 py-1 hover:bg-slate-800 ${active === r.key ? 'bg-slate-800 ring-1 ring-amber-400' : ''}`}
        >
          <div className="flex justify-between text-xs text-slate-300">
            <span className="truncate">{r.label}</span>
            <span className="font-bold text-white">{r.count}</span>
          </div>
          <div className="h-1.5 bg-slate-900 rounded-full mt-1">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
          </div>
        </button>
      ))}
    </div>
  );
}

function Timeline({ data }) {
  const max = Math.max(1, ...data.points.map((p) => p.count));
  return (
    <div>
      <div className="flex items-end gap-1 h-28">
        {data.points.map((p) => (
          <div key={p.key} className="flex-1 flex flex-col items-center justify-end h-full" title={`${p.label}: ${p.count}`}>
            {p.count > 0 && <span className="text-[10px] text-slate-400">{p.count}</span>}
            <div className="w-full bg-sky-400/80 rounded-t" style={{ height: `${(p.count / max) * 85}%`, minHeight: p.count ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {data.points.map((p, i) => (
          <span key={p.key} className="flex-1 text-center text-[10px] text-slate-500 truncate">
            {data.points.length > 14 && i % 2 ? '' : p.label}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 mt-1">Vorfälle je {data.unit}</p>
    </div>
  );
}

const COLUMNS = [
  { id: 'createdAt', label: 'Gemeldet', value: (t) => t.createdAt },
  { id: 'machineId', label: 'Maschine', value: (t) => t.machineId },
  { id: 'criterion', label: 'Kriterium', value: (t) => t.criterion },
  { id: 'title', label: 'Vorfall', value: (t) => t.title },
  { id: 'cause', label: 'Ursache', value: (t) => t.cause || '' },
  { id: 'level', label: 'Höchste Stufe', value: (t) => maxLevel(t) },
  { id: 'work', label: 'Dauer', value: (t) => t.escalationInfo.workedMs },
  { id: 'status', label: 'Status', value: (t) => t.status }
];

// --- Hauptansicht ---------------------------------------------------------------------

export default function AnalysisView({ tickets, config, onSelect }) {
  const [filters, setFilters] = usePersistentFilters();
  const [panels, setPanels] = useState([]);
  const [sort, setSort] = useState({ id: 'createdAt', desc: true });
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    api.calendars().then(setPanels).catch(() => setPanels([]));
  }, []);

  const panelName = (id) => panels.find((p) => p.panelId === id)?.name || id;
  const levels = config.levels;

  // Auswahllisten aus den vorhandenen Tickets
  const options = useMemo(() => {
    const scoped = filters.panel === 'all' ? tickets : tickets.filter((t) => t.panelId === filters.panel);
    const uniq = (xs) => [...new Set(xs.filter(Boolean))].sort();
    return {
      panels: uniq(tickets.map((t) => t.panelId)),
      machines: uniq(scoped.map((t) => t.machineId)),
      criteria: uniq(scoped.map((t) => t.criterion))
    };
  }, [tickets, filters.panel]);

  const list = useMemo(() => applyFilters(tickets, filters), [tickets, filters]);
  const k = useMemo(() => kpis(list), [list]);
  const byMachine = useMemo(() => countBy(list, (t) => t.machineId, (m) => `Maschine ${m}`), [list]);
  const byCriterion = useMemo(() => countBy(list, (t) => t.criterion), [list]);
  const byCause = useMemo(() => countBy(list, (t) => t.cause.trim()), [list]);
  const byLevel = useMemo(() => countBy(list, maxLevel, (i) => levels[i].short).sort((a, b) => a.key - b.key), [list, levels]);
  const trend = useMemo(() => timeline(list, filters), [list, filters]);
  const repeats = useMemo(() => findRepeats(list), [list]);

  const rows = useMemo(() => {
    const col = COLUMNS.find((c) => c.id === sort.id);
    return [...list].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'de');
      return sort.desc ? -cmp : cmp;
    });
  }, [list, sort]);

  const activeCount = Object.keys(DEFAULT_FILTERS).filter((key) => filters[key] !== DEFAULT_FILTERS[key]).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Filterleiste */}
      <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select value={filters.period} onChange={(e) => set('period')(e.target.value)} className={selectClass}>
            {PERIODS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          {filters.period === 'custom' && (
            <>
              <input type="date" value={filters.from} onChange={(e) => set('from')(e.target.value)} className={selectClass} />
              <span className="text-xs text-slate-500">bis</span>
              <input type="date" value={filters.to} onChange={(e) => set('to')(e.target.value)} className={selectClass} />
            </>
          )}
          <select value={filters.panel} onChange={(e) => setFilters((f) => ({ ...f, panel: e.target.value, machine: 'all', criterion: 'all' }))} className={selectClass}>
            <option value="all">Alle Gruppen</option>
            {options.panels.map((p) => (
              <option key={p} value={p}>{panelName(p)}</option>
            ))}
          </select>
          <select value={filters.machine} onChange={(e) => set('machine')(e.target.value)} className={selectClass}>
            <option value="all">Alle Maschinen</option>
            {options.machines.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={filters.criterion} onChange={(e) => set('criterion')(e.target.value)} className={selectClass}>
            <option value="all">Alle Kriterien</option>
            {options.criteria.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => set('status')(e.target.value)} className={selectClass}>
            <option value="all">Offen und geschlossen</option>
            <option value="open">Nur offene</option>
            <option value="closed">Nur geschlossene</option>
          </select>
          <select value={filters.minLevel} onChange={(e) => set('minLevel')(Number(e.target.value))} className={selectClass}>
            <option value={0}>Jede Stufe</option>
            {levels.slice(1).map((l, i) => (
              <option key={l.name} value={i + 1}>mind. {l.short}</option>
            ))}
          </select>
          <select value={filters.effectiveness} onChange={(e) => set('effectiveness')(e.target.value)} className={selectClass}>
            <option value="all">Jede Wirksamkeit</option>
            <option value="failed">Mind. einmal nicht wirksam</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={filters.text}
            onChange={(e) => set('text')(e.target.value)}
            placeholder="Suchen in Vorfall, Ursache, 5× Warum, Massnahmen, Lessons Learned (mehrere Wörter = alle müssen vorkommen)"
            className={`${inputClass} flex-1 min-w-[280px] py-1.5 text-xs`}
          />
          {activeCount > 0 && <Button onClick={() => setFilters(DEFAULT_FILTERS)}>Filter zurücksetzen ({activeCount})</Button>}
          <Button variant="primary" disabled={!list.length} onClick={() => downloadCsv(rows, levels)}>
            CSV für Excel ({list.length})
          </Button>
        </div>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi label="Vorfälle" value={k.total} sub={`${k.open} offen · ${k.closed} geschlossen`} />
        <Kpi label="Ø Dauer bis Abschluss" value={formatWorkTime(k.avgWorkMs)} sub="Arbeitszeit" tone="text-sky-300" />
        <Kpi label="Eskaliert" value={k.escalationRate == null ? '–' : `${Math.round(k.escalationRate * 100)} %`} sub="mind. eine Stufe hoch" tone="text-amber-400" />
        <Kpi label="Wiederholer" value={k.repeats} sub={`gleiche Maschine + Kriterium ≤ ${REPEAT_WINDOW_DAYS} Tage`} tone={k.repeats ? 'text-red-400' : 'text-white'} />
        <Kpi label="Nicht wirksam" value={k.failedChecks} sub="Massnahme verfehlt" tone={k.failedChecks ? 'text-red-400' : 'text-white'} />
        <Kpi label="Mit Lessons Learned" value={list.filter((t) => t.lessonsLearned).length} sub="Wissensbausteine" tone="text-emerald-400" />
      </div>

      {/* Aufschlüsselungen */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card title="Nach Maschine">
          <Bars rows={byMachine} active={filters.machine} onPick={set('machine')} />
        </Card>
        <Card title="Nach Kriterium">
          <Bars rows={byCriterion} active={filters.criterion} onPick={set('criterion')} color="bg-sky-400" />
        </Card>
        <Card title="Häufigste Ursachen">
          <Bars rows={byCause} active={null} onPick={(cause) => set('text')(cause === 'all' ? '' : cause)} color="bg-red-400" />
        </Card>
        <Card title="Höchste erreichte Stufe">
          <Bars rows={byLevel} active={null} onPick={(lvl) => set('minLevel')(lvl === 'all' ? 0 : lvl)} color="bg-violet-400" />
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_3fr] gap-4">
        <Card title="Verlauf">
          {list.length ? <Timeline data={trend} /> : <Empty>Keine Daten im gewählten Filter.</Empty>}
        </Card>
        <Card title={`Wiederholer (${repeats.length})`}>
          {repeats.length === 0 ? (
            <Empty>Keine Wiederholungen im gewählten Filter.</Empty>
          ) : (
            <ul className="flex flex-col gap-2 text-xs">
              {repeats.slice(0, 6).map((r) => (
                <li key={`${r.machineId}|${r.criterion}`} className="bg-[#0f172a] border border-red-500/30 rounded-lg px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <button type="button" className="font-bold text-white hover:text-amber-300" onClick={() => setFilters((f) => ({ ...f, machine: r.machineId, criterion: r.criterion }))}>
                      Maschine {r.machineId} · {r.criterion}
                    </button>
                    <Badge tone="red">{r.tickets.length}×</Badge>
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    {r.causes.length ? `Ursachen: ${r.causes.join(' · ')}` : 'Noch keine Ursache erfasst'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Trefferliste */}
      <Card title={`Treffer (${rows.length})`}>
        {rows.length === 0 ? (
          <Empty>Keine Tickets im gewählten Filter.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-600">
                <tr>
                  <th className="p-2">ID</th>
                  {COLUMNS.map((c) => (
                    <th key={c.id} className="p-2">
                      <button type="button" className="font-bold uppercase hover:text-white" onClick={() => setSort((s) => ({ id: c.id, desc: s.id === c.id ? !s.desc : true }))}>
                        {c.label} {sort.id === c.id ? (sort.desc ? '▾' : '▴') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {rows.slice(0, 200).map((t) => (
                  <tr key={t.id} onClick={() => onSelect(t.id)} className="hover:bg-slate-800/60 cursor-pointer align-top">
                    <td className="p-2 font-mono text-amber-300 whitespace-nowrap">{t.id}</td>
                    <td className="p-2 text-slate-300 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                    <td className="p-2 text-slate-300">{t.machineId}</td>
                    <td className="p-2 text-slate-300">{t.criterion}</td>
                    <td className="p-2 text-white font-bold">{t.title}</td>
                    <td className="p-2 text-slate-300 max-w-xs">{t.cause || '–'}</td>
                    <td className="p-2"><Badge tone={maxLevel(t) >= 3 ? 'red' : maxLevel(t) >= 1 ? 'amber' : 'slate'}>{levels[maxLevel(t)].short}</Badge></td>
                    <td className="p-2 text-slate-300 whitespace-nowrap">{formatWorkTime(t.escalationInfo.workedMs)}</td>
                    <td className="p-2 whitespace-nowrap">
                      <Badge tone={t.closedAt ? 'green' : 'blue'}>{t.status}</Badge>
                      {failedChecks(t) > 0 && <Badge tone="red">{failedChecks(t)}× nicht wirksam</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="text-[11px] text-slate-500 mt-2">Angezeigt: 200 von {rows.length}. Für alle Treffer den CSV-Export nutzen.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
