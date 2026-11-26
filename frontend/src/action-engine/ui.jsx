// =========================================================================
// UI-BAUSTEINE im Stil des Shopfloor Cockpits (dunkles Schema)
// -------------------------------------------------------------------------
// Farben wie im Cockpit: Seite #1e293b, Leisten #0f172a, Karten #273549,
// Akzent Amber. Ampelfarben: Grün = ok, Amber = bald fällig, Rot = fällig.
// =========================================================================

import React from 'react';

export const TONES = {
  slate: 'bg-slate-800 text-slate-300 border-slate-600',
  red: 'bg-red-500/20 text-red-300 border-red-500/40',
  amber: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  blue: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
};

// Zustand der Eskalationsuhr → Farbe
export const STATE_TONE = { ok: 'green', warn: 'amber', due: 'red', closed: 'slate' };
export const BAR_COLOR = { ok: 'bg-emerald-400', warn: 'bg-amber-400', due: 'bg-red-500', closed: 'bg-slate-500' };

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`bg-[#273549] border border-slate-600/60 rounded-xl p-4 shadow-md min-w-0 ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-600 pb-1.5 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 truncate">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'slate', title }) {
  return (
    <span title={title} className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const BUTTON_STYLES = {
  primary: 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-500',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600',
  danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-200 border-red-500/50',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
};

export function Button({ variant = 'secondary', className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-40 ${BUTTON_STYLES[variant]} ${className}`}
    />
  );
}

export const inputClass =
  'w-full text-sm bg-[#0f172a] border border-slate-600 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400';

export function Empty({ children }) {
  return (
    <div className="text-xs text-center py-6 px-3 rounded-lg border border-dashed border-slate-600 text-slate-400">
      {children}
    </div>
  );
}

// Fortschrittsbalken der Eskalationsuhr (über 100 % bleibt er voll und rot)
export function AgingBar({ progress, state }) {
  const pct = progress == null ? 100 : Math.min(100, Math.round(progress * 100));
  return (
    <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${BAR_COLOR[state]}`} style={{ width: `${Math.max(3, pct)}%` }} />
    </div>
  );
}

// Fehlermeldung, die der Benutzer beheben kann
export function Notice({ children, onClose }) {
  if (!children) return null;
  return (
    <div className="flex items-start justify-between gap-3 text-xs bg-red-500/15 border border-red-500/40 text-red-200 rounded-lg px-3 py-2">
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-red-300 hover:text-white" aria-label="Schliessen">
          ✕
        </button>
      )}
    </div>
  );
}
