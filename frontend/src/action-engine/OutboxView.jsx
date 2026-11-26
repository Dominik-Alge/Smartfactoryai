// =========================================================================
// POSTAUSGANG – Vorschau aller Mails, die das System verschickt (hätte)
// -------------------------------------------------------------------------
// Solange die IT den Mailversand nicht freigibt, werden die Mails nicht
// verschickt, aber hier genau so angezeigt, wie sie ankommen würden.
// Der Postausgang lebt im Arbeitsspeicher: Nach einem Neustart ist er leer.
// =========================================================================

import React, { useEffect, useState } from 'react';
import { Card, Badge, Empty, Notice } from './ui.jsx';
import { api } from './api.js';
import { formatMoment } from './format.js';

export default function OutboxView() {
  const [outbox, setOutbox] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .outbox()
      .then((data) => {
        setOutbox(data);
        if (data.mails.length) setSelectedId(data.mails[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <Notice>{error}</Notice>;
  if (!outbox) return <Empty>Lade Postausgang …</Empty>;

  const selected = outbox.mails.find((m) => m.id === selectedId);

  return (
    <div className="flex flex-col gap-4">
      {!outbox.enabled && (
        <div className="text-xs bg-sky-500/15 border border-sky-500/40 text-sky-200 rounded-lg px-3 py-2">
          Der Mailversand ist noch nicht freigegeben. Hier siehst du jede Mail genau so, wie sie verschickt würde.
        </div>
      )}
      {outbox.mails.length === 0 ? (
        <Empty>Noch keine Mails. Setze im Panel eine Zelle auf ROT oder eskaliere ein Ticket.</Empty>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_2fr] gap-4 items-start">
          <div className="flex flex-col gap-2">
            {outbox.mails.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`text-left bg-[#273549] border rounded-xl p-3 hover:bg-[#2f3f57] ${
                  m.id === selectedId ? 'border-amber-400' : 'border-slate-600/60'
                }`}
              >
                <div className="flex justify-between gap-2 text-[11px] text-slate-400">
                  <span>{formatMoment(m.at)}</span>
                  <Badge tone={m.kind === 'Eskalation' ? 'amber' : 'red'}>{m.kind}</Badge>
                </div>
                <div className="text-sm font-bold text-white mt-1">{m.subject}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">an {m.to}</div>
              </button>
            ))}
          </div>
          {selected && (
            <Card title="Vorschau" right={<Badge tone={selected.status === 'gesendet' ? 'green' : 'slate'}>{selected.status}</Badge>}>
              <div className="text-xs text-slate-300 mb-3 space-y-0.5">
                <div><span className="text-slate-500">An:</span> {selected.to}</div>
                <div><span className="text-slate-500">Betreff:</span> {selected.subject}</div>
              </div>
              <iframe title="Mail-Vorschau" srcDoc={selected.html} sandbox="" className="w-full h-[460px] bg-white rounded-lg" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
