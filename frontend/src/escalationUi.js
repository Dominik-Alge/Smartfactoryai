// =========================================================================
// Gemeinsame Darstellung der Eskalationsstufen (Farben, Pulsieren)
// Wird von Panel, Insel-Sicht, Cockpit und Action Engine verwendet.
// =========================================================================

export const ESCALATION_LEVELS = [
  'Shopfloor (Lvl 1)',
  'Gruppenleitung (Lvl 2)',
  'Inselleitung (Lvl 3)',
  'Produktionsleitung (Lvl 4)'
];

// Farben je Stufe: Lvl 1 normales Rot, danach Orange → Rot-Orange → Violett
export const LEVEL_STYLES = [
  { short: 'Shopfloor', tag: 'L1', color: '#ef4444', soft: '#fee2e2', text: '#991b1b' },
  { short: 'Gruppenleitung', tag: 'L2', color: '#f59e0b', soft: '#fef3c7', text: '#92400e' },
  { short: 'Inselleitung', tag: 'L3', color: '#f97316', soft: '#ffedd5', text: '#9a3412' },
  { short: 'Produktionsleitung', tag: 'L4', color: '#a855f7', soft: '#f3e8ff', text: '#6b21a8' }
];

// Versteht neue und alte Bezeichnungen
export function levelIndex(name) {
  if (name == null) return 0;
  if (typeof name === 'number') return Math.max(0, Math.min(3, name));
  const m = String(name).match(/Lvl\s*(\d)/i);
  if (m) return Math.max(0, Math.min(3, Number(m[1]) - 1));
  const i = ESCALATION_LEVELS.indexOf(name);
  return i < 0 ? 0 : i;
}

export const levelStyle = (nameOrIndex) => LEVEL_STYLES[levelIndex(nameOrIndex)];

// Globale CSS-Regeln einmalig einfügen: Puls-Animation + Druckmodus
export function ensureGlobalStyles() {
  if (typeof document === 'undefined' || document.getElementById('sf-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'sf-global-styles';
  style.textContent = `
@keyframes sfEscPulse {
  0%   { box-shadow: 0 0 0 0 var(--sf-esc-color, #f59e0b); }
  70%  { box-shadow: 0 0 0 10px rgba(0,0,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
}
.sf-esc-pulse { animation: sfEscPulse 1.4s ease-out infinite; }
@media print {
  .no-print { display: none !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .sf-esc-pulse { animation: none !important; }
  html.sf-print-dark { filter: invert(1) hue-rotate(180deg); background: #fff !important; }
  @page { size: A4 landscape; margin: 8mm; }
}`;
  document.head.appendChild(style);
}
