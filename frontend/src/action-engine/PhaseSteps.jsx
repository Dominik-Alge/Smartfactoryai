// =========================================================================
// PHASEN 0 · P · D · C · A – Leiste und Eingabe je Phase
// -------------------------------------------------------------------------
// Geöffnet ist immer nur die aktuelle Phase. Was in früheren Phasen
// erfasst wurde, steht darunter als Zusammenfassung.
// Textfelder speichern automatisch, sobald man sie verlässt.
// =========================================================================

import React, { useEffect, useState } from 'react';
import { Button, Badge, inputClass } from './ui.jsx';
import { formatDate, isOverdue, todayIso } from './format.js';

// --- Phasenleiste -----------------------------------------------------------

export function PhaseStepper({ phases, current, closed }) {
  const currentIndex = phases.findIndex((p) => p.id === current);
  return (
    <ol className="grid grid-cols-5 gap-1.5">
      {phases.map((p, i) => {
        const done = closed || i < currentIndex;
        const active = !closed && i === currentIndex;
        const cls = done
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
          : active
          ? 'bg-amber-500/20 border-amber-400 text-amber-200'
          : 'bg-slate-800/60 border-slate-700 text-slate-500';
        return (
          <li key={p.id} className={`border rounded-lg px-2 py-1.5 text-center ${cls}`}>
            <div className="text-sm font-black leading-none">{done ? '✓' : p.short}</div>
            <div className="text-[11px] mt-0.5 truncate">{p.label}</div>
          </li>
        );
      })}
    </ol>
  );
}

// --- Textfeld mit automatischem Speichern ---------------------------------------

