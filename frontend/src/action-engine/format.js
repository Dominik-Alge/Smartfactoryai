// =========================================================================
// FORMATIERUNG – Zeiten und Daten für die Anzeige
// =========================================================================

const HOUR = 3600 * 1000;

// Arbeitszeit lesbar: "25 min", "2 h 40", "3,5 h"
export function formatWorkTime(ms) {
  if (ms == null) return '–';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 10) return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  return `${Math.round(ms / HOUR)} h`;
}

// Zeitpunkt relativ zu heute: "heute 14:52", "morgen 09:10", "Mo 30.11. 07:00"
export function formatMoment(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
  const dayDiff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / (24 * HOUR));
  if (dayDiff === 0) return `heute ${time}`;
  if (dayDiff === 1) return `morgen ${time}`;
  if (dayDiff === -1) return `gestern ${time}`;
  return `${d.toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${time}`;
}

export function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Heutiges Datum als JJJJ-MM-TT in Ortszeit
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Fälligkeitsdatum einer Massnahme (JJJJ-MM-TT) überschritten?
export function isOverdue(task) {
  if (!task.due || task.status === 'completed') return false;
  return task.due < todayIso();
}
