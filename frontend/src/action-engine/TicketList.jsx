// =========================================================================
// TICKETLISTE – offene Vorfälle, sortiert nach Dringlichkeit
// -------------------------------------------------------------------------
// Jede Karte zeigt die Eskalationsuhr: wie viel Arbeitszeit vergangen ist
// und wie viel davon bis zur nächsten Stufe verbraucht ist.
// =========================================================================

import React from 'react';
import { Badge, AgingBar, Empty, STATE_TONE } from './ui.jsx';
import { formatWorkTime } from './format.js';

const STATE_BORDER = {
  ok: 'border-slate-600/60',
  warn: 'border-amber-500/60',
  due: 'border-red-500 ring-1 ring-red-500/40',
  closed: 'border-slate-600/60'
};

// Fällige zuerst, dann nach verbrauchter Zeit
export function byUrgency(a, b) {
  const pa = a.escalationInfo.progress ?? 0;
  const pb = b.escalationInfo.progress ?? 0;
  return pb - pa;
}

function TicketCard({ ticket, config, selected, onSelect }) {
  const info = ticket.escalationInfo;
  const levels = config.levels;
  const next = info.nextLevel != null ? levels[info.nextLevel] : null;
  const pct = info.progress != null ? Math.round(info.progress * 100) : null;
  const phase = config.phases.find((p) => p.id === ticket.phase);

  return (
    <button
      type="button"
      onClick={() => onSelect(ticket.id)}
      className={`w-full text-left bg-[#273549] rounded-xl border p-3 transition hover:bg-[#2f3f57] ${
        selected ? 'outline outline-2 outline-amber-400' : ''
      } ${STATE_BORDER[info.state]}`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
        <span className="font-mono">{ticket.id}</span>
        {info.suggestedLevel != null ? (
          <Badge tone="red">Eskalation vorgeschlagen</Badge>
        ) : (
          <span>
            {phase?.short} · {phase?.label}
          </span>
        )}
      </div>

      <div className="text-sm font-bold text-white mt-1 truncate">{ticket.title}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">
        Maschine {ticket.machineId} · {levels[info.currentLevel].short} · seit {formatWorkTime(info.workedMs)}
      </div>

      <div className="mt-2">
        <AgingBar progress={info.progress} state={info.state} />
      </div>
      {next && (
        <div className={`text-[11px] mt-1 ${info.state === 'due' ? 'text-red-300' : 'text-slate-400'}`}>
          {pct} % bis {next.short}
          {info.dismissed && ' · bewusst nicht eskaliert'}
        </div>
      )}
    </button>
  );
}

export default function TicketList({ tickets, config, selectedId, onSelect }) {
  const due = tickets.filter((t) => t.escalationInfo.state === 'due').length;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span className="font-bold uppercase tracking-wider">Offene Vorfälle ({tickets.length})</span>
        {due > 0 && <Badge tone={STATE_TONE.due}>{due} fällig</Badge>}
      </div>
      {tickets.length === 0 && <Empty>Keine offenen Vorfälle. Störungsfreier Betrieb.</Empty>}
      {tickets.map((t) => (
        <TicketCard key={t.id} ticket={t} config={config} selected={t.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
