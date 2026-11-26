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
  onDeleteCriterion,
  onMoveMachine,
  onMoveCriterion
}) {
  const [newMachine, setNewMachine] = useState('');
  const [newCriterion, setNewCriterion] = useState('');

  const arrowBtnStyle = {
    fontSize: '11px',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0
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
          {/* Formular für neue Maschinen (Spalten) */}
          <form onSubmit={(e) => { e.preventDefault(); if (newMachine.trim()) { onAddMachine(newMachine.trim()); setNewMachine(''); } }} style={{ display: 'flex', gap: '8px' }}>
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

          {/* Formular für neue Kategorien (Zeilen) */}
          <form onSubmit={(e) => { e.preventDefault(); if (newCriterion.trim()) { onAddCriterion(newCriterion.trim()); setNewCriterion(''); } }} style={{ display: 'flex', gap: '8px' }}>
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

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', backgroundColor: '#fef3c7', color: '#d97706', padding: '6px 14px', borderRadius: '9999px', fontWeight: '600', border: '1px solid #fde68a' }}>
            Shopfloor-Modus
          </span>
        </div>
      </div>

      {/* Haupttabelle */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
        <table style={{ borderCollapse: 'collapse', margin: '0', width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ width: '250px', minWidth: '250px', padding: '20px 24px', textAlign: 'left', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.5px', color: '#0f172a' }}>Statusboard</div>
                <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '700', marginTop: '2px' }}>
                  {currentPanelName ? currentPanelName.replace('Gruppe ', '') : 'Gesamtübersicht'}
                </div>
              </th>

              {/* Dynamische Maschinenspalten mit Verschiebe-Pfeilen und Lösch-Button */}
              {machines.map((m, idx) => (
                <th key={m} style={{ width: '120px', minWidth: '120px', padding: '12px 8px', borderRight: '1px solid #e2e8f0', verticalAlign: 'middle', position: 'relative', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      {idx > 0 && (
                        <button type="button" onClick={() => onMoveMachine(m, 'left')} style={arrowBtnStyle} title="Nach links verschieben">
                          ←
                        </button>
                      )}
                      {idx < machines.length - 1 && (
                        <button type="button" onClick={() => onMoveMachine(m, 'right')} style={arrowBtnStyle} title="Nach rechts verschieben">
                          →
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteMachine(m)}
                      style={{ fontSize: '10px', color: '#ef4444', backgroundColor: '#fee2e2', border: 'none', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      title="Maschine endgültig löschen"
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', marginBottom: '2px' }}>{m}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Maschine</div>
                </th>
              ))}
              <th style={{ backgroundColor: '#f8fafc' }}></th>
            </tr>
          </thead>

          <tbody>
            {criteria.map((criterion, idx) => (
              <tr key={criterion} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.15s' }}>
                {/* Linke Beschriftung der Kategorie (Zeile) mit Pfeilen & Lösch-Button */}
                <td style={{ padding: '14px 16px', borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#334155', wordBreak: 'break-word' }}>{criterion}</span>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {idx > 0 && (
                        <button type="button" onClick={() => onMoveCriterion(criterion, 'up')} style={arrowBtnStyle} title="Nach oben verschieben">
                          ↑
                        </button>
                      )}
                      {idx < criteria.length - 1 && (
                        <button type="button" onClick={() => onMoveCriterion(criterion, 'down')} style={arrowBtnStyle} title="Nach unten verschieben">
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeleteCriterion(criterion)}
                        style={{ fontSize: '10px', color: '#ef4444', backgroundColor: '#fee2e2', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '0', marginLeft: '4px' }}
                        title="Kategorie endgültig löschen"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </td>

                {/* Die Ampel-Zellen */}
                {machines.map((machineId) => {
                  const key = `${machineId}-${criterion}`;
                  const cellData = data?.[key] || data?.cells?.[key];
                  const isRed = cellData?.status === 'red';

                  return (
                    <td key={machineId} style={{ padding: '12px 8px', borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff', verticalAlign: 'middle', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
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
                <td style={{ backgroundColor: '#ffffff' }}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}



