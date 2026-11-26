// =========================================================================
// KALENDER – welche Maschine läuft ein- oder zweischichtig?
// -------------------------------------------------------------------------
// Bestimmt, wie schnell die Eskalationsuhr einer Maschine läuft.
// Feiertage und Betriebsferien stehen in backend/config/calendar.js.
// =========================================================================

import React, { useEffect, useState } from 'react';
import { Card, Notice } from './ui.jsx';
import { api } from './api.js';
import { formatDate } from './format.js';

export default function CalendarSettings({ config, onChanged }) {
  const [panels, setPanels] = useState([]);
  const [error, setError] = useState(null);

  const load = () => api.calendars().then(setPanels).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const change = async (panelId, machineId, calendarId) => {
    try {
      await api.setMachineCalendar(panelId, machineId, calendarId);
      await load();
      onChanged();
    } catch (e) {
      setError(e.message);
    }
  };

  const upcoming = config.holidays.filter((h) => h.date >= new Date().toISOString().slice(0, 10)).slice(0, 8);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <Notice onClose={() => setError(null)}>{error}</Notice>
        {panels.map((p) => (
          <Card key={p.panelId} title={p.name}>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {p.machines.map((m) => (
                <label key={m.machineId} className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-xs">
                  <span className="block font-bold text-white mb-1">{m.machineId}</span>
                  <select
                    value={m.calendarId}
                    onChange={(e) => change(p.panelId, m.machineId, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                  >
                    {Object.entries(config.calendars).map(([id, cal]) => (
                      <option key={id} value={id}>{cal.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <Card title="Eskalationsstufen">
          <ul className="text-xs text-slate-300 space-y-1">
            {config.levels.map((l) => (
              <li key={l.name} className="flex justify-between">
                <span>{l.short}</span>
                <span className="text-slate-400">
                  {l.after.workdays != null ? `ab ${l.after.workdays} Arbeitstagen` : l.after.hours ? `ab ${l.after.hours} h` : 'sofort'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mt-2">Gezählt wird Arbeitszeit seit der Meldung. Das System schlägt nur vor.</p>
        </Card>
        <Card title="Nächste Feiertage (TG)">
          <ul className="text-xs text-slate-300 space-y-1">
            {upcoming.map((h) => (
              <li key={h.date} className="flex justify-between">
                <span>{h.label}</span>
                <span className="text-slate-400">{formatDate(h.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Betriebsferien">
          <ul className="text-xs text-slate-300 space-y-1">
            {config.companyHolidays.map((h) => (
              <li key={h.from}>
                {h.label}
                <span className="block text-slate-400">{formatDate(h.from)} – {formatDate(h.to)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mt-2">Anpassen in backend/config/calendar.js</p>
        </Card>
      </div>
    </div>
  );
}
