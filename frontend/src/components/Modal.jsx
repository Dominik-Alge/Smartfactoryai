import React, { useState } from 'react';

export default function Modal({ isOpen, onClose, machineId, criterion, currentData, onSave }) {
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    onSave(machineId, criterion, 'red', note, author || 'Vorarbeiter');
    setNote('');
    setAuthor('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 p-4 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">Problem melden</h3>
            <p className="text-xs text-red-100">Maschine: {machineId} • Kriterium: {criterion}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-semibold transition">&times;</button>
        </div>

        {/* Inhalt / Historie */}
        <div className="p-5 space-y-4">
          {currentData?.notes && currentData.notes.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Bisheriger Verlauf:</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {currentData.notes.map((n, idx) => (
                  <div key={idx} className="bg-gray-50 border-l-4 border-red-500 p-2.5 rounded-r-lg text-sm shadow-sm">
                    <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
                      <span className="font-semibold text-gray-700">{n.author}</span>
                      <span>{n.timestamp}</span>
                    </div>
                    <p className="text-gray-800 leading-relaxed">{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formular für neue Notiz */}
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Dein Name / Kürzel</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="z.B. M. Muster"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Was passt nicht? (Notiz für Besprechung)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z.B. Werkzeug verschlissen, AVOR informiert..."
                rows="3"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition resize-none"
                required
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg text-sm hover:bg-red-700 active:scale-95 transition shadow-md shadow-red-200"
              >
                Als ROT speichern
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
