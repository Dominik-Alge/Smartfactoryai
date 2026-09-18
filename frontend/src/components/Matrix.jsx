import React, { useState } from 'react';

export default function Matrix({ 
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

  return (
    <div style={{ fontFamily: '"Inter", "Segoe UI", sans-serif', color: '#0f172a', padding: '0 2px' }}>
      
      {/* Konfigurations-Leiste (Modern & Dezent) */}
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
          <form onSubmit={(e) => { e.preventDefault(); if(newMachine.trim()) { onAddMachine(newMachine.trim()); setNewMachine(''); } }} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newMachine}
              onChange={(e) => setNewMachine(e.target.value)}
              placeholder="Neue ID (z.B. 12771)..."
              style={{ padding: '8px 14px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', outline: 'none', backgroundColor: '#f8fafc', transition: 'all 0.2s' }}
            />
            <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}>
              + Spalte (Auftrag)
            </button>
          </form>

          <form onSubmit={(e) => { e.preventDefault(); if(newCriterion.trim()) { onAddCriterion(newCriterion.trim()); setNewCriterion(''); } }} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              placeholder="Neues Kriterium..."
              style={{ padding: '8px 14px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '10px', outline: 'none', backgroundColor: '#f8fafc', transition: 'all 0.2s' }}
            />
            <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#1e293b', color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(30,41,59,0.2)' }}>
              + Zeile (Kriterium)
            </button>
          </form>
        </div>
        <span style={{ fontSize: '12px', backgroundColor: '#fef3c7', color: '#d97706', padding: '6px 14px', borderRadius: '9999px', fontWeight: '600', marginLeft: 'auto', border: '1px solid #fde68a' }}>
          Konfigurations-Modus aktiv
        </span>
      </div>

      {/* Die eigentliche Board-Tabelle */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)' }}>
        <table style={{ borderCollapse: 'collapse', margin: '0', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {/* Haupt-Header Zelle links oben */}
              <th style={{ width: '220px', minWidth: '220px', padding: '20px 24px', textAlign: 'left', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a' }}>Statusboard</div>
                <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '700', marginTop: '2px' }}>
                  {currentPanelName ? currentPanelName.replace('Gruppe ', '') : 'Wird geladen...'}
                </div>
              </th>

              {/* Maschinen-Köpfe */}
              {machines.map((m) => (
                <th key={m} style={{ width: '90px', minWidth: '90px', padding: '16px 8px', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'relative', textAlign: 'center' }}>
                  <button 
                    onClick={() => onDeleteMachine(m)} 
                    style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '10px', color: '#ef4444', backgroundColor: '#fee2e2', border: 'none', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s' }}
                    title="Spalte entfernen"
                  >
                    ✕
                  </button>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', marginBottom: '2px' }}>{m}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>+24h</div>
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
                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#334155', tracking: '-0.2px' }}>{criterion}</span>
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
                            background: isRed 
                              ? 'radial-gradient(circle at 35% 35%, #ff8787 0%, #ef4444 40%, #b91c1c 85%, #7f1d1d 100%)' 
                              : 'radial-gradient(circle at 35% 35%, #a7f3d0 0%, #10b981 40%, #047857 85%, #064e3b 100%)',
                            boxShadow: isRed 
                              ? '0 4px 10px rgba(239, 68, 68, 0.45), inset -2px -2px 6px rgba(0,0,0,0.6), inset 2px 2px 6px rgba(255,255,255,0.4)' 
                              : '0 4px 10px rgba(16, 185, 129, 0.35), inset -2px -2px 6px rgba(0,0,0,0.6), inset 2px 2px 6px rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            position: 'relative',
                            outline: 'none',
                            padding: '0'
                          }}
                        >
                          <div style={{ position: 'absolute', top: '3px', left: '6px', width: '7px', height: '4px', backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: '50%' }}></div>
                        </button>
                      </div>
                    </td>
                  );
                })}

                <td style={{ backgroundColor: '#ffffff' }}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
