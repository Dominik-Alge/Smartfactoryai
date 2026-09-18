import React, { useState } from 'react';

export default function Matrix({ data, machines, criteria, onCellClick, onAddMachine, onAddCriterion, onDeleteMachine, onDeleteCriterion }) {
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
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      
      {/* Admin-Leiste zum Anpassen der Tabelle */}
      <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4">
          {/* Maschine hinzufügen */}
          <form onSubmit={handleAddMachine} className="flex gap-2">
            <input
              type="text"
              value={newMachine}
              onChange={(e) => setNewMachine(e.target.value)}
              placeholder="Neue Maschinen-ID..."
              className="px-3 py-1 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
              + Maschine
            </button>
          </form>

          {/* Kriterium hinzufügen */}
          <form onSubmit={handleAddCriterion} className="flex gap-2">
            <input
              type="text"
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              placeholder="Neues Kriterium (z.B. Logistik)..."
              className="px-3 py-1 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="px-3 py-1 bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition">
              + Kriterium
            </button>
          </form>
        </div>
        <span className="text-xs text-slate-400 font-medium">Konfigurations-Modus aktiv</span>
      </div>

      {/* Die dynamische Tabelle */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 border-b border-gray-200">
              <th className="p-4 font-bold text-gray-700 text-sm min-w-[200px]">Kriterium</th>
              {machines.map((m) => (
                <th key={m} className="p-3 text-center text-xs font-bold text-gray-600 border-l border-gray-200/60 bg-gray-50/50 min-w-[80px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="tracking-wider">{m}</span>
                    <button 
                      onClick={() => onDeleteMachine(m)} 
                      className="text-[10px] text-red-400 hover:text-red-600 transition font-normal"
                      title="Maschine entfernen"
                    >
                      [Löschen]
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {criteria.map((criterion) => (
              <tr key={criterion} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 font-semibold text-gray-800 text-sm flex justify-between items-center bg-white sticky left-0 z-10 shadow-sm">
                  <span>{criterion}</span>
                  <button 
                    onClick={() => onDeleteCriterion(criterion)} 
                    className="text-[10px] text-red-300 hover:text-red-500 transition font-normal ml-2"
                    title="Kriterium entfernen"
                  >
                    ✕
                  </button>
                </td>
                {machines.map((machineId) => {
                  const cellData = data[`${machineId}-${criterion}`];
                  const isRed = cellData?.status === 'red';

                  return (
                    <td key={machineId} className="p-3 text-center border-l border-gray-100">
                      <button
                        onClick={() => onCellClick(machineId, criterion)}
                        className={`w-8 h-8 rounded-full transition-all duration-200 transform hover:scale-110 border flex items-center justify-center relative cursor-pointer ${
                          isRed
                            ? 'bg-red-500 border-red-600 shadow-md shadow-red-200 animate-pulse'
                            : 'bg-emerald-500 border-emerald-600 shadow-sm shadow-emerald-100'
                        }`}
                      >
                        <div className="absolute top-0.5 left-1 w-2 h-1.5 bg-white/20 rounded-full blur-[0.5px]"></div>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {criteria.length === 0 && (
              <tr>
                <td colSpan={machines.length + 1} className="p-8 text-center text-sm text-gray-400">
                  Keine Kriterien vorhanden. Füge oben ein Kriterium hinzu, um die Matrix zu starten.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

