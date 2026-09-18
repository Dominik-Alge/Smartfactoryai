import React, { useState } from 'react';

export default function Matrix({ data = {}, machines = [], criteria = [], onCellClick, onAddMachine, onAddCriterion, onDeleteMachine, onDeleteCriterion }) {
  const [newMachine, setNewMachine] = useState('');
  const [newCriterion, setNewCriterion] = useState('');

  const handleAddMachine = (e) => {
    e.preventDefault();
    if (!newMachine.trim()) return;
    onAddMachine(newMachine.trim());
    setNewMachine('');
  };

  const handleAddCriterion = (e) => {
    e.preventDefault();
    if (!newCriterion.trim()) return;
    onAddCriterion(newCriterion.trim());
    setNewCriterion('');
  };

  return (
    <div className="space-y-4">
      
      {/* Admin-Leiste zum Anpassen der Tabelle */}
      <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4">
          {/* Maschine hinzufügen */}
          <form onSubmit={handleAddMachine} className="flex gap-2">
            <input
              type="text"
              value={newMachine}
              onChange={(e) => setNewMachine(e.target.value)}
              placeholder="Neue ID (z.B. 12771)..."
              className="px-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
              + Spalte (Auftrag)
            </button>
          </form>

          {/* Kriterium hinzufügen */}
          <form onSubmit={handleAddCriterion} className="flex gap-2">
            <input
              type="text"
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              placeholder="Neues Kriterium..."
              className="px-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="px-4 py-1.5 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition">
              + Zeile (Kriterium)
            </button>
          </form>
        </div>
        <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">Konfigurations-Modus aktiv</span>
      </div>

      {/* Das Shopfloor-Panel */}
      <div className="bg-white rounded-lg shadow-xl border border-gray-300 overflow-x-auto p-4">
        {/* Dynamisches Grid basierend auf der Anzahl der Maschinen + 1 für die Titelspalte */}
        <div 
          className="grid min-w-max" 
          style={{ gridTemplateColumns: `minmax(180px, 200px) repeat(${machines.length || 1}, minmax(80px, 1fr))` }}
        >
          
          {/* --- SPALTEN-KÖPFE (Maschinen-IDs & +24h) --- */}
          <div className="flex flex-col justify-end p-2 border-b-2 border-gray-300 font-bold text-gray-700 text-sm h-24 bg-white">
            <div className="leading-tight">Statusboard</div>
            <div className="text-xs text-gray-400 font-normal">Produktion</div>
          </div>

          {machines.map((m, index) => (
            <div 
              key={m} 
              className={`flex flex-col items-center justify-between pt-3 pb-2 border-b-2 border-gray-300 h-24 text-center ${
                index % 2 === 0 ? 'bg-gray-50/70' : 'bg-white'
              }`}
            >
              <div className="flex flex-col items-center w-full px-1 relative group">
                <span className="font-bold text-gray-900 text-sm tracking-tight">{m}</span>
                <button 
                  onClick={() => onDeleteMachine(m)} 
                  className="text-[10px] text-red-400 hover:text-red-600 transition mt-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100 font-normal"
                  title="Spalte entfernen"
                >
                  [Löschen]
                </button>
              </div>
              <span className="text-[11px] font-semibold text-gray-400 mt-auto">+24h</span>
            </div>
          ))}

          {/* --- ZEILEN (Die Kriterien und Ampeln) --- */}
          {criteria.map((criterion) => (
            <React.Fragment key={criterion}>
              
              {/* Linke Beschriftung des Kriteriums */}
              <div className="flex items-center justify-between p-3 font-bold text-gray-800 text-sm border-b border-gray-200 bg-white group">
                <span>{criterion}</span>
                <button 
                  onClick={() => onDeleteCriterion(criterion)} 
                  className="text-[11px] text-red-400 hover:text-red-600 transition ml-2 opacity-0 group-hover:opacity-100 font-normal"
                  title="Kriterium entfernen"
                >
                  ✕
                </button>
              </div>

              {/* Die Ampel-Zellen für dieses Kriterium quer durch alle Maschinen */}
              {machines.map((machineId, index) => {
                // Holt die Zellendaten sicher aus dem data-Objekt
                const cellData = data[`${machineId}-${criterion}`];
                const isRed = cellData?.status === 'red';

                return (
                  <div 
                    key={machineId} 
                    className={`flex items-center justify-center p-2.5 border-b border-gray-100 transition-colors ${
                      index % 2 === 0 ? 'bg-gray-50/70' : 'bg-white'
                    }`}
                  >
                    <button
                      onClick={() => onCellClick(machineId, criterion)}
                      className={`w-8 h-8 rounded-full transition-all duration-150 transform hover:scale-110 border relative cursor-pointer focus:outline-none flex items-center justify-center ${
                        isRed
                          ? 'bg-gradient-to-tr from-red-600 via-red-500 to-red-400 border-red-700 shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.4),0_2px_4px_rgba(239,68,68,0.4)] animate-pulse'
                          : 'bg-gradient-to-tr from-emerald-600 via-emerald-500 to-emerald-400 border-emerald-700 shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.4),0_2px_4px_rgba(16,185,129,0.3)]'
                      }`}
                    >
                      {/* Echter 3D-Lichtreflex-Punkt (Glossy Effekt) */}
                      <div className="absolute top-1 left-1.5 w-2.5 h-1.5 bg-white/40 rounded-full blur-[0.2px]"></div>
                    </button>
                  </div>
                );
              })}
            </React.Fragment>
          ))}

        </div>

        {/* Leeres Board-Hinweis */}
        {criteria.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400 bg-gray-50 rounded-b-lg border-t border-gray-200">
            Keine Kriterien vorhanden. Füge oben ein Kriterium hinzu, um das Board aufzubauen.
          </div>
        )}
      </div>
    </div>
  );
}
