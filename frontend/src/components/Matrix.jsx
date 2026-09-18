import React, { useState } from 'react';

export default function Matrix({ data = {}, machines = [], criteria = [], onCellClick, onAddMachine, onAddCriterion, onDeleteMachine, onDeleteCriterion }) {
  const [newMachine, setNewMachine] = useState('');
  const [newCriterion, setNewCriterion] = useState('');

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b', padding: '4px' }}>
      
      {/* Konfigurations-Leiste oben */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'between',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <form onSubmit={(e) => { e.preventDefault(); if(newMachine.trim()) { onAddMachine(newMachine.trim()); setNewMachine(''); } }} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newMachine}
              onChange={(e) => setNewMachine(e.target.value)}
              placeholder="Neue ID (z.B. 12771)..."
              style={{ padding: '6px 12px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none' }}
            />
            <button type="submit" style={{ padding: '6px 14px', backgroundColor: '#2563eb', color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              + Spalte (Auftrag)
            </button>
          </form>

          <form onSubmit={(e) => { e.preventDefault(); if(newCriterion.trim()) { onAddCriterion(newCriterion.trim()); setNewCriterion(''); } }} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              placeholder="Neues Kriterium..."
              style={{ padding: '6px 12px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none' }}
            />
            <button type="submit" style={{ padding: '6px 14px', backgroundColor: '#334155', color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              + Zeile (Kriterium)
            </button>
          </form>
        </div>
        <span style={{ fontSize: '12px', backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '9999px', fontWeight: '500', marginLeft: 'auto' }}>
          Konfigurations-Modus aktiv
        </span>
      </div>

      {/* Kompakter Tabellen-Container */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflowX: 'auto', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
        <table style={{ borderCollapse: 'collapse', textAlgin: 'center', margin: '0', width: 'auto' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
              {/* Haupt-Header Zelle */}
              <th style={{ minWidth: '160px', width: '180px', padding: '12px', textAlign: 'left', borderRight: '1px solid #cbd5e1', verticalAlign: 'middle' }}>
                <div style={{ fontSize: '14px', fontWeight: '900', letterSpacing: '-0.5px' }}>Statusboard</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>Drehen</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', marginTop: '2px' }}>+24h</div>
              </th>

              {/* Maschinen-Köpfe */}
              {machines.map((m) => (
                <th key={m} style={{ width: '65px', minWidth: '65px', padding: '8px 4px', borderRight: '1px solid #cbd5e1', verticalAlign: 'bottom', position: 'relative' }}>
                  <button 
                    onClick={() => onDeleteMachine(m)} 
                    style={{ position: 'absolute', top: '4px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: '#ef4444', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', padding: '0 4px', borderRadius: '4px', cursor: 'pointer' }}
                    title="Spalte entfernen"
                  >
                    ✕
                  </button>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px', marginTop: '16px' }}>{m}</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', paddingBottom: '2px' }}>+24h</div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion} style={{ height: '40px', borderBottom: '1px solid #e2e8f0' }}>
                {/* Kriterium Name links */}
                <td style={{ padding: '8px 12px', fontWeight: '700', fontSize: '13px', color: '#1e293b', textAlign: 'left', backgroundColor: '#ffffff', borderRight: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', gap: '8px' }}>
                    <span style={{ flexGrow: '1' }}>{criterion}</span>
                    <button 
                      onClick={() => onDeleteCriterion(criterion)} 
                      style={{ fontSize: '10px', color: '#fff', backgroundColor: '#f87171', border: 'none', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyCwontent: 'center', cursor: 'pointer', padding: '0', lineHeight: '0' }}
                      title="Kriterium entfernen"
                    >
                      ✕
                    </button>
                  </div>
                </td>

                {/* Ampel-Zellen */}
                {machines.map((machineId) => {
                  const cellData = data[`${machineId}-${criterion}`];
                  const isRed = cellData?.status === 'red';

                  return (
                    <td key={machineId} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', backgroundColor: '#fdfdfd', verticalAlign: 'middle', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <button
                          onClick={() => onCellClick(machineId, criterion)}
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            border: isRed ? '1px solid #991b1b' : '1px solid #065f46',
                            background: isRed 
                              ? 'linear-gradient(135deg, #f87171 0%, #dc2626 50%, #991b1b 100%)' 
                              : 'linear-gradient(135deg, #34d399 0%, #059669 50%, #065f46 100%)',
                            boxShadow: isRed 
                              ? 'inset -2px -2px 4px rgba(0,0,0,0.4), 0 2px 4px rgba(220,38,38,0.3)' 
                              : 'inset -2px -2px 4px rgba(0,0,0,0.4), 0 2px 4px rgba(5,150,105,0.2)',
                            cursor: 'pointer',
                            position: 'relative',
                            outline: 'none',
                            padding: '0'
                          }}
                        >
                          {/* 3D Glanzpunkt */}
                          <div style={{ position: 'absolute', top: '3px', left: '5px', width: '6px', height: '3px', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '50%' }}></div>
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
