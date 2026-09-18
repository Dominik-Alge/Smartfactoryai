import React, { useState, useEffect } from 'react';

export default function Modal({ isOpen, onClose, machineId, criterion, currentData, onSave }) {
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState('');

  // Falls das Modal geschlossen oder geöffnet wird, Eingaben zurücksetzen
  useEffect(() => {
    if (isOpen) {
      setNote('');
      setAuthor('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isCurrentRed = currentData?.status === 'red';

  // Zentraler Submit-Handler, der flexibel mit Events oder direkten Klicks umgeht
  const handleProcessSubmit = (e, targetStatus) => {
    if (e) e.preventDefault();
    if (!note.trim()) return;

    onSave(
      machineId, 
      criterion, 
      targetStatus, 
      note.trim(), 
      author.trim() || 'Mitarbeiter'
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-100 overflow-hidden">
        
        {/* Dynamischer Header: Rot bei Alarm-Meldung, Schiefergrau bei bestehendem Alarm */}
        <div className={`p-4 text-white flex justify-between items-center transition-colors ${
          isCurrentRed ? 'bg-gradient-to-r from-slate-700 to-slate-600' : 'bg-gradient-to-r from-red-600 to-red-500'
        }`}>
          <div>
            <h3 className="font-bold text-lg">
              {isCurrentRed ? '⚠️ Problem bearbeiten / lösen' : '🚨 Neue Störung melden'}
            </h3>
            <p className={`text-xs mt-0.5 ${isCurrentRed ? 'text-slate-200' : 'text-red-100'}`}>
              Auftrag/ID: <span className="font-bold">{machineId}</span> • Kriterium: <span className="font-bold">{criterion}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-semibold transition focus:outline-none">&times;</button>
        </div>

        {/* Inhalt & Verlaufshistorie */}
        <div className="p-5 space-y-4">
          {currentData?.notes && currentData.notes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Bisheriger Verlauf:</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1 border-b border-gray-100 pb-2">
                {[...currentData.notes].reverse().map((n, idx) => (
                  <div key={idx} className="bg-gray-50 border-l-4 border-amber-500 p-2.5 rounded-r-lg text-sm shadow-sm">
                    <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                      <span className="font-semibold text-gray-700">{n.author}</span>
                      <span>{n.timestamp}</span>
                    </div>
                    <p className="text-gray-800 leading-relaxed text-xs">{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formular */}
          <form onSubmit={(e) => handleProcessSubmit(e, isCurrentRed ? 'red' : 'red')} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Dein Name / Kürzel</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="z.B. M. Muster"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none transition focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                {isCurrentRed ? 'Neues Update oder Abschlussgrund' : 'Was passt nicht? (Notiz für Besprechung)'}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isCurrentRed ? "z.B. Techniker ist vor Ort..." : "z.B. Werkzeug verschlissen..."}
                rows="3"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none transition resize-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                required
              />
            </div>

            {/* Dynamische Button-Leiste je nach Ampel-Zustand */}
            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Abbrechen
              </button>

              {isCurrentRed ? (
                <>
                  {/* Option A: Nur eine neue Notiz hinzufügen, Status bleibt ROT */}
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-600 text-white font-medium rounded-lg text-sm hover:bg-slate-700 active:scale-95 transition shadow-sm"
                  >
                    Notiz hinzufügen
                  </button>
                  {/* Option B: Problem gelöst, Ampel geht zurück auf GRÜN */}
                  <button
                    type="button"
                    onClick={(e) => handleProcessSubmit(e, 'green')}
                    className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg text-sm hover:bg-emerald-700 active:scale-95 transition shadow-sm"
                  >
                    Problem gelöst (➔ GRÜN)
                  </button>
                </>
              ) : (
                /* Wenn Ampel grün war: Klassischer "Als ROT speichern"-Button */
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg text-sm hover:bg-red-700 active:scale-95 transition shadow-sm"
                >
                  Als ROT speichern
                </button>
              )}
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
