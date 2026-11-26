import React, { useState, useEffect } from 'react';

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  targetType, // z.B. "Gruppe", "Maschine" oder "Kategorie"
  targetName  // z.B. "Gruppe Drehen" oder "12766"
}) {
  const [confirmWord, setConfirmWord] = useState('');
  const [author, setAuthor] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmWord('');
      setAuthor('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Button ist nur aktiv, wenn exakt "Löschen" eingegeben wurde UND ein Kürzel drinsteht
  const isValid = confirmWord.trim() === 'Löschen' && author.trim().length >= 2;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    onConfirm(author.trim());
  };

  return (
    <div style={{
      position: 'fixed', inset: '0', backgroundColor: 'rgba(15, 23, 42, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1100,
      fontFamily: '"Inter", Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden', border: '1px solid #e2e8f0'
      }}>
        {/* Roter Warn-Header */}
        <div style={{
          padding: '16px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(to right, #dc2626, #991b1b)'
        }}>
          <div>
            <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700' }}>
              Endgültig löschen ({targetType})
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>
              Element: <strong>{targetName}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', lineHeight: '1' }}>
            &times;
          </button>
        </div>

        {/* Formular */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '10px 12px', borderRadius: '0 6px 6px 0', fontSize: '12px', color: '#7f1d1d' }}>
            <strong>Achtung:</strong> Dieser Vorgang entfernt <strong>{targetName}</strong> inkl. aller zugehörigen Ampel-Daten unwiderruflich.
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
              Sicherheits-Befehl: Bitte <span style={{ color: '#dc2626', textDecoration: 'underline' }}>Löschen</span> eintippen
            </label>
            <input
              type="text"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder="Löschen"
              autoFocus
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
              Dein Kürzel / Name (Pflichtfeld)
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="z.B. DA oder D. Alge"
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 14px', border: '1px solid #cbd5e1', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!isValid}
              style={{
                padding: '8px 16px',
                backgroundColor: isValid ? '#dc2626' : '#fca5a5',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: isValid ? 'pointer' : 'not-allowed',
                fontSize: '13px',
                fontWeight: '700',
                transition: 'background-color 0.15s'
              }}
            >
              Endgültig löschen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
