import React, { useState, useEffect } from 'react';
import Matrix from './components/Matrix';
import Modal from './components/Modal';

// Erzwingt das echte Tailwind-Design direkt im Browser
if (!document.getElementById('tailwind-cdn')) {
  const script = document.createElement('script');
  script.id = 'tailwind-cdn';
  script.src = 'https://cdn.tailwindcss.com'; // <-- Das 'cdn.' vor tailwindcss ist der Schlüssel!
  document.head.appendChild(script);
}

const API_URL = window.location.origin;

export default function App() {
  const [backendData, setBackendData] = useState({});
  const [modalConfig, setModalConfig] = useState({ isOpen: false, machineId: '', criterion: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dynamische Listen (mit deinen Vorschlägen als Startwerte)
  const [machines, setMachines] = useState(["12771", "12772", "12773", "12774", "12766"]);
  const [criteria, setCriteria] = useState(["Maschine", "AVOR", "DISPO", "NCP", "Qualität", "Material"]);

  const fetchStatusData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`);
      if (!response.ok) throw new Error('API-Fehler');
      const data = await response.json();
      setBackendData(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Verbindung zum Live-Server fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusData();
    const interval = setInterval(fetchStatusData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Funktionen zur dynamischen Anpassung der Matrix
  const handleAddMachine = (newId) => {
    if (!machines.includes(newId)) setMachines([...machines, newId]);
  };

  const handleAddCriterion = (newCrit) => {
    if (!criteria.includes(newCrit)) setCriteria([...criteria, newCrit]);
  };

  const handleDeleteMachine = (id) => {
    if (window.confirm(`Maschine ${id} wirklich aus der Ansicht entfernen?`)) {
      setMachines(machines.filter(m => m !== id));
    }
  };

  const handleDeleteCriterion = (crit) => {
    if (window.confirm(`Kriterium "${crit}" wirklich entfernen?`)) {
      setCriteria(criteria.filter(c => c !== crit));
    }
  };

  const handleCellClick = (machineId, criterion) => {
    setModalConfig({ isOpen: true, machineId, criterion });
  };

  const handleSaveStatus = async (machineId, criterion, status, note, author) => {
    try {
      await fetch(`${API_URL}/api/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId, criterion, status, note, author })
      });
      await fetchStatusData();
      setModalConfig({ isOpen: false, machineId: '', criterion: '' });
    } catch (err) {
      alert("Fehler beim Speichern.");
    }
  };

  const handleResetToGreen = async (machineId, criterion) => {
    if (window.confirm(`Problem bei Maschine ${machineId} als erledigt markieren?`)) {
      await handleSaveStatus(machineId, criterion, 'green', 'Problem behoben / Status zurückgesetzt', 'System');
    }
  };

  const activeCellKey = `${modalConfig.machineId}-${modalConfig.criterion}`;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 font-sans antialiased text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-xl shadow-md border border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">FactoryAI — Shopfloor Panel</h1>
            <p className="text-sm text-slate-500 mt-1">Ebene: <span className="font-bold text-blue-600">Produktionsübersicht (Gruppe Drehen)</span></p>
          </div>
          <div className="flex gap-2">
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span> Live synchronisiert
            </span>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm text-red-700 text-sm font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Haupt-Matrix */}
        {loading ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-md border text-slate-500">
            Lade Konfiguration...
          </div>
        ) : (
          <Matrix 
            data={backendData} 
            machines={machines}
            criteria={criteria}
            onCellClick={handleCellClick}
            onAddMachine={handleAddMachine}
            onAddCriterion={handleAddCriterion}
            onDeleteMachine={handleDeleteMachine}
            onDeleteCriterion={handleDeleteCriterion}
          />
        )}

        <footer className="bg-white p-4 rounded-xl shadow-md border border-slate-200 text-center text-xs text-slate-400">
          FactoryAI Pilotphase • Jede Änderung an Struktur oder Status ist sofort für alle Stationen sichtbar.
        </footer>

        {/* Popup */}
        <Modal
          isOpen={modalConfig.isOpen}
          onClose={() => setModalConfig({ isOpen: false, machineId: '', criterion: '' })}
          machineId={modalConfig.machineId}
          criterion={modalConfig.criterion}
          currentData={backendData[activeCellKey]}
          onSave={handleSaveStatus}
        />

        {modalConfig.isOpen && backendData[activeCellKey]?.status === 'red' && (
          <div className="fixed bottom-12 left-1/2 transform -translate-x-1/2 z-50">
            <button
              onClick={() => handleResetToGreen(modalConfig.machineId, modalConfig.criterion)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xl transition active:scale-95 border border-emerald-500"
            >
              ✓ Problem gelöst (Wieder Grün schalten)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
