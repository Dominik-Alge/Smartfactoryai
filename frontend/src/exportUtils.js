// =========================================================================
// Export & Druck: CSV für Excel (Schweiz: Semikolon, UTF-8 mit BOM)
// und saubere Druckberichte (weisser Hintergrund, Tabelle).
// =========================================================================

const fmtDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const hours = (a, b) => {
  const s = Date.parse(a);
  const e = Date.parse(b);
  if (!s || !e || e < s) return '';
  return (Math.round(((e - s) / 3600000) * 10) / 10).toFixed(1);
};

// Einheitliche Spalten für Tickets / Fälle
export const TICKET_COLUMNS = [
  { label: 'ID', value: (t) => t.id },
  { label: 'Gruppe', value: (t) => t.panelName || t.panelId || '' },
  { label: 'Maschine', value: (t) => t.machineId },
  { label: 'Kriterium', value: (t) => t.criterion },
  { label: 'Titel', value: (t) => t.title },
  { label: 'Status', value: (t) => t.status },
  { label: 'Stufe', value: (t) => t.escalationLevel },
  { label: 'Automatisch eskaliert', value: (t) => (t.autoEscalated ? 'ja' : 'nein') },
  { label: 'Maschine steht', value: (t) => (t.machineDown ? 'ja' : 'nein') },
  { label: 'Gemeldet', value: (t) => fmtDateTime(t.createdAt) },
  { label: 'Am Shopfloor behoben', value: (t) => fmtDateTime(t.resolvedAt) },
  { label: 'Störungsdauer (h)', value: (t) => hours(t.createdAt, t.resolvedAt) },
  { label: 'Abgeschlossen', value: (t) => fmtDateTime(t.closedAt) },
  { label: 'Durchlaufzeit bis Abschluss (h)', value: (t) => hours(t.createdAt, t.closedAt) },
  { label: 'Ursache', value: (t) => t.cause },
  { label: 'Lessons Learned', value: (t) => t.lessonsLearned },
  { label: 'Wiederholfall von', value: (t) => (t.recurrence?.decision === 'same' ? t.recurrence.relatedId : '') },
  { label: 'Warum nicht gegriffen', value: (t) => t.recurrence?.whyFailed || '' },
  { label: 'Was jetzt anders', value: (t) => t.recurrence?.nextStep || '' },
  { label: 'Hat sich wiederholt (Folgefälle)', value: (t) => (t.recurredBy || []).join(', ') },
  { label: 'Massnahmen', value: (t) => (t.tasks || []).map((k) => `[${k.owner}] ${k.title} (${k.status === 'completed' ? 'erledigt' : 'offen'})`).join(' | ') }
];

export function downloadCsv(filename, columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v).replace(/\r?\n/g, ' ');
    return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(';')];
  rows.forEach((r) => lines.push(columns.map((c) => esc(c.value(r))).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const html = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Öffnet einen Druckbericht in einem neuen Fenster (Tabelle und/oder Detailblöcke)
export function printReport({ title, subtitle = '', columns = null, rows = [], blocks = [] }) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Das Druckfenster wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.');
    return;
  }
  const table = columns
    ? `<table><thead><tr>${columns.map((c) => `<th>${html(c.label)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${columns.map((c) => `<td>${html(c.value(r))}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`
    : '';
  const blockHtml = blocks
    .map(
      (b) =>
        `<section><h2>${html(b.heading)}</h2>${(b.items || [])
          .map((it) => `<div class="row"><span class="k">${html(it[0])}</span><span class="v">${html(it[1])}</span></div>`)
          .join('')}${b.text ? `<p>${html(b.text)}</p>` : ''}</section>`
    )
    .join('');
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${html(title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
  header { border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
  h1 { font-size: 18px; margin: 0; } .sub { color: #475569; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: left; vertical-align: top; }
  th { background: #e2e8f0; font-size: 10px; text-transform: uppercase; }
  tr:nth-child(even) td { background: #f8fafc; }
  section { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; page-break-inside: avoid; }
  h2 { font-size: 12px; margin: 0 0 6px; text-transform: uppercase; color: #334155; }
  .row { display: flex; gap: 8px; padding: 2px 0; border-bottom: 1px dotted #e2e8f0; }
  .k { width: 210px; color: #475569; font-weight: 600; } .v { flex: 1; }
  footer { margin-top: 10px; color: #64748b; font-size: 9px; }
</style></head><body>
<header><div><h1>${html(title)}</h1><div class="sub">${html(subtitle)}</div></div>
<div class="sub">Erstellt: ${html(new Date().toLocaleString('de-CH'))}</div></header>
${blockHtml}${table}
<footer>Shopfloor Panel · ${rows.length ? `${rows.length} Einträge` : ''}</footer>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// Detailbericht für einen einzelnen Fall
export function printTicketReport(t) {
  const blocks = [
    {
      heading: 'Fall',
      items: TICKET_COLUMNS.slice(0, 14).map((c) => [c.label, c.value(t)])
    },
    {
      heading: 'KVP / Lernschleife',
      items: [
        ['Ursache', t.cause || '–'],
        ['Lessons Learned', t.lessonsLearned || '–'],
        ['Hat sich wiederholt (Folgefälle)', (t.recurredBy || []).join(', ') || '–']
      ]
    }
  ];
  if (t.recurrence?.candidates?.length) {
    blocks.push({
      heading: 'Wiederholfall',
      items: [
        ['Entscheid', t.recurrence.decision === 'same' ? 'Derselbe Fall' : t.recurrence.decision === 'different' ? 'Anderer Fall' : 'Noch offen'],
        ['Vorgängerfall', t.recurrence.relatedId || '–'],
        ['Warum hat die Massnahme nicht gegriffen?', t.recurrence.whyFailed || '–'],
        ['Was machen wir jetzt anders?', t.recurrence.nextStep || '–']
      ]
    });
  }
  if ((t.tasks || []).length) {
    blocks.push({
      heading: 'Massnahmen',
      items: t.tasks.map((k) => [`[${k.owner}]`, `${k.title} – ${k.status === 'completed' ? 'erledigt' : 'offen'}`])
    });
  }
  if ((t.history || []).length) {
    blocks.push({
      heading: 'Verlauf',
      items: t.history.map((h) => [fmtDateTime(h.timestamp), `${h.details || h.event} (${h.user || 'System'})`])
    });
  }
  printReport({ title: `Fallbericht ${t.id}`, subtitle: `${t.title} · Maschine ${t.machineId}`, blocks });
}