function SavedTextarea({ label, hint, value, onSave, rows = 3, placeholder }) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(value), [value]);

  const save = async () => {
    if (draft === value) return;
    if (await onSave(draft)) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  return (
    <label className="block">
      <span className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {label}
        {saved && <span className="text-emerald-400 normal-case tracking-normal">gespeichert</span>}
      </span>
      <textarea rows={rows} value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onBlur={save} className={inputClass} />
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

// --- 0 Sofortmassnahme -----------------------------------------------------------

function ContainmentStep({ ticket, edit }) {
  return (
    <SavedTextarea
      label="Sofortmassnahme"
      hint="Was wurde getan, damit kein weiterer Schaden entsteht? (Maschine gestoppt, Teile gesperrt …)"
      value={ticket.containment}
      onSave={(containment) => edit({ containment })}
      placeholder="Maschine gestoppt, Teile seit 10:00 gesperrt"
    />
  );
}

// --- P Ursache (5× Warum) -----------------------------------------------------------

function CauseStep({ ticket, edit }) {
  const stored = JSON.stringify(ticket.whys);
  const [whys, setWhys] = useState(ticket.whys.length ? ticket.whys : ['']);
  // Nur neu laden, wenn sich der gespeicherte Inhalt wirklich geändert hat
  useEffect(() => setWhys(ticket.whys.length ? ticket.whys : ['']), [stored]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveWhys = (list) => edit({ whys: list.map((w) => w.trim()).filter(Boolean) });
  const change = (i, text) => setWhys(whys.map((w, j) => (j === i ? text : w)));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">5× Warum</span>
        <div className="flex flex-col gap-1.5">
          {whys.map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 w-5 text-right">{i + 1}.</span>
              <input
                value={w}
                onChange={(e) => change(i, e.target.value)}
                onBlur={() => saveWhys(whys)}
                placeholder={i === 0 ? `Warum ist "${ticket.title}" passiert?` : 'Und warum?'}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        {whys.length < 5 && whys[whys.length - 1].trim() && (
          <button type="button" onClick={() => setWhys([...whys, ''])} className="text-xs text-amber-300 hover:text-amber-200 mt-1.5 ml-7">
            + Und warum?
          </button>
        )}
      </div>
      <SavedTextarea
        label="Wahre Ursache"
        hint="Die Ursache, die du abstellen willst – meist das letzte Warum."
        rows={2}
        value={ticket.cause}
        onSave={(cause) => edit({ cause })}
      />
    </div>
  );
}

// --- D Abstellmassnahmen (Tasks) -------------------------------------------------------

export function TaskList({ ticket, owners, onAdd, onToggle, onRemove, readOnly }) {
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState(owners[0]);
  const [due, setDue] = useState('');

  const add = async (e) => {
    e.preventDefault();
    if (await onAdd({ title, owner, due: due || null })) {
      setTitle('');
      setDue('');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {ticket.tasks.length === 0 && <p className="text-xs text-slate-500">Noch keine Massnahme erfasst.</p>}
      {ticket.tasks.map((t) => {
        const done = t.status === 'completed';
        const late = isOverdue(t);
        return (
          <div key={t.id} className={`flex items-center gap-2 text-sm bg-[#0f172a] border rounded-lg px-3 py-2 ${late ? 'border-red-500/60' : 'border-slate-700'}`}>
            <input type="checkbox" checked={done} disabled={readOnly} onChange={() => onToggle(t.id)} className="accent-emerald-500 w-4 h-4" />
            <span className={`flex-1 ${done ? 'line-through text-slate-500' : 'text-slate-100'}`}>{t.title}</span>
            <span className="text-[11px] text-slate-400">{t.owner}</span>
            {t.due && <Badge tone={late ? 'red' : done ? 'green' : 'slate'}>{late ? 'überfällig ' : ''}{formatDate(t.due)}</Badge>}
            {!readOnly && (
              <button type="button" onClick={() => onRemove(t.id)} className="text-slate-500 hover:text-red-300 text-xs" aria-label="Massnahme löschen">
                ✕
              </button>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 pt-1">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neue Massnahme, z. B. Scheibe neu auswuchten" className={inputClass} />
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={`${inputClass} sm:w-48`}>
            {owners.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <input type="date" min={todayIso()} value={due} onChange={(e) => setDue(e.target.value)} className={`${inputClass} sm:w-40`} title="Termin" />
          <Button variant="primary" disabled={!title.trim()} onClick={add}>+ Zuweisen</Button>
        </form>
      )}
    </div>
  );
}

// --- C Wirksamkeit -----------------------------------------------------------------

function EffectivenessStep({ ticket, onEffectiveness }) {
  const [note, setNote] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-300">
        Haben die Massnahmen das Problem behoben? Prüfe am Prozess, nicht am Papier – z. B. Messwerte der nächsten Teile.
      </p>
      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wie wurde geprüft? (z. B. 20 Teile gemessen, Rundlauf i. O.)" className={inputClass} />
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="danger" onClick={() => onEffectiveness('nicht_wirksam', note)}>Nicht wirksam – zurück zur Ursache</Button>
        <Button variant="success" onClick={() => onEffectiveness('wirksam', note)}>Wirksam</Button>
      </div>
      {ticket.effectiveness && (
        <p className="text-[11px] text-slate-400">
          Letzte Prüfung: {ticket.effectiveness.result === 'wirksam' ? 'wirksam' : 'nicht wirksam'} – {ticket.effectiveness.by}
          {ticket.effectiveness.note && ` („${ticket.effectiveness.note}“)`}
        </p>
      )}
    </div>
  );
}

// --- A Standard -----------------------------------------------------------------

function StandardStep({ ticket, edit }) {
  return (
    <SavedTextarea
      label="Lessons Learned / neuer Standard"
      hint="Was ändert sich dauerhaft (Checkliste, Arbeitsanweisung, Schulung), damit es nicht wieder passiert?"
      value={ticket.lessonsLearned}
      onSave={(lessonsLearned) => edit({ lessonsLearned })}
    />
  );
}

// --- Zusammenfassung abgeschlossener Phasen -------------------------------------------

function Summary({ ticket, phases }) {
  const current = phases.findIndex((p) => p.id === ticket.phase);
  const closed = Boolean(ticket.closedAt);
  const reached = (id) => closed || phases.findIndex((p) => p.id === id) < current;
  const rows = [
    reached('sofort') && ['0 Sofortmassnahme', ticket.containment],
    reached('ursache') && ['P Ursache', [...ticket.whys.map((w, i) => `${i + 1}. ${w}`), `→ ${ticket.cause}`].join('\n')],
    reached('massnahme') && ['D Massnahmen', ticket.tasks.map((t) => `✓ ${t.title} (${t.owner})`).join('\n')],
    reached('wirksamkeit') && ['C Wirksamkeit', ticket.effectiveness?.note || 'wirksam'],
    closed && ['A Lessons Learned', ticket.lessonsLearned]
  ].filter(Boolean);
  if (!rows.length) return null;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs border-t border-slate-700 pt-3">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-slate-500 font-bold whitespace-nowrap">{k}</dt>
          <dd className="text-slate-300 whitespace-pre-line">{v || '–'}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// --- Inhalt der aktuellen Phase ---------------------------------------------------------

export function PhaseContent({ ticket, config, handlers }) {
  const { edit, addTask, toggleTask, removeTask, effectiveness } = handlers;
  const step = {
    sofort: <ContainmentStep ticket={ticket} edit={edit} />,
    ursache: <CauseStep ticket={ticket} edit={edit} />,
    massnahme: <TaskList ticket={ticket} owners={config.owners} onAdd={addTask} onToggle={toggleTask} onRemove={removeTask} />,
    wirksamkeit: <EffectivenessStep ticket={ticket} onEffectiveness={effectiveness} />,
    standard: <StandardStep ticket={ticket} edit={edit} />
  };
  return (
    <div className="flex flex-col gap-4">
      {!ticket.closedAt && step[ticket.phase]}
      <Summary ticket={ticket} phases={config.phases} />
    </div>
  );
}
