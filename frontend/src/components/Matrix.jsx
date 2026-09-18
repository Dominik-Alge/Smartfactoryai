import React from 'react';

const CRITERIA = ["Maschine", "AVOR", "DISPO", "NCP", "Vorrichtung", "Werkzeug", "Qualität", "Messen", "Material"];
const MACHINES = ["12771", "12772", "12773", "12774", "12766", "12768", "12769", "12770", "12775", "12715", "12703", "12711"];

export default function Matrix({ data, onCellClick }) {
  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
      {/* Header mit Titel */}
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Statusboard Drehen</h2>
          <p className="text-xs text-gray-500">Live-Produktionsübersicht (Klicken zum Ändern)</p>
        </div>
        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">+24h Ansicht</span>
      </div>

      {/* Die Tabelle */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-gray-100/70 border-b border-gray-200">
              <th className="p-4 font-bold text-gray-700 text-sm w-48">Kriterium</th>
              {MACHINES.map((m) => (
                <th key={m} className="p-3 text-center text-xs font-bold text-gray-600 border-l border-gray-200/60 bg-gray-50/50">
                  <div className="tracking-wider rotate-[-45deg] sm:rotate-0 my-2">{m}</div>
                  <div className="text-[10px] text-gray-400 font-normal mt-1">+24h</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {CRITERIA.map((criterion) => (
              <tr key={criterion} className="hover:bg-gray-50/80 transition-colors">
                <td className="p-4 font-semibold text-gray-800 text-sm shadow-sm bg-white sticky left-0 z-10">{criterion}</td>
                {MACHINES.map((machineId) => {
                  const cellData = data[`${machineId}-${criterion}`];
                  const isRed = cellData?.status === 'red';

                  return (
                    <td key={machineId} className="p-3 text-center border-l border-gray-100">
                      <button
                        onClick={() => onCellClick(machineId, criterion)}
                        title={isRed ? `Problem: ${cellData.notes[cellData.notes.length - 1]?.text}` : 'Alles in Ordnung'}
                        className={`w-7 h-7 rounded-full transition-all duration-300 transform hover:scale-115 border flex items-center justify-center relative ${
                          isRed
                            ? 'bg-gradient-to-br from-red-500 to-red-600 border-red-700 shadow-md shadow-red-200 animate-pulse'
                            : 'bg-gradient-to-br from-emerald-400 to-emerald-500 border-emerald-600 shadow-sm shadow-emerald-100'
                        }`}
                      >
                        {/* Kleiner 3D-Effekt wie auf dem physischen Board */}
                        <div className="absolute top-0.5 left-1 w-2 h-1.5 bg-white/30 rounded-full blur-[0.5px]"></div>
                        
                        {/* Indikator falls Notizen vorhanden sind */}
                        {isRed && cellData?.notes?.length > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
