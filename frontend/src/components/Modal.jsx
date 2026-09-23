import React, { useState, useEffect } from 'react';

export default function Modal({
  isOpen,
  onClose,
  machineId,
  criterion,         // Das aktuell vorausgewählte Kriterium (z.B. "AVOR")
  allCriteria = [],    // Erhält von App.jsx: Object.keys(reasonOptions)
  reasons = {},        // Erhält von App.jsx: deine 'reasonOptions' Struktur
  currentData,
  onSave
}) {
  const [author, setAuthor] = useState('');
  const [note, setNote] = useState('');
  
  // States für die dynamische Auswahl im Formular
  const [selectedCriterion, setSelectedCriterion] = useState(criterion || '');
  const [selectedReason, setSelectedReason] = useState('');

  // Setzt die Formularfelder zurück, wenn das Modal geöffnet wird
  useEffect(() => {
    if (isOpen) {
      setNote('');
      setAuthor('');
      setSelectedCriterion(criterion || '');
      setSelectedReason('');
    }
  }, [isOpen, criterion]);

  // Sobald der Benutzer das Kriterium wechselt, setzen wir den ausgewählten Grund zurück
  useEffect(() => {
    setSelectedReason('');
  }, [selectedCriterion]);

  if (!isOpen) return null;

  const isCurrentRed = currentData?.status === 'red';

  // Holt die passenden Untergründe basierend auf dem gewählten Kriterium
  const availableReasons = reasons[selectedCriterion] || [];

  const handleProcessSubmit = (e, targetStatus) => {
    if (e) e.preventDefault();
    if (!note.trim()) return;
    
    // Kombiniert den ausgewählten Grund und den Freitext für die finale Notiz
    const combinedNote = selectedReason 
      ? `[${selectedReason}] ${note.trim()}`
      : note.trim();

    onSave(machineId, selectedCriterion, targetStatus, combinedNote, author.trim() || 'Mitarbeiter');
  };

  return (
    <div style={{
      position: 'fixed', inset: '0', backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000,
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '400px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', overflow: 'hidden', border: '1px solid #e2e8f0'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: isCurrentRed ? 'linear-gradient(to right, #475569, #334155)' : 'linear-gradient(to right, #dc2626, #b91c1c)'
        }}>
          <div>
            <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700' }}>
              {isCurrentRed ? '⚠️ Problem bearbeiten / lösen' : '🚨 Neue Störung melden'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              Auftrag: <strong>{machineId}</strong> • Kriterium: <strong>{selectedCriterion}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}>&times;</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px' }}>
          
          {/* Verlaufshistorie */}
          {currentData?.notes && currentData.notes.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', tracking: '1px' }}>Bisheriger Verlauf:</h4>
              <div style={{ maxHeight: '120px', overflowY: 'auto', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                {[...currentData.notes].reverse().map((n, idx) => (
                  <div key={idx} style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #f59e0b', padding: '8px', borderRadius: '0 6px 6px 0', marginBottom: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10px', marginBottom: '4px' }}>
                      <strong>{n.author}</strong><span>{n.timestamp}</span>
                    </div>
                    <p style={{ margin: '0', color: '#334155', lineHeight: '1.4' }}>{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formular */}
          <form onSubmit={(e) => handleProcessSubmit(e, 'red')} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* 1. Kriterium Auswahl */}
            {allCriteria.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Kriterium</label>
                <select
                  value={selectedCriterion}
                  onChange={(e) => setSelectedCriterion(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                >
                  <option value="">-- Kriterium wählen --</option>
                  {allCriteria.map((crit) => (
                    <option key={crit} value={crit}>{crit}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 2. Dynamischer Grund (erscheint nur, wenn Kriterium gewählt wurde) */}
            {availableReasons.length > 0 && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Grund</label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  required
                >
                  <option value="">-- Bitte Grund auswählen --</option>
                  {availableReasons.map((res) => (
                    <option key={res} value={res}>{res}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Mitarbeiter-Kürzel */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Dein Name / Kürzel</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="z.B. M. Muster"
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                required
              />
            </div>
            
            {/* Freitext-Notiz */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                {isCurrentRed ? 'Neues Update / Abschlussgrund' : 'Ergänzende Notiz'}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isCurrentRed ? "z.B. Techniker vor Ort..." : "z.B. Nähere Details zur Störung..."}
                rows="3"
                style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', resize: 'none', boxSizing: 'border-box' }}
                required
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', borderTop: '1px solid #edf2f7', paddingTop: '12px' }}>
              <button type="button" onClick={onClose} style={{ padding: '8px 14px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                Abbrechen
              </button>

              {isCurrentRed ? (
                <>
                  <button type="submit" style={{ padding: '8px 14px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    Update hinzufügen
                  </button>
                  <button type="button" onClick={(e) => handleProcessSubmit(e, 'green')} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                    Gelöst (➔ GRÜN)
                  </button>
                </>
              ) : (
                <button type="submit" style={{ padding: '8px 14px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  Als ROT speichern
                </button>
              )}
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
