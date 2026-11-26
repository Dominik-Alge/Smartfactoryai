// =========================================================================
// ARCHIV – abgeschlossene Tickets als Unternehmensgedächtnis
// =========================================================================

import React, { useMemo, useState } from 'react';
import { Card, Badge, Empty, inputClass } from './ui.jsx';
import { formatDate } from './format.js';

const searchable = (t) =>
  [t.id, t.title, t.machineId, t.criterion, t.cause, t.lessonsLearned, t.containment, ...(t.whys || [])]
    .join(' ')
    .toLowerCase();

export default function ArchiveView({ tickets, config, onSelect }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...tickets].sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || ''));
    return q ? sorted.filter((t) => searchable(t).includes(q)) : sorted;
  }, [tickets, query]);

  return (
    <Card
      title={`Abgeschlossene Tickets (${tickets.length})`}
      right={
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen: Maschine, Ursache, Lessons Learned …" className={`${inputClass} w-72 py-1 text-xs`} />
      }
    >
      {shown.length === 0 ? (
        <Empty>{query ? 'Keine Treffer.' : 'Noch keine abgeschlossenen Tickets.'}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400 uppercase border-b border-slate-600">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Vorfall</th>
                <th className="p-2">Maschine</th>
                <th className="p-2">Höchste Stufe</th>
                <th className="p-2">Ursache</th>
                <th className="p-2">Lessons Learned</th>
                <th className="p-2">Geschlossen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {shown.map((t) => (
                <tr key={t.id} onClick={() => onSelect(t.id)} className="hover:bg-slate-800/60 cursor-pointer">
                  <td className="p-2 font-mono text-amber-300">{t.id}</td>
                  <td className="p-2 text-white font-bold">{t.title}</td>
                  <td className="p-2 text-slate-300">{t.machineId}</td>
                  <td className="p-2">
                    <Badge>{config.levels[t.escalationInfo.currentLevel].short}</Badge>
                  </td>
                  <td className="p-2 text-slate-300 max-w-xs truncate" title={t.cause}>{t.cause || '–'}</td>
                  <td className="p-2 text-emerald-300 max-w-xs truncate" title={t.lessonsLearned}>{t.lessonsLearned || '–'}</td>
                  <td className="p-2 text-slate-400">{formatDate(t.closedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
