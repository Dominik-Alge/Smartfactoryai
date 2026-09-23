import React, { useState, useEffect } from 'react';

export default function Modal({
  isOpen,
  onClose,
  machineId,
  criterion,         // Z.B. "AVOR" (Vorauswahl aus der Matrix)
  allCriteria = [],  // Object.keys(reasonOptions) -> ["Maschine", "AVOR", ...]
  reasons = {},      // Die gesamte reasonOptions-Struktur
  currentData,
  onSave
}) {
  const [author, setAuthor] = useState('');
  const [note, setNote] = useState('');
  
  // Neue States für die Dropdowns
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedReason, setSelectedReason] = useState('');

  // Sobald das Modal geöffnet wird oder das Kriterium sich ändert,
  // setzen wir die Standardwerte
  useEffect(() => {
    if (isOpen) {
      // Setze die Kategorie auf das geklickte Kriterium (z.B. "AVOR")
      setSelectedCategory(criterion || '');
      setSelectedReason(''); // Zuerst leer, damit der User wählen muss
      
      // Bestehende Daten laden (falls vorhanden)
      setAuthor(currentData?.author || '');
      setNote(currentData?.note || '');
    }
  }, [isOpen, criterion, currentData]);

  // Wenn der User die Hauptkategorie im Modal manuell ändert,
  // setzen wir den ausgewählten Untergrund zurück
  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setSelectedReason('');
  };

  const handleSave = () => {
    // Hier übergeben wir die strukturierten Daten an deine App.jsx
    onSave({
      author,
      category: selectedCategory,
      reason: selectedReason,
      note: note, // Das optionale Notizfeld bleibt für Details bestehen
      timestamp: new Date().toISOString()
    });
    onClose();
  };

  if (!isOpen) return null;

  // Hol dir die passenden Untergründe basierend auf der ausgewählten Kategorie
  const availableReasons = reasons[selectedCategory] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-100 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">
            Statusmeldung erheben ({machineId})
          </h3>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* Autor / Mitarbeiter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter / Kürzel</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="z.B. MÜA"
            />
          </div>

          {/* Dropdown 1: Hauptkategorie (Vorausgewählt durch Klick) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bereich / Kriterium</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">-- Bitte wählen --</option>
              {allCriteria.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Dropdown 2: Dynamische Begründung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Spezifischer Grund</label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              disabled={!selectedCategory || availableReasons.length === 0}
            >
              <option value="">-- Grund auswählen --</option>
              {availableReasons.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>

          {/* Optionales Notizfeld (für Details wie Ticketnummern etc.) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zusätzliche Notiz (optional)</label>
            <textarea
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Details zum Stillstand..."
            />
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedCategory || !selectedReason} // Speichern sperren, bis Grund gewählt ist
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Speichern
          </button>
        </div>

      </div>
    </div>
  );
}
