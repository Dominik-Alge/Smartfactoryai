// src/ActionEngine.jsx
import React, { useState, useEffect } from 'react';

export default function ActionEngine() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Beispiel-Daten initialisieren (Später fetch vom Backend)
  useEffect(() => {
    const mockData = [
      {
        id: "ACT-000123",
        machineId: "13503",
        status: "Analyse",
        title: "Maschine 13503 steht - ROT",
        tasks: [
          { id: "TSK-01", title: "Kühlmittelfilter spülen", owner: "Instandhaltung", status: "open" }
        ]
      }
    ];
    setTickets(mockData);
  }, []);

  return (
    <div className="bg-slate-900 min-h-screen text-slate-100 p-6 font-sans">
      <header className="border-b border-slate-800 pb-4 mb-6">
        <h1 className="text-xl font-black tracking-wider text-blue-400">FACTORYAI // ACTION ENGINE</h1>
        <p className="text-xs text-slate-400">Ebene 2 — Kontinuierlicher Verbesserungsprozess & Gedächtnis</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Linke Spalte: Ticket-Liste */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Aktive Vorfälle</h2>
          <div className="space-y-2">
            {tickets.map(ticket => (
              <div 
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg cursor-pointer border-l-4 border-red-500 transition-colors"
              >
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>{ticket.id}</span>
                  <span className="bg-blue-900 text-blue-200 px-1.5 rounded">{ticket.status}</span>
                </div>
                <div className="text-sm font-bold mt-1 text-white">{ticket.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rechte Spalte: Detailansicht & Eskalationspfad */}
        <div className="md:col-span-2 bg-slate-800 rounded-xl p-4 border border-slate-700">
          {selectedTicket ? (
            <div>
              <h2 className="text-lg font-bold text-white mb-1">{selectedTicket.title}</h2>
              <p className="text-xs text-slate-400 mb-4">Betroffene Komponente: Maschine {selectedTicket.machineId}</p>
              
              {/* Fortschrittspfad */}
              <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-lg text-xs font-bold justify-between mb-6">
                <span className="text-blue-400 border-b-2 border-blue-400 pb-1">1. Analyse</span>
                <span className="text-slate-500">2. Massnahmen</span>
                <span className="text-slate-500">3. KVP</span>
                <span className="text-slate-500">4. Lessons Learned</span>
              </div>

              {/* Task-Zuweisung Vorbereitung */}
              <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                <h3 className="text-sm font-bold text-white mb-2">Eskalation & Tasks</h3>
                {selectedTicket.tasks.map(t => (
                  <div key={t.id} className="flex justify-between text-xs bg-slate-900 p-2 rounded items-center">
                    <div>
                      <span className="font-mono text-slate-400 mr-2">[{t.owner}]</span>
                      <span>{t.title}</span>
                    </div>
                    <span className="text-amber-400">{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12">Wähle links ein Ticket aus, um die Action Engine zu starten.</div>
          )}
        </div>
      </div>
    </div>
  );
}
