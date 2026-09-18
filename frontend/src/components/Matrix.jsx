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
    <div className="space-y-4 font-sans select-none" style={{ fontFamily: 'sans-serif' }}>
      
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

      {/* Das Shopfloor-Panel als klassische HTML-Tabelle */}
      <div className="bg-white rounded-lg shadow-xl border border-gray-300 overflow-x-auto">
        <table className="w-full border-collapse" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-300">
              {/* Top-Left Header-Zelle */}
              <th 
                className="p-3 text-left font-bold text-gray-800 border-r border-gray-200" 
                style={{ minWidth: '180px', width: '200px', verticalAlign: 'middle', borderRight: '1px solid #e5e7eb' }}
              >
                <div className="text-sm font-black tracking-tight leading-tight">Statusboard</div>
                <div className="text-xs text-gray-500 font-bold">Drehen</div>
                <div className="text-xs text-gray-400 font-medium mt-1">+24h</div>
              </th>

              {/* Spalten-Köpfe (Maschinen-IDs) */}
              {machines.map((m) => (
                <th 
                  key={m} 
                  className="p-2 font-bold text-gray-900 text-sm tracking-tight border-r border-gray-200 relative group"
                  style={{ width: '65px', minWidth: '65px', verticalAlign: 'bottom', height: '90px', borderRight: '1px solid #e5e7eb' }}
                >
                  {/* Löschen Button schwebend */}
                  <div className="absolute top-1 left-0 right-0 flex justify-center">
                    <button 
                      onClick={() => onDeleteMachine(m)} 
                      className="text-[9px] text-red-500 hover:text-red-700 bg-red-50 px-1 rounded opacity-0 group-hover:opacity-100 transition"
                      title="Spalte entfernen"
                      style={{ border: '1px solid #fca5a5' }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="mb-2">{m}</div>
                  <div className="text-[10px] font-bold text-gray-400 pb-1">+24h</div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-200">
            {criteria.map((criterion) => (
              <tr key={criterion} className="hover:bg-gray-50/50 border-b border-gray-200" style={{ height: '48px' }}>
                
                {/* Linke Beschriftung des Kriteriums */}
                <td 
                  className="px-4 py-2 font-bold text-gray-900 text-sm text-left bg-white border-r border-gray-200 group"
                  style={{ borderRight: '1px solid #e5e7eb' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{criterion}</span>
                    <button 
                      onClick={() => onDeleteCriterion(criterion)} 
                      className="text-[10px] text-white bg-red-400 hover:bg-red-600 rounded-full w-4 h-4 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
                      title="Kriterium entfernen"
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </td>

                {/* Die Ampel-Zellen quer durch */}
                {machines.map((machineId) => {
                  const cellData = data[`${machineId}-${criterion}`];
                  const isRed = cellData?.status === 'red';

                  return (
                    <td 
                      key={machineId} 
                      className="p-1 border-r border-gray-200"
                      style={{ borderRight: '1px solid #e5e7eb', verticalAlign: 'middle' }}
                    >
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => onCellClick(machineId, criterion)}
                          className={`w-5 h-5 rounded-full transition-all duration-100 transform hover:scale-110 border relative cursor-pointer focus:outline-none flex items-center justify-center ${
                            isRed
                              ? 'bg-gradient-to-tr from-red-600 via-red-500 to-red-400 border-red-700 shadow-[inset_-1px_-1px_3px_rgba(0,0,0,0.4),0_1px_3px_rgba(239,68,68,0.4)]'
                              : 'bg-gradient-to-tr from-emerald-600 via-emerald-500 to-emerald-400 border-emerald-700 shadow-[inset_-1px_-1px_3px_rgba(0,0,0,0.4),0_1px_3px_rgba(16,185,129,0.3)]'
                          }`}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: isRed ? '1px solid #b91c1c' : '1px solid #047857',
                            background: isRed 
                              ? 'linear-gradient(to top right, #dc2626, #f87171)' 
                              : 'linear-gradient(to top right, #059669, #34d399)',
                            cursor: 'pointer',
                            position: 'relative'
                          }}
                        >
                          {/* 3D-Glossy Lichtreflex-Punkt */}
                          <div 
                            className="absolute bg-white/50 rounded-full" 
                            style={{ 
                              top: '2px', 
                              left: '4px', 
                              width: '6px', 
                              height: '4px', 
                              backgroundColor: 'rgba(255,255,255,0.5)',
                              borderRadius: '50%'
                            }}
                          ></div>
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

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
