// =========================================================================
// ACTION ENGINE – Hauptansicht
// -------------------------------------------------------------------------
// Lädt Konfiguration und Tickets, hält die Auswahl und leitet alle
// Benutzeraktionen an die API weiter. Darstellung steckt in den
// Komponenten daneben:
//   TicketList        offene Vorfälle mit Eskalationsuhr
//   TicketDetail      Phasen 0·P·D·C·A, Eskalationspfad, Verlauf
//   AnalysisView      Historie & Auswertung mit Filtern, Kennzahlen, Export
//   CalendarSettings  Ein-/Zweischicht je Maschine, Feiertage
//   OutboxView        Postausgang: Vorschau aller Mails
// =========================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { Badge, Empty, Notice, inputClass } from './ui.jsx';
import TicketList, { byUrgency } from './TicketList.jsx';
import TicketDetail from './TicketDetail.jsx';
import AnalysisView from './AnalysisView.jsx';
import CalendarSettings from './CalendarSettings.jsx';
import OutboxView from './OutboxView.jsx';

const REFRESH_MS = 30 * 1000; // Tickets und Eskalationsuhren alle 30 s neu laden
const AUTHOR_KEY = 'sf-action-engine-author';

const TABS = [
  { id: 'active', label: 'Offene Vorfälle' },
  { id: 'analysis', label: 'Historie & Auswertung' },
  { id: 'calendar', label: 'Kalender & Stufen' },
  { id: 'outbox', label: 'Postausgang' }
];

// Name der Person am Bildschirm – wird bei jeder Änderung mitgespeichert
function useAuthor() {
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) || '';
    } catch {
      return '';
    }
  });
  const update = (name) => {
    setAuthor(name);
    try {
      localStorage.setItem(AUTHOR_KEY, name);
    } catch {
      /* Browser ohne Speicher – Name gilt nur für diese Sitzung */
    }
  };
  return [author, update];
}

export default function ActionEngine() {
  const [config, setConfig] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState('active');
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [author, setAuthor] = useAuthor();

  const load = useCallback(async () => {
    try {
      const [cfg, list] = await Promise.all([config ? Promise.resolve(config) : api.config(), api.tickets()]);
      setConfig(cfg);
      setTickets(list);
    } catch (e) {
      setError(`Daten konnten nicht geladen werden: ${e.message}`);
    }
  }, [config]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const open = useMemo(() => tickets.filter((t) => !t.closedAt).sort(byUrgency), [tickets]);
  const selected = tickets.find((t) => t.id === selectedId) || null;

  // Erstes Ticket automatisch öffnen, damit die Ansicht nie leer ist
  useEffect(() => {
    if (tab === 'active' && !selectedId && open.length) setSelectedId(open[0].id);
  }, [tab, selectedId, open]);

  // Führt eine API-Aktion aus, ersetzt das Ticket in der Liste und meldet Fehler.
  // Gibt true zurück, wenn es geklappt hat.
  const run = async (action) => {
    try {
      const updated = await action();
      setTickets((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      setError(null);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const id = selected?.id;
  const who = author.trim() || 'Unbekannt';
  const handlers = {
    edit: (fields) => run(() => api.editTicket(id, fields, who)),
    nextPhase: () => run(() => api.nextPhase(id, who)),
    previousPhase: () => run(() => api.previousPhase(id, who)),
    addTask: (task) => run(() => api.addTask(id, task, who)),
    toggleTask: (taskId) => run(() => api.toggleTask(id, taskId, who)),
    removeTask: (taskId) => run(() => api.removeTask(id, taskId, who)),
    effectiveness: (result, note) =>
      run(async () => {
        const t = await api.effectiveness(id, result, note, who);
        return result === 'wirksam' ? api.nextPhase(id, who) : t;
      }),
    escalation: (mode, reason) => {
      const call = { up: api.escalate, down: api.deEscalate, dismiss: api.dismissEscalation }[mode];
      return run(async () => {
        const t = await call(id, reason, who);
        if (mode === 'up') setInfo(`Mail an ${config.levels[t.escalationInfo.currentLevel].short} erstellt – siehe Postausgang.`);
        return t;
      });
    }
  };

  const dueCount = open.filter((t) => t.escalationInfo.suggestedLevel != null).length;

  return (
    <div className="min-h-screen bg-[#1e293b] text-slate-100 font-sans p-4">
      {/* Steuerleiste */}
      <div className="bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-2.5 mb-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-amber-400 tracking-tight">Action Engine</h1>
          <div className="flex gap-1.5 bg-[#1e293b] p-1 rounded-lg border border-slate-700">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setSelectedId(null);
                }}
                className={`px-3 py-1 rounded text-xs font-bold transition ${
                  tab === t.id ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
                {t.id === 'active' && ` (${open.length})`}
              </button>
            ))}
          </div>
          {dueCount > 0 && <Badge tone="red">{dueCount} Eskalation{dueCount > 1 ? 'en' : ''} vorgeschlagen</Badge>}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
          Du bist:
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Name eingeben"
            className={`${inputClass} w-44 py-1 text-xs ${author.trim() ? '' : 'border-amber-500'}`}
          />
        </label>
      </div>

      {(error || info) && (
        <div className="mb-4 flex flex-col gap-2">
          <Notice onClose={() => setError(null)}>{error}</Notice>
          <Notice tone="info" onClose={() => setInfo(null)}>{info}</Notice>
        </div>
      )}

      {!config ? (
        <Empty>Lade Action Engine …</Empty>
      ) : tab === 'outbox' ? (
        <OutboxView />
      ) : tab === 'calendar' ? (
        <CalendarSettings config={config} onChanged={load} />
      ) : tab === 'analysis' && !selected ? (
        <AnalysisView tickets={tickets} config={config} onSelect={setSelectedId} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_2.2fr] gap-4 items-start">
          {tab === 'active' ? (
            <TicketList tickets={open} config={config} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <button type="button" onClick={() => setSelectedId(null)} className="text-left text-xs text-amber-300 hover:text-amber-200">
              ← Zurück zur Auswertung
            </button>
          )}
          {selected ? (
            <TicketDetail ticket={selected} config={config} handlers={handlers} />
          ) : (
            <Empty>Wähle links einen Vorfall aus.</Empty>
          )}
        </div>
      )}
    </div>
  );
}
