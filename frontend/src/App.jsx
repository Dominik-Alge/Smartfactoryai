import React, { useState, useEffect } from 'react';
import Matrix from './components/Matrix';
import Modal from './components/Modal';
import SupervisorView from './components/SupervisorView'; // <-- Direkt unter den anderen Importen platzieren


// Erzwingt das echte Tailwind-Design direkt im Browser
if (!document.getElementById('tailwind-cdn')) {
  const script = document.createElement('script');
  script.id = 'tailwind-cdn';
  script.src = 'https://tailwindcss.com';
  document.head.appendChild(script);
}

const API_URL = window.location.origin;

const reasonOptions = {
  Maschine: [
    "Maschine läuft nicht",
    "Maschine steht",
    "Störung Maschine",
    "Wartung erforderlich"
  ],

  Qualität: [
    "Qualitätsmangel / Ausschuss"
  ],

  AVOR: [
    "Arbeitsplan falsch",
    "Zeichnung fehlt",
    "Werkzeugdaten fehlen",
    "Auftrag unklar"
  ],

  DISPO: [
    "Terminproblem",
    "Priorität ändern",
    "Expressauftrag blockiert"
  ],

  Personal: [
    "Personal ungeplant / kurzfristiger Ausfall"
  ],

  Werkzeug: [
    "Werkzeug nicht vorhanden",
    "THM-Programm nicht vorhanden"
  ],

  Neuteil: [
    "Einfahren verzögert Produktivität"
  ],

  Messmittel: [
    "Messmittel nicht verfügbar"
  ],

  Programme: [
    "TopSolid-Programmierer fehlt",
    "Vericut-Programmierung ausstehend"
  ],

  ECI: [
    "Systemausfall"
  ],

  Messen: [
    "Messen nicht angemeldet",
    "Messen hat trotz anmeldung keine Kapazität"
  ],

  Vorrichtung: [
    "Vorrichtung nicht einsatzfähig",
    "Vorrichtung nicht vorhanden"
  ],

  Systemfehler: [
    "IT-Fehler",
    "Programmfehler",
    "Werkzeugfehler"
  ]
};

