// =========================================================================
// TICKET-DETAIL – Kopf, Phasenleiste, Eskalation, aktuelle Phase, Verlauf
// =========================================================================

import React, { useState } from 'react';
import { Card, Button, Badge } from './ui.jsx';
import { PhaseStepper, PhaseContent } from './PhaseSteps.jsx';
import EscalationPanel from './EscalationPanel.jsx';
import { formatMoment } from './format.js';

function History({ entries }) {
  const [open, setOpen] = useState(false);
  if (!entries?.length) return null;
  return (
    <div className="text-xs border-t border-slate-700 pt-2">
      <button type="button" onClick={() => setOpen(!open)} className="text-slate-400 hover:text-slate-200">
        {open ? '▾' : '▸'} Verlauf ({entries.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-1 text-slate-400">
          {entries
            .slice()
            .reverse()
            .map((h, i) => (
              <li key={i}>
                <span className="text-slate-500">{formatMoment(h.timestamp)}</span> · {h.user} · {h.details || h.event}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export default function TicketDetail({ ticket, config, handlers }) {
  const phaseIndex = config.phases.findIndex((p) => p.id === ticket.phase);
  const isLast = phaseIndex === config.phases.length - 1;
  const next = config.phases[phaseIndex + 1];
  const closed = Boolean(ticket.closedAt);

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-mono">{ticket.id}</span>
              <span>· Maschine {ticket.machineId}</span>
              <span>· {ticket.criterion}</span>
              <span>· gemeldet {formatMoment(ticket.createdAt)} von {ticket.creator}</span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-1">{ticket.title}</h2>
          </div>
          {closed && <Badge tone="green">Geschlossen {formatMoment(ticket.closedAt)}</Badge>}
        </div>

        <PhaseStepper phases={config.phases} current={ticket.phase} closed={closed} />

        <EscalationPanel ticket={ticket} config={config} onAction={handlers.escalation} />

        <PhaseContent ticket={ticket} config={config} handlers={handlers} />

        {!closed && (
          <div className="flex flex-wrap justify-between gap-2 border-t border-slate-700 pt-3">
            <Button onClick={handlers.previousPhase} disabled={phaseIndex === 0}>
              ← Zurück
            </Button>
            {ticket.phase !== 'wirksamkeit' && (
              <Button variant={isLast ? 'success' : 'primary'} onClick={handlers.nextPhase}>
                {isLast ? 'Lernschleife schliessen' : `Weiter zu ${next.short} · ${next.label} →`}
              </Button>
            )}
          </div>
        )}

        <History entries={ticket.history} />
      </div>
    </Card>
  );
}
