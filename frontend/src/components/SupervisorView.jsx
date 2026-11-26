import React from 'react';

export default function SupervisorView({ data = {}, onCellClick }) {
  const activeAlarms = [];
  
  // Extrahiere alle roten Zellen aus den übergebenen Daten
  Object.keys(data).forEach((key) => {
    if (data[key]?.status === 'red') {
      const [machineId, criterion] = key.split('-');
      activeAlarms.push({
        key,
        machineId,
        criterion,
        notes: data[key].notes || []
      });
    }
  });

  return (
    <div style={{ fontFamily: '"Inter", "Segoe UI", sans-serif', color: '#0f172a', padding: '0 2px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
        🚨 Aktive Störungen — Fertigungsinsel DS (Vorgesetzten-Ansicht)
      </h2>

      {activeAlarms.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '16px', color: '#16a34a', fontWeight: '600', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          ✅ Alle Systeme im grünen Bereich! Keine aktiven Störungen in der Insel DS.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeAlarms.map((alarm) => {
            const latestNote = alarm.notes[alarm.notes.length - 1];
            return (
              <div 
                key={alarm.key} 
                onClick={() => onCellClick(alarm.machineId, alarm.criterion)}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #fca5a5',
                  borderLeft: '6px solid #ef4444',
                  padding: '20px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', backgroundColor: '#fee2e2', color: '#ef4444', padding: '6px 10px', borderRadius: '8px', marginRight: '10px' }}>
                      {alarm.criterion}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>
                      Auftrag / Maschine: {alarm.machineId}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
                    {latestNote ? latestNote.timestamp : ''}
                  </span>
                </div>

                {/* Die Schichtnotiz direkt voll ausgebreitet */}
                <div style={{ backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Aktuelle Schichtnotiz ({latestNote ? latestNote.author : 'Mitarbeiter'}):
                  </div>
                  <p style={{ margin: '0', fontSize: '14px', color: '#334155', fontStyle: 'italic', lineHeight: '1.5' }}>
                    "{latestNote ? latestNote.text : 'Keine nähere Beschreibung hinterlegt.'}"
                  </p>
                </div>
                
                {alarm.notes.length > 1 && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#2563eb', fontWeight: '700', textAlign: 'right' }}>
                    ➔ Insgesamt {alarm.notes.length} Updates (Klicken zum Bearbeiten/Lösen)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
