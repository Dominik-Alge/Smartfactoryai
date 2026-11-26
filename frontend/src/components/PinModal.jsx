import React, { useState } from 'react';

export default function PinModal({ isOpen, targetName, onSuccess, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  // Hier dein gewünschtes Passwort / PIN festlegen:
  const CORRECT_PIN = '1234';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      setError(false);
      setPin('');
      onSuccess();
    } else {
      setError(true);
      setPin('');
    }
  };

  const handleCancel = () => {
    setError(false);
    setPin('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-black text-slate-900 mb-1">Bereich geschützt</h2>
        <p className="text-sm text-slate-600 mb-4">
          Bitte PIN eingeben, um <strong className="text-slate-900">{targetName}</strong> zu öffnen:
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              if (error) setError(false);
            }}
            placeholder="PIN eingeben..."
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />

          {error && (
            <p className="text-red-600 text-xs font-semibold mb-3">
              Falsche PIN. Zugriff verweigert.
            </p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow transition-colors"
            >
              Entsperren
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
