import React, { useState, useEffect, useMemo } from 'react';
import { LEVEL_STYLES, levelIndex, ensureGlobalStyles } from './escalationUi'; // Ergänzt am 20.11.2026
import { TICKET_COLUMNS, downloadCsv, printReport, printTicketReport } from './exportUtils'; // Ergänzt am 20.11.2026

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

const fmtDate = (v) => {
  if (!v) return '–';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const fmtDateTime = (v) => {
  if (!v) return '–';
  const d = new Date(v);
  return isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtHours = (h) => {
  if (h == null || isNaN(h)) return '–';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} Tage`;
};
const hoursBetween = (a, b) => {
  const s = Date.parse(a);
  const e = Date.parse(b);
  return s && e && e >= s ? (e - s) / 3600000 : null;
};

const EMPTY_FILTERS = { q: '', group: 'all', machine: 'all', criterion: 'all', level: 'all', from: '', to: '', status: 'closed', repeat: 'all' };

function LevelChip({ level, auto }) {
  const idx = levelIndex(level);
  const st = LEVEL_STYLES[idx];
  return (
    <span
      className="text-[10px] font-black px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: idx >= 1 ? st.color : '#450a0a', color: idx >= 1 ? '#0f172a' : '#f87171' }}
    >
      {idx >= 1 ? '▲ ' : ''}
      {level || 'Shopfloor (Lvl 1)'}
      {auto && idx >= 1 ? ' · auto' : ''}
    </span>
  );
}

export default function ActionEngine() {
  ensureGlobalStyles();
  // Tabs für Hauptansicht: "active" (Aktive Vorfälle) oder "history" (Historie & Auswertung)
  const [activeTab, setActiveTab] = useState('active');
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States für Formulareingaben
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskOwner, setNewTaskOwner] = useState('Instandhaltung');
  const [kvpCause, setKvpCause] = useState('');
  const [kvpLesson, setKvpLesson] = useState('');

  // Wiederholfall-Formular
  const [recMode, setRecMode] = useState(null); // null | 'same'
  const [recRelated, setRecRelated] = useState('');
  const [recWhy, setRecWhy] = useState('');
  const [recNext, setRecNext] = useState('');
  const [recAuthor, setRecAuthor] = useState('');

  // Historie: Filter & aufgeklappte Zeile
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [expandedId, setExpandedId] = useState(null);

  const selectedTicket = tickets.find((t) => t.id === selectedId) || null;

  // 1. Alle Tickets vom Backend laden (alle 30 s neu → automatische Eskalationen werden sichtbar)
  const fetchTickets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tickets`);
      if (!response.ok) throw new Error('Fehler beim Laden der Tickets');
      const data = await response.json();
      setTickets(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Tickets konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    const t = setInterval(fetchTickets, 30000);
    return () => clearInterval(t);
  }, []);

  const selectTicket = (ticket) => {
    setSelectedId(ticket.id);
    setKvpCause(ticket.cause || '');
    setKvpLesson(ticket.lessonsLearned || '');
    setRecMode(null);
    setRecRelated(ticket.recurrence?.candidates?.[0]?.id || '');
    setRecWhy('');
    setRecNext('');
  };

  const postJson = async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    if (!response.ok) {
      let msg = 'Aktion fehlgeschlagen';
      try {
        msg = (await response.json()).error || msg;
      } catch (e) {
        /* keine JSON-Antwort */
      }
      throw new Error(msg);
    }
    return response.json();
  };

  // 2. Neuen Task zu einem bestehenden Ticket hinzufügen
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedTicket) return;
    try {
      await postJson(`${API_URL}/api/ticket/${selectedTicket.id}/task`, { title: newTaskTitle, owner: newTaskOwner });
      setNewTaskTitle('');
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    }
  };

  // 3. Status eines Tasks umschalten (open <-> completed)
  const toggleTaskStatus = async (taskId) => {
    if (!selectedTicket) return;
    try {
      await postJson(`${API_URL}/api/ticket/${selectedTicket.id}/task/${taskId}/toggle`);
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    }
  };

  // 4. Manuelle Eskalation / Zurückstufen
  const triggerEscalation = async () => {
    if (!selectedTicket) return;
    try {
      await postJson(`${API_URL}/api/ticket/${selectedTicket.id}/escalate`);
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    }
  };
  const triggerDeEscalation = async () => {
    if (!selectedTicket) return;
    try {
      await postJson(`${API_URL}/api/ticket/${selectedTicket.id}/de-escalate`);
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    }
  };

  // 5. Wiederholfall beantworten
  const submitRecurrence = async (decision) => {
    if (!selectedTicket) return;
    try {
      await postJson(`${API_URL}/api/ticket/${selectedTicket.id}/recurrence`, {
        decision,
        relatedId: recRelated,
        whyFailed: recWhy,
        nextStep: recNext,
        author: recAuthor.trim() || 'Unbekannt'
      });
      setRecMode(null);
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    }
  };

  // 6. KVP / 8D abschliessen und Ticket archivieren (Kreislauf schliessen)
  const submitKvpAndClose = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;
    try {
      await postJson(`${API_URL}/api/ticket/${selectedTicket.id}/close`, { cause: kvpCause, lessonsLearned: kvpLesson });
      setKvpCause('');
      setKvpLesson('');
      setSelectedId(null);
      await fetchTickets();
    } catch (err) {
      alert(err.message);
    }
  };

  // ---------------------------------------------------------------------
  // Listen
  // ---------------------------------------------------------------------
  const activeTickets = useMemo(
    () =>
      tickets
        .filter((t) => t.status !== 'Geschlossen')
        .sort(
          (a, b) =>
            levelIndex(b.escalationLevel) - levelIndex(a.escalationLevel) ||
            Number(!!b.machineDown) - Number(!!a.machineDown) ||
            Date.parse(a.createdAt) - Date.parse(b.createdAt)
        ),
    [tickets]
  );

  const groups = useMemo(() => {
    const m = {};
    tickets.forEach((t) => {
      if (t.panelId) m[t.panelId] = t.panelName || t.panelId;
    });
    return Object.entries(m);
  }, [tickets]);
  const machines = useMemo(
    () =>
      Array.from(new Set(tickets.filter((t) => filters.group === 'all' || t.panelId === filters.group).map((t) => String(t.machineId)))).sort(),
    [tickets, filters.group]
  );
  const criteria = useMemo(() => Array.from(new Set(tickets.map((t) => t.criterion).filter(Boolean))).sort(), [tickets]);

  const historyTickets = useMemo(() => {
    const q = filters.q.toLowerCase().trim();
    const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
    const to = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null;
    return tickets
      .filter((t) => {
        if (filters.status === 'closed' && t.status !== 'Geschlossen') return false;
        if (filters.status === 'open' && t.status === 'Geschlossen') return false;
        if (filters.group !== 'all' && t.panelId !== filters.group) return false;
        if (filters.machine !== 'all' && String(t.machineId) !== filters.machine) return false;
        if (filters.criterion !== 'all' && t.criterion !== filters.criterion) return false;
        if (filters.level !== 'all' && levelIndex(t.escalationLevel) < Number(filters.level)) return false;
        const c = Date.parse(t.createdAt);
        if (from && (!c || c < from)) return false;
        if (to && (!c || c > to)) return false;
        if (filters.repeat === 'is' && t.recurrence?.decision !== 'same') return false;
        if (filters.repeat === 'had' && !(t.recurredBy || []).length) return false;
        if (!q) return true;
        return [t.id, t.title, t.machineId, t.criterion, t.cause, t.lessonsLearned, t.escalationLevel, t.panelName, t.recurrence?.whyFailed, t.recurrence?.nextStep]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [tickets, filters]);

  const closedAll = tickets.filter((t) => t.status === 'Geschlossen');
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const setF = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const filterSummary = () => {
    const parts = [];
    if (filters.status === 'closed') parts.push('nur geschlossene');
    if (filters.status === 'open') parts.push('nur offene');
    if (filters.group !== 'all') parts.push(`Gruppe ${groups.find((g) => g[0] === filters.group)?.[1] || filters.group}`);
    if (filters.machine !== 'all') parts.push(`Maschine ${filters.machine}`);
    if (filters.criterion !== 'all') parts.push(`Kriterium ${filters.criterion}`);
    if (filters.level !== 'all') parts.push(`ab ${LEVEL_STYLES[Number(filters.level)].short}`);
    if (filters.from || filters.to) parts.push(`Zeitraum ${filters.from || '…'} bis ${filters.to || '…'}`);
    if (filters.repeat === 'is') parts.push('nur Wiederholfälle');
    if (filters.repeat === 'had') parts.push('nur Fälle, die sich wiederholt haben');
    if (filters.q) parts.push(`Suche «${filters.q}»`);
    return parts.join(' · ') || 'alle Fälle';
  };

  if (loading && tickets.length === 0) {
    return <div className="p-6 text-white text-center">Lade Action Engine Daten...</div>;
  }

  const inputCls =
    'text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-blue-500 placeholder-slate-500';
  const info = selectedTicket?.escalationInfo;
  const rec = selectedTicket?.recurrence;
  const needsRecDecision = !!(rec?.candidates?.length && !rec.decision);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-100 p-6 font-sans antialiased">
      <header className="border-b border-slate-800 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black tracking-wider text-blue-400">FACTORYAI // ACTION ENGINE</h1>
          <p className="text-xs text-slate-400">Ebene 2 — Shopfloor Learning Matrix & KVP-Gedächtnis</p>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab('active');
              setSelectedId(null);
            }}
            className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Aktiver Shopfloor ({activeTickets.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setSelectedId(null);
            }}
            className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Historie & Auswertung ({closedAll.length})
          </button>
        </div>
      </header>

      {activeTab === 'active' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LINKER BEREICH: VORFÄLLE */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 h-fit">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex justify-between">
              <span>Aktive Vorfälle</span>
              <span className="animate-pulse bg-red-900/50 text-red-400 border border-red-800 px-1.5 rounded text-[10px]">LIVE</span>
            </h2>

            <div className="space-y-2">
              {activeTickets.map((ticket) => {
                const idx = levelIndex(ticket.escalationLevel);
                const st = LEVEL_STYLES[idx];
                const ei = ticket.escalationInfo;
                const undecided = ticket.recurrence?.candidates?.length && !ticket.recurrence.decision;
                return (
                  <div
                    key={ticket.id}
                    onClick={() => selectTicket(ticket)}
                    className={`p-3 rounded-lg cursor-pointer border-l-4 transition-all ${idx >= 1 ? 'sf-esc-pulse' : ''} ${
                      selectedId === ticket.id ? 'bg-slate-700 shadow-lg ring-1 ring-blue-500' : 'bg-slate-700/60 hover:bg-slate-600'
                    }`}
                    style={{ borderLeftColor: st.color, '--sf-esc-color': st.color }}
                  >
                    <div className="flex justify-between text-xs font-mono text-slate-400">
                      <span>{ticket.id}</span>
                      <span className="bg-slate-900 text-amber-400 px-1.5 rounded text-[10px] border border-amber-800/40">{ticket.status}</span>
                    </div>
                    <div className="text-sm font-bold mt-1 text-white">{ticket.title}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {ticket.machineDown && <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white text-slate-900">⛔ steht</span>}
                      {undecided ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-yellow-300 text-yellow-950">↻ Wiederholfall?</span>
                      ) : ticket.recurrence?.decision === 'same' ? (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-yellow-300 text-yellow-950">↻ Wiederholfall</span>
                      ) : null}
                      {ei && !ei.running && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">behoben · KVP offen</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 flex justify-between items-center gap-2">
                      <span>
                        Maschine: {ticket.machineId}
                        {ei?.running && ei.nextLevel ? ` · → ${LEVEL_STYLES[levelIndex(ei.nextLevel)].short} in ${fmtHours(ei.nextInHours)}` : ''}
                      </span>
                      <LevelChip level={ticket.escalationLevel} auto={ticket.autoEscalated} />
                    </div>
                  </div>
                );
              })}
              {activeTickets.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500">Keine offenen Vorfälle. Störungsfreier Betrieb.</div>
              )}
            </div>
          </div>

          {/* RECHTER BEREICH: ZENTRALE ACTION ENGINE DOCK */}
          <div className="md:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700">
            {selectedTicket ? (
              <div>
                {/* Header Detailansicht */}
                <div className="flex justify-between items-start border-b border-slate-700 pb-4 mb-4 gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">{selectedTicket.id}</span>
                      <LevelChip level={selectedTicket.escalationLevel} auto={selectedTicket.autoEscalated} />
                      {selectedTicket.machineDown && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white text-slate-900">⛔ Maschine steht</span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-white mt-2">{selectedTicket.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Asset-ID: Maschine {selectedTicket.machineId}
                      {selectedTicket.panelName ? ` · ${selectedTicket.panelName}` : ''} · gemeldet {fmtDateTime(selectedTicket.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={triggerDeEscalation}
                        className="text-[10px] bg-slate-700 hover:bg-emerald-800 hover:text-white text-slate-300 px-2 py-1 rounded transition-colors font-mono"
                      >
                        &larr; Ebene runter
                      </button>
                      <button
                        onClick={triggerEscalation}
                        className="text-[10px] bg-slate-700 hover:bg-red-800 hover:text-white text-slate-300 px-2 py-1 rounded transition-colors font-mono"
                      >
                        &rarr; Ebene hoch eskalieren
                      </button>
                    </div>
                    <button
                      onClick={() => printTicketReport(selectedTicket)}
                      className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded font-bold"
                    >
                      🖨️ Fallbericht
                    </button>
                  </div>
                </div>

                {/* Eskalations-Uhr */}
                {info && (
                  <div
                    className="mb-4 rounded-lg p-3 text-xs border flex flex-wrap gap-x-6 gap-y-1"
                    style={{
                      borderColor: LEVEL_STYLES[info.levelIndex].color,
                      background: info.levelIndex >= 1 ? `${LEVEL_STYLES[info.levelIndex].color}22` : '#0f172a'
                    }}
                  >
                    <span>
                      <strong>Aktive Störungszeit:</strong> {fmtHours(info.activeHours)}
                    </span>
                    {info.running ? (
                      info.nextLevel ? (
                        <span>
                          <strong>Nächste Stufe:</strong> {info.nextLevel} in {fmtHours(info.nextInHours)}
                          {selectedTicket.machineDown ? ' (Maschine steht → halbe Zeit)' : ''}
                        </span>
                      ) : (
                        <span>
                          <strong>Höchste Stufe erreicht.</strong>
                        </span>
                      )
                    ) : (
                      <span className="text-emerald-300">
                        <strong>Uhr angehalten:</strong> Störung am Shopfloor behoben {fmtDateTime(selectedTicket.resolvedAt)} – KVP noch offen
                      </span>
                    )}
                  </div>
                )}

                {/* Wiederholfall */}
                {rec?.candidates?.length > 0 && (
                  <div className="mb-6 rounded-lg border-2 border-yellow-400 bg-yellow-400/10 p-4">
                    {!rec.decision ? (
                      <>
                        <div className="text-sm font-black text-yellow-300 mb-1">↻ Möglicher Wiederholfall – ist das derselbe Fall?</div>
                        <p className="text-[11px] text-slate-300 mb-3">
                          Auf Maschine {selectedTicket.machineId} gab es mit dem Kriterium «{selectedTicket.criterion}» in den letzten 90 Tagen bereits
                          folgende {rec.candidates.length === 1 ? 'Fall' : 'Fälle'}:
                        </p>
                        <div className="space-y-2 mb-3">
                          {rec.candidates.map((c) => (
                            <label
                              key={c.id}
                              className={`block rounded-lg p-2.5 border cursor-pointer ${
                                recRelated === c.id ? 'border-yellow-400 bg-slate-900' : 'border-slate-700 bg-slate-900/60'
                              }`}
                            >
                              <div className="flex items-center gap-2 text-xs">
                                <input type="radio" checked={recRelated === c.id} onChange={() => setRecRelated(c.id)} className="accent-yellow-400" />
                                <span className="font-mono font-bold text-blue-300">{c.id}</span>
                                <span className="text-slate-400">{fmtDate(c.createdAt)}</span>
                                <span className="text-slate-500">· {c.status}</span>
                              </div>
                              <div className="text-xs text-white font-bold mt-1">{c.title}</div>
                              <div className="text-[11px] mt-1">
                                <span className="text-slate-400">Ursache:</span> <span className="text-slate-200">{c.cause || '– (nicht dokumentiert)'}</span>
                              </div>
                              <div className="text-[11px]">
                                <span className="text-slate-400">Lessons Learned:</span>{' '}
                                <span className="text-emerald-300">{c.lessonsLearned || '– (nicht dokumentiert)'}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                        {recMode !== 'same' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRecMode('same')}
                              className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xs font-black px-3 py-2 rounded"
                            >
                              Ja, derselbe Fall
                            </button>
                            <button
                              onClick={() => submitRecurrence('different')}
                              className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-2 rounded"
                            >
                              Nein, anderer Fall – normaler Ablauf
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-yellow-200 mb-1">
                                Warum hat die Massnahme / Lessons Learned nicht gegriffen?
                              </label>
                              <textarea rows="2" value={recWhy} onChange={(e) => setRecWhy(e.target.value)} className={`w-full ${inputCls}`} />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase font-bold text-yellow-200 mb-1">Was machen wir jetzt anders?</label>
                              <textarea rows="2" value={recNext} onChange={(e) => setRecNext(e.target.value)} className={`w-full ${inputCls}`} />
                            </div>
                            <div className="flex gap-2 items-center">
                              <input
                                value={recAuthor}
                                onChange={(e) => setRecAuthor(e.target.value)}
                                placeholder="Kürzel"
                                className={`${inputCls} w-28`}
                              />
                              <button
                                onClick={() => submitRecurrence('same')}
                                disabled={!recWhy.trim() || !recNext.trim()}
                                className="bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-slate-950 text-xs font-black px-3 py-2 rounded"
                              >
                                Als Wiederholfall speichern
                              </button>
                              <button onClick={() => setRecMode(null)} className="text-xs text-slate-400 hover:text-white px-2">
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : rec.decision === 'same' ? (
                      <div className="text-xs space-y-1">
                        <div className="text-sm font-black text-yellow-300">↻ Wiederholfall von {rec.relatedId}</div>
                        <div>
                          <span className="text-slate-400">Warum nicht gegriffen:</span> {rec.whyFailed}
                        </div>
                        <div>
                          <span className="text-slate-400">Was jetzt anders:</span> <span className="text-emerald-300">{rec.nextStep}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Entschieden von {rec.decidedBy} am {fmtDateTime(rec.decidedAt)}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300">
                        Geprüft: kein Wiederholfall ({rec.decidedBy}, {fmtDateTime(rec.decidedAt)}).
                      </div>
                    )}
                  </div>
                )}

                {/* Visualisierter Fortschrittspfad */}
                <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-900 p-4 rounded-lg text-xs font-bold justify-between mb-6 border border-slate-800">
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <span
                      className={`pb-1 uppercase tracking-wider ${
                        selectedTicket.status === 'Analyse' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-emerald-400'
                      }`}
                    >
                      1. Analyse
                    </span>
                    <span className="text-slate-600 hidden sm:block mx-2">&rarr;</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <span
                      className={`pb-1 uppercase tracking-wider ${
                        selectedTicket.status === 'Massnahmen'
                          ? 'text-blue-400 border-b-2 border-blue-400'
                          : selectedTicket.status === 'KVP' || selectedTicket.status === 'Geschlossen'
                          ? 'text-emerald-400'
                          : 'text-slate-500'
                      }`}
                    >
                      2. Massnahmen
                    </span>
                    <span className="text-slate-600 hidden sm:block mx-2">&rarr;</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <span
                      className={`pb-1 uppercase tracking-wider ${
                        selectedTicket.status === 'KVP'
                          ? 'text-blue-400 border-b-2 border-blue-400'
                          : selectedTicket.status === 'Geschlossen'
                          ? 'text-emerald-400'
                          : 'text-slate-500'
                      }`}
                    >
                      3. KVP / 8D
                    </span>
                    <span className="text-slate-600 hidden sm:block mx-2">&rarr;</span>
                  </div>
                  <div className="flex items-center w-full sm:w-auto justify-between sm:justify-start">
                    <span
                      className={`pb-1 uppercase tracking-wider ${
                        selectedTicket.status === 'Geschlossen' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      4. Lessons Learned
                    </span>
                  </div>
                </div>

                {/* Grid für Tasks und KVP-Abschluss */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Spalte: Task Management */}
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/60">
                    <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Taskvergabe & Aktionen</h3>

                    <div className="space-y-2 mb-4 max-h-[180px] overflow-y-auto">
                      {selectedTicket.tasks?.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => toggleTaskStatus(t.id)}
                          className="flex justify-between text-xs bg-slate-900 hover:bg-slate-800 p-2.5 rounded items-center border border-slate-800 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={t.status === 'completed'}
                              readOnly
                              className="rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-0"
                            />
                            <span className="font-mono text-blue-400">[{t.owner}]</span>
                            <span className={t.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'}>{t.title}</span>
                          </div>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              t.status === 'completed' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddTask} className="space-y-2 border-t border-slate-800 pt-3">
                      <input
                        type="text"
                        placeholder="Neue Sofortmassnahme beschreiben..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="w-full text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <select
                          value={newTaskOwner}
                          onChange={(e) => setNewTaskOwner(e.target.value)}
                          className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none w-full"
                        >
                          {/* Technische Bereiche */}
                          <option value="Instandhaltung">Instandhaltung (Mechanik/Elektrik)</option>
                          <option value="Prozesstechnik">Prozesstechnik / CAM</option>
                          <option value="Werkzeugbau">Werkzeugbau / Betriebsmittel</option>
                          {/* Führung & Steuerung */}
                          <option value="Gruppenleitung">Gruppenleitung</option>
                          <option value="Inselleitung">Inselleitung</option>
                          <option value="Produktionsleitung">Produktionsleitung</option>
                          <option value="AVOR / KAIZEN">AVOR / KAIZEN / KVP</option>
                          {/* Logistik & Qualität */}
                          <option value="Qualitätssicherung">Qualitätssicherung (QS)</option>
                          <option value="Logistik / Lager">Logistik / Lager / Disposition</option>
                          <option value="Einkauf / Material">Einkauf / Materialversorgung</option>
                          {/* Infrastruktur */}
                          <option value="IT / Shopfloor-Support">IT / Shopfloor-Support</option>
                        </select>
                        <button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors whitespace-nowrap"
                        >
                          + Zuweisen
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Spalte: KVP & 8D Feedback */}
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/60 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">KVP & 8D Einbindung</h3>
                      <p className="text-[11px] text-slate-400 mb-3">Ursache erfassen, um das IKL-Gedächtnis anzulernen.</p>
                    </div>
                    <form onSubmit={submitKvpAndClose} className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Wahre Ursache (Root Cause)</label>
                        <textarea
                          required
                          rows="2"
                          placeholder="Warum trat der Fehler auf? (z.B. Materialermüdung)"
                          value={kvpCause}
                          onChange={(e) => setKvpCause(e.target.value)}
                          className="w-full text-xs bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Lessons Learned / Wissensbaustein</label>
                        <textarea
                          required
                          rows="2"
                          placeholder="Wie verhindern wir das zukünftig nachhaltig?"
                          value={kvpLesson}
                          onChange={(e) => setKvpLesson(e.target.value)}
                          className="w-full text-xs bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      {needsRecDecision && (
                        <p className="text-[11px] text-yellow-300 font-bold">↻ Bitte zuerst oben beantworten, ob es ein Wiederholfall ist.</p>
                      )}
                      <button
                        type="submit"
                        disabled={needsRecDecision}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-2 rounded transition-colors uppercase tracking-wide"
                      >
                        Lernschleife schliessen & Archivieren
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-24 border border-dashed border-slate-700 rounded-xl">
                <div className="text-sm font-bold text-slate-400">Keine Auswahl getroffen</div>
                <p className="text-xs text-slate-600 mt-1">Wähle links ein aktives Störungs-Ticket aus.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: HISTORIE / UNTERNEHMENSGEDÄCHTNIS */
        <div className="space-y-6">
          {/* KPI Dashboard Analytics Cards (beziehen sich auf die gefilterte Auswahl) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Fälle in Auswahl</span>
              <span className="text-3xl font-black text-emerald-400 mt-1 block">{historyTickets.length}</span>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Wissensbausteine</span>
              <span className="text-3xl font-black text-blue-400 mt-1 block">{historyTickets.filter((t) => t.lessonsLearned).length}</span>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Eskalationsquote</span>
              <span className="text-3xl font-black text-amber-500 mt-1 block">
                {historyTickets.length ? `${Math.round((historyTickets.filter((t) => levelIndex(t.escalationLevel) >= 1).length / historyTickets.length) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-yellow-700/60">
              <span className="block text-xs text-yellow-300 uppercase tracking-wider font-bold">Lessons ohne Wirkung</span>
              <span className="text-3xl font-black text-yellow-300 mt-1 block">{historyTickets.filter((t) => (t.recurredBy || []).length).length}</span>
              <span className="text-[11px] text-slate-400">Fälle, die sich danach wiederholt haben</span>
            </div>
          </div>

          {/* Such- und Filterleiste */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">IKL Unternehmensgedächtnis (Archiv)</h2>
                <p className="text-[11px] text-slate-500">Filtern, durchsuchen, drucken und nach Excel exportieren</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    printReport({
                      title: 'Action Engine – Fallübersicht',
                      subtitle: filterSummary(),
                      columns: TICKET_COLUMNS.filter((c) =>
                        ['ID', 'Gruppe', 'Maschine', 'Kriterium', 'Status', 'Stufe', 'Gemeldet', 'Störungsdauer (h)', 'Ursache', 'Lessons Learned', 'Wiederholfall von', 'Hat sich wiederholt (Folgefälle)'].includes(c.label)
                      ),
                      rows: historyTickets
                    })
                  }
                  className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-2 rounded-lg"
                >
                  🖨️ Liste drucken
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    downloadCsv(`Faelle_${d.toISOString().slice(0, 10)}.csv`, TICKET_COLUMNS, historyTickets);
                  }}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg"
                >
                  📊 Excel
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
              <input
                type="text"
                placeholder="🔍 Text, ID, Ursache, Wissen…"
                value={filters.q}
                onChange={(e) => setF({ q: e.target.value })}
                className={`${inputCls} col-span-2`}
              />
              <select value={filters.status} onChange={(e) => setF({ status: e.target.value })} className={inputCls}>
                <option value="closed">Geschlossene</option>
                <option value="open">Offene</option>
                <option value="all">Alle Fälle</option>
              </select>
              <select value={filters.group} onChange={(e) => setF({ group: e.target.value, machine: 'all' })} className={inputCls}>
                <option value="all">Alle Gruppen</option>
                {groups.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <select value={filters.machine} onChange={(e) => setF({ machine: e.target.value })} className={inputCls}>
                <option value="all">Alle Maschinen</option>
                {machines.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select value={filters.criterion} onChange={(e) => setF({ criterion: e.target.value })} className={inputCls}>
                <option value="all">Alle Kriterien</option>
                {criteria.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={filters.level} onChange={(e) => setF({ level: e.target.value })} className={inputCls}>
                <option value="all">Alle Stufen</option>
                <option value="1">ab Gruppenleitung</option>
                <option value="2">ab Inselleitung</option>
                <option value="3">Produktionsleitung</option>
              </select>
              <select value={filters.repeat} onChange={(e) => setF({ repeat: e.target.value })} className={inputCls}>
                <option value="all">Wiederholung: alle</option>
                <option value="is">Nur Wiederholfälle</option>
                <option value="had">Hat sich wiederholt</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">Gemeldet von</span>
              <input type="date" value={filters.from} onChange={(e) => setF({ from: e.target.value })} className={inputCls} />
              <span className="text-slate-400">bis</span>
              <input type="date" value={filters.to} onChange={(e) => setF({ to: e.target.value })} className={inputCls} />
              {filtersActive && (
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-amber-300 font-bold hover:underline ml-2">
                  Filter zurücksetzen
                </button>
              )}
              <span className="ml-auto text-slate-500">{filterSummary()}</span>
            </div>
          </div>

          {/* Historic Knowledge Base Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-mono border-b border-slate-700">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Datum</th>
                    <th className="p-3">Vorfall</th>
                    <th className="p-3">Maschine</th>
                    <th className="p-3">Max. Eskalation</th>
                    <th className="p-3">Dauer</th>
                    <th className="p-3">Root Cause (KVP)</th>
                    <th className="p-3">Lessons Learned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {historyTickets.map((ticket) => {
                    const open = expandedId === ticket.id;
                    const dur = hoursBetween(ticket.createdAt, ticket.resolvedAt || ticket.closedAt);
                    return (
                      <React.Fragment key={ticket.id}>
                        <tr onClick={() => setExpandedId(open ? null : ticket.id)} className="hover:bg-slate-700/40 transition-colors cursor-pointer">
                          <td className="p-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                            {open ? '▾ ' : '▸ '}
                            {ticket.id}
                          </td>
                          <td className="p-3 text-slate-300 whitespace-nowrap">{fmtDate(ticket.createdAt)}</td>
                          <td className="p-3 font-bold text-white">
                            {ticket.title}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {ticket.status !== 'Geschlossen' && (
                                <span className="text-[10px] px-1.5 rounded bg-red-950 text-red-300">offen</span>
                              )}
                              {ticket.recurrence?.decision === 'same' && (
                                <span className="text-[10px] px-1.5 rounded bg-yellow-300 text-yellow-950 font-black">↻ Wiederholfall von {ticket.recurrence.relatedId}</span>
                              )}
                              {(ticket.recurredBy || []).length > 0 && (
                                <span className="text-[10px] px-1.5 rounded bg-yellow-900 text-yellow-200 font-bold">
                                  ⚠ hat sich wiederholt ({ticket.recurredBy.join(', ')})
                                </span>
                              )}
                              {ticket.machineDown && <span className="text-[10px] px-1.5 rounded bg-white text-slate-900 font-bold">⛔ stand</span>}
                            </div>
                          </td>
                          <td className="p-3 text-slate-300 whitespace-nowrap">
                            {ticket.machineId}
                            <div className="text-[10px] text-slate-500">{ticket.panelName || ''}</div>
                          </td>
                          <td className="p-3">
                            <LevelChip level={ticket.escalationLevel} auto={ticket.autoEscalated} />
                          </td>
                          <td className="p-3 text-slate-300 whitespace-nowrap">{fmtHours(dur)}</td>
                          <td className="p-3 text-slate-400 max-w-xs truncate" title={ticket.cause}>
                            {ticket.cause || 'N/A'}
                          </td>
                          <td className="p-3 text-emerald-400 max-w-xs truncate" title={ticket.lessonsLearned}>
                            {ticket.lessonsLearned || 'N/A'}
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-900/70">
                            <td colSpan="8" className="p-4">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold text-slate-500">Zeitachse</div>
                                  <div>Gemeldet: {fmtDateTime(ticket.createdAt)}</div>
                                  <div>Am Shopfloor behoben: {fmtDateTime(ticket.resolvedAt)}</div>
                                  <div>Abgeschlossen: {fmtDateTime(ticket.closedAt)}</div>
                                  <div>Kriterium: {ticket.criterion}</div>
                                  <div>Status: {ticket.status}</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold text-slate-500">KVP</div>
                                  <div>
                                    <span className="text-slate-400">Ursache:</span> {ticket.cause || '–'}
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Lessons Learned:</span> <span className="text-emerald-300">{ticket.lessonsLearned || '–'}</span>
                                  </div>
                                  {ticket.recurrence?.decision === 'same' && (
                                    <>
                                      <div>
                                        <span className="text-yellow-300">Warum nicht gegriffen:</span> {ticket.recurrence.whyFailed}
                                      </div>
                                      <div>
                                        <span className="text-yellow-300">Was jetzt anders:</span> {ticket.recurrence.nextStep}
                                      </div>
                                    </>
                                  )}
                                  {(ticket.tasks || []).length > 0 && (
                                    <div className="pt-1">
                                      <span className="text-slate-400">Massnahmen:</span>
                                      {ticket.tasks.map((k) => (
                                        <div key={k.id}>
                                          • [{k.owner}] {k.title}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[10px] uppercase font-bold text-slate-500">Verlauf</div>
                                  {(ticket.history || []).slice(-8).map((h, i) => (
                                    <div key={i} className="text-slate-300">
                                      <span className="text-slate-500">{fmtDateTime(h.timestamp)}</span> · {h.details || h.event}
                                    </div>
                                  ))}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      printTicketReport(ticket);
                                    }}
                                    className="mt-2 bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded"
                                  >
                                    🖨️ Fallbericht drucken
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {historyTickets.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-8 text-slate-500">
                        {filtersActive ? 'Keine Fälle für diese Filter.' : 'Noch keine Daten im Archiv vorhanden.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
