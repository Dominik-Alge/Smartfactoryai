// =========================================================================
// ESKALATIONSPFAD – Stufen, Uhr und Vorschlag
// -------------------------------------------------------------------------
// Das System schlägt nur vor. Wer eskaliert, nicht eskaliert oder eine
// Stufe zurücknimmt, muss es begründen. Alles landet in der Historie.
// =========================================================================

import React, { useState } from 'react';
import { Button, Badge, AgingBar, inputClass, STATE_TONE } from './ui.jsx';
import { formatWorkTime, formatMoment, formatDate } from './format.js';

const ACTIONS = {
  up: { label: 'Eskalieren', placeholder: 'Warum braucht es die nächste Stufe? Was soll sie tun?', variant: 'danger' },
  dismiss: { label: 'Nicht eskalieren', placeholder: 'Warum ist eine Eskalation jetzt nicht nötig?', variant: 'secondary' },
  down: { label: 'Stufe zurücknehmen', placeholder: 'Warum reicht die tiefere Stufe?', variant: 'secondary' }
};

function LevelPath({ levels, info }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {levels.map((lvl, i) => {
        let cls = 'border-slate-700 text-slate-500';
        if (i < info.currentLevel) cls = 'border-slate-600 text-slate-400 bg-slate-800';
        if (i === info.currentLevel) cls = `font-bold ${info.state === 'due' ? 'border-red-500 bg-red-500/20 text-red-200' : 'border-amber-400 bg-amber-500/15 text-amber-200'}`;
        if (i === info.suggestedLevel) cls = 'border-dashed border-red-400 text-red-300';
        return (
          <React.Fragment key={lvl.name}>
            {i > 0 && <span className="text-slate-600">›</span>}
            <span className={`px-2 py-0.5 rounded-md border ${cls}`}>{lvl.short}</span>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function EscalationPanel({ ticket, config, onAction }) {
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState('');
  const info = ticket.escalationInfo;
  const levels = config.levels;
  const next = info.nextLevel != null ? levels[info.nextLevel] : null;
  const closed = Boolean(ticket.closedAt);

  const submit = async () => {
    const ok = await onAction(mode, reason);
    if (ok) {
      setMode(null);
      setReason('');
    }
  };

  return (
    <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LevelPath levels={levels} info={info} />
        <span className="text-[11px] text-slate-400">
          Kalender: {config.calendars[ticket.calendarId]?.label}
        </span>
      </div>

      {next && !closed && (
        <div>
          <AgingBar progress={info.progress} state={info.state} />
          <div className="flex flex-wrap justify-between gap-2 text-[11px] mt-1 text-slate-400">
            <span>
              Arbeitszeit seit Meldung: <b className="text-slate-200">{formatWorkTime(info.workedMs)}</b> von{' '}
              {formatWorkTime(info.nextAtMs)}
            </span>
            <span className={info.state === 'due' ? 'text-red-300' : ''}>
              {next.short} {info.state === 'due' ? 'fällig seit' : 'ab'} {formatMoment(info.nextDueAt)}
            </span>
          </div>
        </div>
      )}

      {info.suggestedLevel != null && !mode && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-2">
          <span className="text-xs text-red-200">
            Zeitbudget überschritten. Vorschlag: an <b>{levels[info.suggestedLevel].short}</b> eskalieren.
          </span>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => setMode('up')}>Eskalieren …</Button>
            <Button onClick={() => setMode('dismiss')}>Nicht eskalieren …</Button>
          </div>
        </div>
      )}

      {info.dismissed && (
        <div className="text-[11px] text-slate-400">
          <Badge tone="slate">Bewusst nicht eskaliert</Badge> „{info.dismissed.reason}“ – {info.dismissed.by},{' '}
          {formatMoment(info.dismissed.at)}
        </div>
      )}

      {mode && (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={ACTIONS[mode].placeholder}
            className={inputClass}
          />
          <div className="flex gap-2 justify-end">
            <Button onClick={() => setMode(null)}>Abbrechen</Button>
            <Button variant={mode === 'up' ? 'danger' : 'primary'} disabled={!reason.trim()} onClick={submit}>
              {ACTIONS[mode].label}
              {mode === 'up' && next ? ` an ${next.short}` : ''}
            </Button>
          </div>
          {mode === 'up' && <span className="text-[11px] text-slate-400">Die nächste Stufe erhält eine Mail mit deiner Begründung.</span>}
        </div>
      )}

      {!mode && !closed && (
        <div className="flex flex-wrap gap-2 justify-end">
          {info.suggestedLevel == null && next && (
            <Button onClick={() => setMode('up')}>Eskalieren …</Button>
          )}
          {info.currentLevel > 0 && <Button onClick={() => setMode('down')}>Stufe zurücknehmen …</Button>}
        </div>
      )}

      {ticket.escalation?.history?.length > 0 && (
        <ul className="text-[11px] text-slate-400 border-t border-slate-700 pt-2 space-y-1">
          {ticket.escalation.history
            .slice()
            .reverse()
            .map((h, i) => (
              <li key={i}>
                <Badge tone={h.to > h.from ? STATE_TONE.due : 'green'}>
                  {levels[h.from].short} → {levels[h.to].short}
                </Badge>{' '}
                {h.reason} – {h.by}, {formatDate(h.at)}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
