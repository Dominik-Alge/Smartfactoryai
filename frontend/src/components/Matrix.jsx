import React, { useState } from 'react';

export default function ShopfloorMatrix({ 
  data = {}, 
  machines = [], 
  criteria = [], 
  currentPanelName = '', 
  onCellClick, 
  onAddMachine, 
  onAddCriterion, 
  onDeleteMachine, 
  onDeleteCriterion 
}) {
  const [newMachine, setNewMachine] = useState('');
  const [newCriterion, setNewCriterion] = useState('');
  
  // Zustand für das Ein-/Ausblenden der Historie
  const [showHistory, setShowHistory] = useState(false);
  
  // Speicher für entfernte Elemente mit ungelösten Problemen
  const [historyLog, setHistoryLog] = useState([]);

  // Logik beim Löschen einer Maschine (Spalte)
  const handleMachineDelete = (machineId) => {
    // Prüfen, ob eine Ampel in dieser Maschinenspalte rot war
    const hasUnresolvedIssues = criteria.some(crit => data[`${machineId}-${crit}`]?.status === 'red');
    
    if (hasUnresolvedIssues) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setHistoryLog(prev => [...prev, { 
        type: 'Maschine', 
        name: machineId, 
        time: timestamp, 
        note: 'Mit ungelöstem Problem entfernt' 
      }]);
    }
    onDeleteMachine(machineId);
  };

  // Logik beim Löschen einer Kategorie (Zeile)
  const handleCriterionDelete = (criterionName) => {
    // Prüfen, ob eine Ampel in dieser Kategoriezeile rot war
    const hasUnresolvedIssues = machines.some(m => data[`${m}-${criterionName}`]?.status === 'red');
    
    if (hasUnresolvedIssues) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setHistoryLog(prev => [...prev, { 
        type: 'Kategorie', 
        name: criterionName, 
        time: timestamp, 
        note: 'Mit ungelöstem Problem entfernt' 
      }]);
    }
    onDeleteCriterion(criterionName);
  };

  return (
    <div style={{ fontFamily: '"Inter", "Segoe UI", sans-serif', color: '#0f172a', padding: '0 2px' }}>
      
      {/* Konfigurations-Leiste */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '16px 24px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        marginBottom: '24px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          {/* Formular für neue Maschinen */}
          <form onSubmit={(e) => { e.preventDefault(); if(newMachine.trim()) { onAddMachine(newMachine.trim()); setNewMachine(''); } }} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newMachine}
              onChange={(e) => setNewMachine(e.target.value)}
              placeholder="Maschinen-ID (z.B. 12771)..."
              style={{ padding: '8px 14px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', outline: 'none', backgroundColor: '#f8fafc' }}
            />
            <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
              + Maschine (Spalte)
            </button>
          </form>

          {/* Formular für neue Kategorien */}
          <form onSubmit={(e) => { e.preventDefault(); if(newCriterion.trim()) { onAddCriterion(newCriterion.trim()); setNewCriterion(''); } }} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              placeholder="Kategorie (z.B. Elektrik)..."
              style={{ padding: '8px 14px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', outline: 'none', backgroundColor: '#f8fafc' }}
            />
            <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#1e293b', color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
              + Kategorie (Zeile)
            </button>
          </form>
        </div>

        {/* -24h Historie Steuerung */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: '8px 14px',
              backgroundColor: showHistory ? '#f1f5f9' : '#ffffff',
              color: showHistory ? '#0f172a' : '#64748b',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⏱️ {showHistory ? 'Historie (-24h) verbergen' : 'Historie (-24h) zeigen'} 
            {historyLog.length > 0 && (
              <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '10px', marginLeft: '4px' }}>
                {historyLog.length}
              </span>
            )}
          </button>
          
          <span style={{ fontSize: '12px', backgroundColor: '#fef3c7', color: '#d97706', padding: '6px 14px', borderRadius: '9999px', fontWeight: '600', border: '1px solid #fde68a' }}>
            Shopfloor-Modus
          </span>
        </div>
      </div>

      {/* Ausklappbarer Historien-Bereich */}
      {showHistory && (
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#475569' }}>
            Kürzlich entfernte Elemente mit ungelösten Problemen (-24h):
          </h4>
          {historyLog.length === 0 ? (
            <p style={{ margin: '0', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
              Keine ungelösten Vorfälle in den letzten 24h archiviert.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {historyLog.map((log, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#991b1b', fontWeight: '600' }}>⚠️ {log.type}: {log.name}</span>
                  <span style={{ color: '#7f1d1d', fontSize: '12px' }}>{log.note} um {log.time} Uhr</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Haupttabelle */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
        <table style={{ borderCollapse: 'collapse', margin: '0', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {/* Titel-Zelle links oben */}
              <th style={{ width: '220px', minWidth: '220px', padding: '20px 24px', textAlign: 'left', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a' }}>Statusboard</div>
                <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '700', marginTop: '2px' }}>
                  {currentPanelName ? currentPanelName : 'Gesamtübersicht'}
                </div>
              </th>

              {/* Dynamische Maschinenspalten */}
              {machines.map((m) => (
                <th key={m} style={{ width: '100px', minWidth: '100px', padding: '16px 8px', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'relative', textAlign: 'center' }}>
                  <button 
                    type="button"
                    onClick={() => handleMachineDelete(m)} 
                    style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '10px', color: '#ef4444', backgroundColor: '#fee2e2', border: 'none', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    title="Maschine entfernen"
                  >
                    ✕
                  </button>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', marginBottom: '2px' }}>{m}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Maschine</div>
                </th>
              ))}
              <th style={{ backgroundColor: '#f8fafc' }}></th>
            </tr>
          </thead>
          
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.15s' }}>
                
                {/* Linke Beschriftung des Kriteriums */}
                <td style={{ padding: '16px 24px', borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#334155' }}>{criterion}</span>
                    <button 
                      onClick={() => onDeleteCriterion(criterion)} 
                      style={{ fontSize: '10px', color: '#ef4444', backgroundColor: '#fee2e2', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '0', transition: 'all 0.15s' }}
                      title="Kriterium entfernen"
                    >
                      ✕
                    </button>
                  </div>
                </td>

                {/* Die Ampel-Zellen */}
                {machines.map((machineId) => {
                  const cellData = data[`${machineId}-${criterion}`];
                  const isRed = cellData?.status === 'red';

                  return (
                    <td key={machineId} style={{ padding: '12px 8px', borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff', verticalAlign: 'middle', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <button
                          onClick={() => onCellClick(machineId, criterion)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            border: 'none',
                            cursor: 'pointer',
                            background: isRed 
                              ? 'radial-gradient(circle at 35% 35%, #ff8787 0%, #ef4444 40%, #b91c1c 85%, #7f1d1d 100%)' 
                              : 'radial-gradient(circle at 35% 35%, #a7f3d0 0%, #10b981 40%, #047857 85%, #064e3b 100%)',
                            boxShadow: isRed 
                              ? '0 4px 10px rgba(239, 68, 68, 0.45), inset -2px -2px 6px rgba(0,0,0,0.6), inset 2px 2px 6px rgba(255,255,255,0.4)' 
                              : '0 4px 10px rgba(16, 185, 129, 0.35), inset -2px -2px 6px rgba(0,0,0,0.6), inset 2px 2px 6px rgba(255,255,255,0.4)'
                          }}
                        />
                      </div>
                    </td>
                  );
                })}
                
                {/* Rechte Ausgleichs-Zelle für das Tabellenlayout */}
                <td style={{ backgroundColor: '#ffffff' }}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
