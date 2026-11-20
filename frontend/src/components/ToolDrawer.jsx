import React, { useState } from 'react';
import { TICKET_COLUMNS, downloadCsv, printReport } from '../exportUtils';
import { ensureGlobalStyles, levelIndex } from '../escalationUi';

// Werkzeug-Lasche am rechten Bildschirmrand: Drucken & Export in jeder Ansicht.
// Props:
//   apiUrl  – Server-Adresse
//   dark    – true für dunkle Ansichten (Cockpit, Action Engine): wird für den Druck hell umgewandelt
//   viewName – Name der aktuellen Ansicht (für Dateinamen/Titel)
export default function ToolDrawer({ apiUrl, dark = false, viewName = 'Ansicht' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  ensureGlobalStyles();

  const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const loadTickets = async () => {
    const r = await fetch(`${apiUrl}/api/tickets`);
    if (!r.ok) throw new Error('Tickets konnten nicht geladen werden');
    return r.json();
  };

  const loadAlarms = async () => {
    const r = await fetch(`${apiUrl}/api/panels`);
    const panels = (await r.json()).filter((p) => p.id !== 'insel_ds');
    const rows = [];
    for (const p of panels) {
      const pr = await fetch(`${apiUrl}/api/panel/${p.id}`);
      if (!pr.ok) continue;
      const panel = await pr.json();
      (panel.machines || []).forEach((m) =>
        (panel.criteria || []).forEach((c) => {
          const key = `${m}-${c}`;
          const cell = panel.cells?.[key];
          if (cell?.status !== 'red') return;
          const last = (cell.notes || [])[cell.notes.length - 1];
          const esc = panel.escalations?.[key];
          rows.push({
            gruppe: panel.name || p.id,
            maschine: m,
            kriterium: c,
            stufe: esc?.level || 'Shopfloor (Lvl 1)',
            steht: cell.machineDown || esc?.machineDown ? 'ja' : 'nein',
            notiz: last?.text || '',
            von: last?.author || '',
            zeit: last?.timestamp || ''
          });
        })
      );
    }
    return rows;
  };

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      alert(err.message || 'Aktion fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const printView = () => {
    setOpen(false);
    const root = document.documentElement;
    if (dark) root.classList.add('sf-print-dark');
    const cleanup = () => {
      root.classList.remove('sf-print-dark');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 150);
  };

  const ALARM_COLUMNS = [
    { label: 'Gruppe', value: (r) => r.gruppe },
    { label: 'Maschine', value: (r) => r.maschine },
    { label: 'Kriterium', value: (r) => r.kriterium },
    { label: 'Stufe', value: (r) => r.stufe },
    { label: 'Maschine steht', value: (r) => r.steht },
    { label: 'Letzte Notiz', value: (r) => r.notiz },
    { label: 'Von', value: (r) => r.von },
    { label: 'Zeit', value: (r) => r.zeit }
  ];

  const actions = [
    { icon: '🖨️', label: 'Diese Ansicht drucken', hint: dark ? 'wird hell gedruckt' : '', onClick: printView },
    {
      icon: '📋',
      label: 'Aktuelle Störungen drucken',
      onClick: () => run(async () => printReport({ title: 'Aktuelle Störungen', subtitle: 'Alle Gruppen', columns: ALARM_COLUMNS, rows: await loadAlarms() }))
    },
    {
      icon: '📊',
      label: 'Aktuelle Störungen → Excel',
      onClick: () => run(async () => downloadCsv(`Stoerungen_${stamp()}.csv`, ALARM_COLUMNS, await loadAlarms()))
    },
    {
      icon: '📊',
      label: 'Alle Fälle (Action Engine) → Excel',
      onClick: () => run(async () => downloadCsv(`Faelle_${stamp()}.csv`, TICKET_COLUMNS, await loadTickets()))
    },
    {
      icon: '📋',
      label: 'Offene Fälle drucken',
      onClick: () =>
        run(async () =>
          printReport({
            title: 'Offene Fälle',
            subtitle: 'Action Engine · nach Eskalationsstufe sortiert',
            columns: TICKET_COLUMNS.filter((c) =>
              ['ID', 'Gruppe', 'Maschine', 'Kriterium', 'Titel', 'Status', 'Stufe', 'Maschine steht', 'Gemeldet', 'Wiederholfall von'].includes(c.label)
            ),
            rows: (await loadTickets())
              .filter((t) => t.status !== 'Geschlossen')
              .sort((a, b) => levelIndex(b.escalationLevel) - levelIndex(a.escalationLevel))
          })
        )
    }
  ];

  return (
    <div className="no-print">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Drucken & Export"
          className="fixed right-3 bottom-3 z-[60] bg-slate-800/80 hover:bg-slate-700 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg border border-slate-600 opacity-70 hover:opacity-100 transition"
        >
          🖨️ Drucken / Export
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <aside className="fixed right-0 top-0 h-full w-72 z-[61] bg-white text-slate-900 shadow-2xl border-l border-slate-200 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-black text-sm">Drucken & Export</div>
                <div className="text-[11px] text-slate-500">{viewName}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-lg font-bold text-slate-400 hover:text-slate-900">
                ✕
              </button>
            </div>
            {actions.map((a) => (
              <button
                type="button"
                key={a.label}
                disabled={busy}
                onClick={a.onClick}
                className="text-left px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-400 text-sm font-semibold disabled:opacity-50"
              >
                <span className="mr-2">{a.icon}</span>
                {a.label}
                {a.hint && <span className="block text-[11px] font-normal text-slate-500 ml-6">{a.hint}</span>}
              </button>
            ))}
            <p className="mt-auto text-[11px] text-slate-500 leading-snug">
              Excel-Dateien sind CSV mit Semikolon und öffnen sich direkt in Excel. Berichte öffnen ein Druckfenster – dort kannst du auch «Als PDF
              speichern» wählen.
            </p>
          </aside>
        </>
      )}
    </div>
  );
}