export default function App() {
  const [panels, setPanels] = useState([]); // Liste aller Excel-Mappen
  const [activePanelId, setActivePanelId] = useState('drehen'); // Aktive Mappe
  const [panelData, setPanelData] = useState({ name: '', machines: [], criteria: [], cells: {} });
  
  const [modalConfig, setModalConfig] = useState({ isOpen: false, machineId: '', criterion: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Liste aller verfügbaren Mappen (Panels) laden
  const fetchPanels = async () => {
    try {
      const response = await fetch(`${API_URL}/api/panels`);
      if (!response.ok) throw new Error('API-Fehler bei Mappen-Liste');
      const data = await response.json();
      setPanels(data);
      
      // Falls die aktive Panel-ID nicht in den geladenen Panels existiert, nimm das erste
      if (data.length > 0 && !data.some(p => p.id === activePanelId)) {
        setActivePanelId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setError('Verbindung zum Server fehlgeschlagen.');
    }
  };

  // 2. Daten für die aktuell aktive Mappe laden
  const fetchActivePanelData = async () => {
    if (!activePanelId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/panel/${activePanelId}`);
      if (!response.ok) throw new Error('Fehler beim Laden der Panel-Daten');
      const data = await response.json();
      setPanelData({
        name: data.name || '',
        machines: data.machines || [],
        criteria: data.criteria || [],
        cells: data.cells || {}
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Fehler beim Abrufen der Board-Daten.');
    } finally {
      setLoading(false);
    }
  };

  // Lifecycle-Trigger bei App-Start und Mappen-Wechsel
  useEffect(() => {
    fetchPanels();
  }, []);

  useEffect(() => {
    fetchActivePanelData();
  }, [activePanelId]);

  // 3. Maschine hinzufügen
  const handleAddMachine = async (machineId) => {
    try {
      const response = await fetch(`${API_URL}/api/panel/${activePanelId}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', type: 'machine', value: machineId })
      });
      if (response.ok) fetchActivePanelData();
    } catch (err) {
      console.error("Fehler beim Hinzufügen der Maschine:", err);
    }
  };

  // 4. Kriterium hinzufügen
  const handleAddCriterion = async (criterionName) => {
    try {
      const response = await fetch(`${API_URL}/api/panel/${activePanelId}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', type: 'criterion', value: criterionName })
      });
      if (response.ok) fetchActivePanelData();
    } catch (err) {
      console.error("Fehler beim Hinzufügen des Kriteriums:", err);
    }
  };

  // 5. Maschine permanent aus Backend löschen
  const handleDeleteMachine = async (machineId) => {
    if (!window.confirm(`Spalte "${machineId}" wirklich permanent aus der Datenbank löschen?`)) return;
    try {
      const response = await fetch(`${API_URL}/api/panel/${activePanelId}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', type: 'machine', value: machineId })
      });
      if (response.ok) fetchActivePanelData();
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
    }
  };

  // 6. Kriterium permanent aus Backend löschen
  const handleDeleteCriterion = async (crit) => {
    if (!window.confirm(`Kriterium "${crit}" wirklich permanent aus der Datenbank löschen?`)) return;
    try {
      const response = await fetch(`${API_URL}/api/panel/${activePanelId}/structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', type: 'criterion', value: crit })
      });
      if (response.ok) fetchActivePanelData();
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
    }
  };

  const handleCellClick = (machineId, criterion) => {
    setModalConfig({ isOpen: true, machineId, criterion });
  };

  // 7. Ampel-Status ändern und Notiz speichern
  const handleSaveStatus = async (machineId, criterion, status, note, author) => {
    try {
      const response = await fetch(`${API_URL}/api/panel/${activePanelId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId, criterion, status, note, author })
      });
      
      if (!response.ok) throw new Error('Speichern fehlgeschlagen');
      
      fetchActivePanelData(); // UI sofort neu laden
      setModalConfig({ isOpen: false, machineId: '', criterion: '' }); // Modal schließen
    } catch (err) {
      alert("Fehler beim Speichern des Status!");
      console.error(err);
    }
  };

  // Funktion zum Erstellen einer komplett neuen Mappe (Excel-Mappe)
  const handleCreateNewPanel = async () => {
    const name = prompt("Name der neuen Produktionsgruppe (z.B. Gruppe Fräsen):");
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, ""); // Macht "Gruppe Fräsen" zu "gruppefrasen"
    
    try {
      const response = await fetch(`${API_URL}/api/panel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name })
      });
      if (response.ok) {
        await fetchPanels();
        setActivePanelId(id);
      } else {
        alert("Mappe existiert bereits oder Name ist ungültig.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 md:p-8 font-sans">
      {/* Header-Leiste */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">FactoryAI — Shopfloor Panel</h1>
          <p className="text-sm font-semibold text-blue-600 mt-1">Ebene: {panelData.name || 'Wird geladen...'}</p>
        </div>
        
        {/* DYNAMISCHER VERBINDUNGS-BADGE */}
        {error ? (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Verbindung getrennt
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Live synchronisiert
          </span>
        )}
      </div>

      {/* DYNAMISCHE EXCEL-REGISTERKARTEN (Mappen-Auswahl) */}
      <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-gray-200 pb-2">
        {panels.map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePanelId(p.id)}
            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition border-t border-x -mb-[9px] ${
              activePanelId === p.id
                ? 'bg-white text-blue-600 border-gray-200 shadow-sm z-10'
                : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
            }`}
          >
            📊 {p.name}
          </button>
        ))}
        <button 
          onClick={handleCreateNewPanel}
          className="px-3 py-1.5 text-xs font-bold bg-gray-200 text-gray-700 hover:bg-slate-700 hover:text-white rounded-lg transition ml-2 shadow-sm"
        >
          + Neue Mappe
        </button>
      </div>

      {/* Roter Fehlerbalken erscheint NUR, wenn wirklich ein Fehler da ist */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-red-800 font-medium text-sm flex items-center gap-2 shadow-sm">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500 font-medium">Lade Panel-Daten...</div>
      ) : activePanelId === 'insel_ds' ? (
        /* Wenn die Vorgesetzten-Sicht aktiv ist: Zeige NUR die roten Schadenskarten */
        <SupervisorView 
          data={panelData.cells}
          onCellClick={handleCellClick}
        />
      ) : (
        /* In allen anderen Fällen (Drehen, Fräsen): Deine originale, stabile Tabelle */
        <Matrix 
          data={panelData.cells}
          machines={panelData.machines}
          criteria={panelData.criteria}
          currentPanelName={panelData.name}
          onCellClick={handleCellClick}
          onAddMachine={handleAddMachine}
          onAddCriterion={handleAddCriterion}
          onDeleteMachine={handleDeleteMachine}
          onDeleteCriterion={handleDeleteCriterion}
        />
      )}


      {/* Modal Popup für Status-Wechsel */}
      {modalConfig.isOpen && (
        <Modal
          isOpen={modalConfig.isOpen}
          machineId={modalConfig.machineId}
          criterion={modalConfig.criterion}
          allCriteria={Object.keys(reasonOptions)} 
          reasons={reasonOptions}                  
          currentData={
            panelData.cells[`${modalConfig.machineId}-${modalConfig.criterion}`]
            || { status: 'green', notes: [] }
          }
          onClose={() =>
            setModalConfig({
              isOpen: false,
              machineId: '',
              criterion: ''
            })
          }
          onSave={handleSaveStatus}
          // GELÖSCHT: categories={shopfloorCategories} wurde entfernt, da nicht definiert
        />
      )}

    </div>
  );
}
