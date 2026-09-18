import React, { useState, useEffect } from 'react';
import Matrix from './components/Matrix';
import Modal from './components/Modal';

// === WICHTIG: Ersetze dies mit deiner echten Render-URL ===
const API_URL = window.location.origin;

export default function App() {
  const [backendData, setBackendData] = useState({});
  const [modalConfig, setModalConfig] = useState({ isOpen: false, machineId: '', criterion: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Daten live vom Render-Backend laden
  const fetchStatusData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`);
      if (!response.ok) throw new Error('Netzwerk-Fehler beim Laden der API');
      const data = await response.json();
      setBackendData(data);
      setError(null);
    } catch (err) {
      console.error("Fehler beim Abrufen der Daten:", err);
      setError("Verbindung zum Live-Server fehlgeschlagen. Prüfe die URL.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusData();
    // Intervall: Alle 10 Sekunden automatisch neu laden, um Änderungen anderer Linien anzuzeigen
    const interval = setInterval(fetchStatusData, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. Klick auf eine Ampel-Zelle verarbeiten
  const handleCellClick = (machineId, criterion) => {
    const key = `${machineId}-${criterion}`;
    const currentCell = backendData[key];

    if (currentCell?.status === 'red') {
      // Wenn sie schon ROT ist, öffnen wir das Modal, um den Verlauf anzusehen oder neue Notizen zu schreiben
      setModalConfig({ isOpen: true, machineId, criterion });
    } else {
      // Wenn sie GRÜN ist, öffnen wir das Modal, um den Grund für ROT einzugeben
      setModalConfig({ isOpen: true, machineId, criterion });
    }
  };

  // 3. Status-Änderung und Notiz an das Backend senden
  const handleSaveStatus = async (machineId, criterion, status, note, author) => {
    try {
      const response = await fetch(`${API_URL}/api/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId, criterion, status, note, author })
      });

      if (!response.ok) throw new Error('Speichern fehlgeschlagen');
      
      // Zustand sofort lokal aktualisieren für flüssige Bedienung
      await fetchStatusData();
      setModalConfig({ isOpen: false, machineId: '', criterion: '' });
    } catch (err) {
      alert("Fehler beim Speichern der Notiz auf dem Server.");
    }
  };

  // 4. Einen roten Status wieder auf GRÜN zurücksetzen (Für Schichtführer / Behebung)
  const handleResetToGreen = async (machineId, criterion) => {
    if (window.confirm(`Möchtest du das Problem bei Maschine ${machineId} (${criterion}) als erledigt markieren?`)) {
      await handleSaveStatus(machineId, criterion, 'green', 'Problem behoben / Status zurückgesetzt', 'System');
      setModalConfig({ isOpen: false, machineId: '', criterion: '' });
    }
  };

  const activeCellKey = `${modalConfig.machineId}-${modalConfig.criterion}`;

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Kopfzeile (Layer-System Navigation Vorbereitung) */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-xl shadow-md border border-gray-200 gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">FactoryAI — Shopfloor Management</h1>
            <p className="text-sm text-slate-500 mt-1">Ebene: <span className="font-bold text-blue-600">Produktionsübersicht (Gruppe Drehen)</span></p>
          </div>
          <div className="flex gap-2">
            <span className="bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg border shadow-sm">Halle 1</span>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span> API Online
            </span>
          </div>
        </header>

        {/* Fehleranzeige falls Server offline */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm text-red-700 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Haupt-Matrix */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-md border border-gray-200 text-slate-500 font-medium">
            Lade aktuelle Shopfloor-Daten...
          </div>
        ) : (
          <Matrix data={backendData} onCellClick={handleCellClick} />
        )}

        {/* Fußzeile für die Teambesprechung */}
        <footer className="bg-white p-4 rounded-xl shadow-md border border-gray-200 text-center text-xs text-slate-400">
          FactoryAI Pilotphase • Daten werden automatisch alle 10 Sekunden synchronisiert.
        </footer>

        {/* Notiz- und Verlaufs-Popup */}
        <Modal
          isOpen={modalConfig.isOpen}
          onClose={() => setModalConfig({ isOpen: false, machineId: '', criterion: '' })}
          machineId={modalConfig.machineId}
          criterion={modalConfig.criterion}
          currentData={backendData[activeCellKey]}
          onSave={handleSaveStatus}
        />

        {/* Zusätzlicher Admin-Button im Modal zum Grün-Schalten */}
        {modalConfig.isOpen && backendData[activeCellKey]?.status === 'red' && (
          <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
            <button
              onClick={() => handleResetToGreen(modalConfig.machineId, modalConfig.criterion)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg transition active:scale-95 border border-emerald-500"
            >
              ✓ Problem gelöst (Wieder Grün schalten)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
