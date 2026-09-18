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

  // Berechne die Spaltenanzahl für CSS Grid (1 Titelspalte + Anzahl Maschinen)
  const totalColumns = 1 + (machines.length || 1);

  return (
    <div className="space-y-4 font-sans select-none">
      
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

      {/* Das Shopfloor-Panel im echten Tabellen-Grid */}
      <div className="bg-white rounded-lg shadow-xl border border-gray-300 overflow-x-auto">
        <div 
          className="grid min-w-max text-center divide-x divide-y divide-gray-200" 
          style={{ 
            gridTemplateColumns: `minmax(180px, 200px) repeat(${machines.length || 1}, 65px)`,
          }}
        >
          
          {/* --- TOP LEFT HEADER CELL --- */}
          <div className="flex flex-col items-center justify-center p-2 font-bold text-gray-800 text-sm bg-gray-50 h-28 border-t border-l border-gray-200">
            <div className="text-sm font-black tracking-tight leading-tight">Statusboard</div>
            <div className="text-xs text-gray-500 font-bold">Drehen</div>
            <div className="text-xs text-gray-400 font-medium mt-1">+24h</div>
          </div>

          {/* --- SPALTEN-KÖPFE (Maschinen-IDs) --- */}
          {machines.map((m) => (
            <div 
              key={m} 
              className="flex flex-col items-center justify-between pt-2 pb-2 h-28 bg-gray-50 group border-t border-gray-200 relative"
            >
              {/* Absolut positionierter Löschen-Button, der das Layout nicht zerstört */}
              <button 
                onClick={() => onDeleteMachine(m)} 
                className="absolute top-1 text-[9px] text-red-500 hover:text-red-700 bg-red-50 px-1 rounded opacity-0 group-hover:opacity-100 transition z-10"
                title="Spalte entfernen"
              >
                ✕
              </button>
              
              <span className="font-bold text-gray-900 text-sm tracking-tight writing-mode-vertical transform rotate-0 mt-4">
                {m}
              </span>
              
              <span className="text-[10px] font-bold text-gray-400 mt-auto">+24h</span>
            </div>
          ))}

          {/* --- ZEILEN (Die Kriterien und Ampeln) --- */}
          {criteria.map((criterion) => (
            <React.Fragment key={criterion}>
              
              {/* Linke Beschriftung des Kriteriums */}
              <div className="flex items-center justify-between px-4 py-2 font-bold text-gray-900 text-sm bg-white text-left group h-12 border-l border-gray-200">
                <span className="truncate">{criterion}</span>
                <button 
                  onClick={() => onDeleteCriterion(criterion)} 
                  className="text-[10px] text-white bg-red-400 hover:bg-red-600 rounded-full w-4 h-4 flex items-center justify-center transition opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                  title="Kriterium entfernen"
                >
                  ✕
                </button>
              </div>

              {/* Die Ampel-Zellen für dieses Kriterium */}
              {machines.map((machineId) => {
                const cellData = data[`${machineId}-${criterion}`];
                const isRed = cellData?.status === 'red';

                return (
                  <div 
                    key={machineId} 
                    className="flex items-center justify-center bg-gray-50/30 h-12"
                  >
                    <button
                      onClick={() => onCellClick(machineId, criterion)}
                      className={`w-5 h-5 rounded-full transition-all duration-100 transform hover:scale-110 border relative cursor-pointer focus:outline-none flex items-center justify-center ${
                        isRed
                          ? 'bg-gradient-to-tr from-red-600 via-red-500 to-red-400 border-red-700 shadow-[inset_-1px_-1px_3px_rgba(0,0,0,0.4),0_1px_3px_rgba(239,68,68,0.4)]'
                          : 'bg-gradient-to-tr from-emerald-600 via-emerald-500 to-emerald-400 border-emerald-700 shadow-[inset_-1px_-1px_3px_rgba(0,0,0,0.4),0_1px_3px_rgba(16,185,129,0.3)]'
                      }`}
                    >
                      {/* 3D-Glossy Lichtreflex-Punkt */}
                      <div className="absolute top-0.5 left-1 w-1.5 h-1 bg-white/50 rounded-full blur-[0.1px]"></div>
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
