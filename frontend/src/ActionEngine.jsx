import React, { useState, useEffect } from 'react';

export default function ActionEngine() {
  // Tabs für Hauptansicht: "active" (Aktive Vorfälle) oder "history" (Historie & Auswertung)
  const [activeTab, setActiveTab] = useState('active');
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // States für Formulareingaben
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskOwner, setNewTaskOwner] = useState('Instandhaltung');
  const [kvpCause, setKvpCause] = useState('');
  const [kvpLesson, setKvpLesson] = useState('');

  // Initialisierung erweiterter Mock-Daten
  useEffect(() => {
    const mockData = [
      {
        id: "ACT-000123",
        machineId: "13503",
        status: "Analyse", // Analyse, Massnahmen, KVP, Geschlossen
        escalationLevel: "Shopfloor (Lvl 1)",
        title: "Maschine 13503 steht - Spindelfehler",
        cause: "",
        lessonsLearned: "",
        tasks: [
          { id: "TSK-01", title: "Kühlmittelfilter spülen", owner: "Instandhaltung", status: "open" }
        ]
      },
      {
        id: "ACT-000120",
        machineId: "10244",
        status: "Geschlossen",
        escalationLevel: "Produktionsleitung (Lvl 3)",
        title: "Druckabfall Hydraulikaggregat",
        cause: "Verschlissene O-Ring-Dichtung am Hauptventil durch Kavitation.",
        lessonsLearned: "Wartungsintervall für Dichtungen dieses Typs von 12 auf 9 Monate verkürzen.",
        tasks: [
          { id: "TSK-99", title: "Dichtung tauschen", owner: "Instandhaltung", status: "completed" }
        ]
      }
    ];
    setTickets(mockData);
  }, []);

  // Task hinzufügen
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedTicket) return;

    const newTask = {
      id: `TSK-${Date.now().toString().slice(-2)}`,
      title: newTaskTitle,
      owner: newTaskOwner,
      status: 'open'
    };

    const updatedTickets = tickets.map(t => {
      if (t.id === selectedTicket.id) {
        return { 
          ...t, 
          tasks: [...t.tasks, newTask],
          status: t.status === 'Analyse' ? 'Massnahmen' : t.status // Automatisch in Phase "Massnahmen" wechseln
        };
      }
      return t;
    });

    setTickets(updatedTickets);
    setSelectedTicket(updatedTickets.find(t => t.id === selectedTicket.id));
    setNewTaskTitle('');
  };

  // Task-Status umschalten
  const toggleTaskStatus = (taskId) => {
    const updatedTickets = tickets.map(t => {
      if (t.id === selectedTicket.id) {
        const updatedTasks = t.tasks.map(task => 
          task.id === taskId ? { ...task, status: task.status === 'open' ? 'completed' : 'open' } : task
        );
        return { ...t, tasks: updatedTasks };
      }
      return t;
    });
    setTickets(updatedTickets);
    setSelectedTicket(updatedTickets.find(t => t.id === selectedTicket.id));
  };

  // Manuelle Eskalation triggern
  const triggerEscalation = () => {
    const levels = ["Shopfloor (Lvl 1)", "Schichtleitung (Lvl 2)", "Produktionsleitung (Lvl 3)", "Werksleitung (Lvl 4)"];
    const currentIdx = levels.indexOf(selectedTicket.escalationLevel);
    if (currentIdx < levels.length - 1) {
      const nextLevel = levels[currentIdx + 1];
      const updatedTickets = tickets.map(t => 
        t.id === selectedTicket.id ? { ...t, escalationLevel: nextLevel } : t
      );
      setTickets(updatedTickets);
      setSelectedTicket(updatedTickets.find(t => t.id === selectedTicket.id));
    }
  };

  // KVP / 8D abschliessen (Kreislauf schliessen)
  const submitKvpAndClose = (e) => {
    e.preventDefault();
    const updatedTickets = tickets.map(t => {
      if (t.id === selectedTicket.id) {
        return {
          ...t,
          status: 'Geschlossen',
          cause: kvpCause,
          lessonsLearned: kvpLesson,
          tasks: t.tasks.map(task => ({ ...task, status: 'completed' })) // Alle verbleibenden Tasks schliessen
        };
      }
      return t;
    });
    setTickets(updatedTickets);
    setSelectedTicket(null); // Deselektieren nach Abschluss
    setKvpCause('');
    setKvpLesson('');
  };

  // Filterung für Listen & Historie
  const activeTickets = tickets.filter(t => t.status !== 'Geschlossen');
  const closedTickets = tickets.filter(t => t.status === 'Geschlossen');

  return (
    <div className="bg-slate-900 min-h-screen text-slate-100 p-6 font-sans antialiased">
      <header className="border-b border-slate-800 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black tracking-wider text-blue-400">FACTORYAI // ACTION ENGINE</h1>
          <p className="text-xs text-slate-400">Ebene 2 — Shopfloor Learning Matrix & KVP-Gedächtnis</p>
        </div>
        {/* Navigation Tabs */}
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs font-bold">
          <button 
            onClick={() => { setActiveTab('active'); setSelectedTicket(null); }}
            className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Aktiver Shopfloor ({activeTickets.length})
          </button>
          <button 
            onClick={() => { setActiveTab('history'); setSelectedTicket(null); }}
            className={`px-4 py-2 rounded-md transition-colors ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Historie & Auswertung ({closedTickets.length})
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
              {activeTickets.map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setKvpCause(ticket.cause);
                    setKvpLesson(ticket.lessonsLearned);
                  }}
                  className={`p-3 rounded-lg cursor-pointer border-l-4 transition-all ${
                    selectedTicket?.id === ticket.id 
                      ? 'bg-slate-700 border-blue-500 shadow-lg' 
                      : 'bg-slate-700/60 border-red-500 hover:bg-slate-600'
                  }`}
                >
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>{ticket.id}</span>
                    <span className="bg-slate-900 text-amber-400 px-1.5 rounded text-[10px] border border-amber-800/40">
                      {ticket.status}
                    </span>
                  </div>
                  <div className="text-sm font-bold mt-1 text-white">{ticket.title}</div>
                  <div className="text-[10px] text-slate-400 mt-2 flex justify-between items-center">
                    <span>Maschine: {ticket.machineId}</span>
                    <span className="text-red-400 bg-red-950 px-1 rounded">{ticket.escalationLevel}</span>
                  </div>
                </div>
              ))}
              {activeTickets.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500">Keine offenen Vorfälle. Störungsfreier Betrieb.</div>
              )}
            </div>
          </div>

          {/* RECHTER BEREICH: CENTRALE ACTION ENGINE DOCK */}
          <div className="md:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700">
            {selectedTicket ? (
              <div>
                {/* Header Detailansicht */}
                <div className="flex justify-between items-start border-b border-slate-700 pb-4 mb-4">
                  <div>
                    <span className="text-xs font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                      {selectedTicket.id}
                    </span>
                    <h2 className="text-xl font-bold text-white mt-2">{selectedTicket.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Asset-ID: Maschine {selectedTicket.machineId}</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-bold text-slate-500">Eskalationsstufe</span>
                    <span className="text-sm font-bold text-red-400 block bg-red-950/80 px-2 py-1 rounded border border-red-900 mt-1">
                      {selectedTicket.escalationLevel}
                    </span>
                    <button 
                      onClick={triggerEscalation} 
                      className="mt-2 text-[10px] bg-slate-700 hover:bg-red-800 hover:text-white text-slate-300 px-2 py-1 rounded transition-colors font-mono"
                    >
                      $\rightarrow$ Eine Ebene eskalieren
                    </button>
                  </div>
                </div>
                
                {/* Visualisierter Fortschrittspfad basierend auf IKOS */}
                <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-900 p-4 rounded-lg text-xs font-bold justify-between mb-6 border border-slate-800">
                  
                  {/* Stufe 1: Analyse */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <span className={`pb-1 uppercase tracking-wider ${
                      selectedTicket.status === 'Analyse' 
                        ? 'text-blue-400 border-b-2 border-blue-400' 
                        : 'text-emerald-400'
                    }`}>
                      1. Analyse
                    </span>
                    <svg className="h-4 w-4 text-slate-600 hidden sm:block mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                
                  {/* Stufe 2: Massnahmen */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <span className={`pb-1 uppercase tracking-wider ${
                      selectedTicket.status === 'Massnahmen' 
                        ? 'text-blue-400 border-b-2 border-blue-400' 
                        : (selectedTicket.status === 'KVP' || selectedTicket.status === 'Geschlossen') 
                          ? 'text-emerald-400' 
                          : 'text-slate-500'
                    }`}>
                      2. Massnahmen
                    </span>
                    <svg className="h-4 w-4 text-slate-600 hidden sm:block mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                
                  {/* Stufe 3: KVP / 8D */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <span className={`pb-1 uppercase tracking-wider ${
                      selectedTicket.status === 'KVP' 
                        ? 'text-blue-400 border-b-2 border-blue-400' 
                        : selectedTicket.status === 'Geschlossen' 
                          ? 'text-emerald-400' 
                          : 'text-slate-500'
                    }`}>
                      3. KVP / 8D
                    </span>
                    <svg className="h-4 w-4 text-slate-600 hidden sm:block mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                
                  {/* Stufe 4: Lessons Learned */}
                  <div className="flex items-center w-full sm:w-auto justify-between sm:justify-start">
                    <span className={`pb-1 uppercase tracking-wider ${selectedTicket.status === 'Geschlossen' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500'}`}>
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
                      {selectedTicket.tasks.map(t => (
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
                            <span className={t.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-200'}>
                              {t.title}
                            </span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.status === 'completed' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
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
                          <option value="Instandhaltung">Instandhaltung</option>
                          <option value="Schichtleiter">Schichtleiter</option>
                          <option value="Qualitätssicherung">Qualitätssicherung</option>
                          <option value="Prozesstechnik">Prozesstechnik</option>
                        </select>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors whitespace-nowrap">
                          + Zuweisen
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Spalte: KVP & 8D Feedback */}
                  <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/60 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">KVP & 8D Einbindung</h3>
                      <p className="text-[11px] text-slate-400 mb-3">Ursache erfassen, um das IKOS-Gedächtnis anzulernen.</p>
                    </div>

                    <form onSubmit={submitKvpAndClose} className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Wahre Ursache (Root Cause)</label>
                        <textarea 
                          required
                          rows="2"
                          placeholder="Warum trat der Fehler auf? (z.B. Materialermüdung)"
                          value={kvpCause}
                          onChange={(e) => {
                            setKvpCause(e.target.value);
                            if (selectedTicket.status === 'Massnahmen' || selectedTicket.status === 'Analyse') {
                              const updated = tickets.map(t => t.id === selectedTicket.id ? { ...t, status: 'KVP' } : t);
                              setTickets(updated);
                              setSelectedTicket(updated.find(t => t.id === selectedTicket.id));
                            }
                          }}
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
                      <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded transition-colors uppercase tracking-wide">
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
          {/* KPI Dashboard Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Gelöste Fälle gesamt</span>
              <span className="text-3xl font-black text-emerald-400 mt-1 block">{closedTickets.length}</span>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Wissensbausteine</span>
              <span className="text-3xl font-black text-blue-400 mt-1 block">
                {closedTickets.filter(t => t.lessonsLearned).length}
              </span>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <span className="block text-xs text-slate-400 uppercase tracking-wider font-bold">Eskalationsquote</span>
              <span className="text-3xl font-black text-amber-500 mt-1 block">
                {closedTickets.length > 0 
                  ? `${Math.round((closedTickets.filter(t => t.escalationLevel !== 'Shopfloor (Lvl 1)').length / closedTickets.length) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>

          {/* Historic Knowledge Base Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">IKOS Unternehmensgedächtnis (Archiv)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-mono border-b border-slate-700">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Vorfall</th>
                    <th className="p-3">Maschine</th>
                    <th className="p-3">Max. Eskalation</th>
                    <th className="p-3">Root Cause (KVP)</th>
                    <th className="p-3">Lessons Learned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {closedTickets.map(ticket => (
                    <tr key={ticket.id} className="hover:bg-slate-750 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-400">{ticket.id}</td>
                      <td className="p-3 font-bold text-white">{ticket.title}</td>
                      <td className="p-3 text-slate-300">{ticket.machineId}</td>
                      <td className="p-3">
                        <span className="bg-slate-900 text-red-400 px-1.5 py-0.5 rounded border border-red-950">
                          {ticket.escalationLevel}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate" title={ticket.cause}>
                        {ticket.cause || 'N/A'}
                      </td>
                      <td className="p-3 text-emerald-400 max-w-xs truncate" title={ticket.lessonsLearned}>
                        {ticket.lessonsLearned || 'N/A'}
                      </td>
                    </tr>
                  ))}
                  {closedTickets.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-slate-500">
                        Noch keine Daten im Archiv vorhanden.
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

