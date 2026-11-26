// =========================================================================
// BEISPIELDATEN FÜR VORFÜHRUNGEN
// -------------------------------------------------------------------------
// Wird nur ausgeführt, wenn die Umgebungsvariable DEMO_DATA=true gesetzt ist
// UND noch keine Tickets existieren. Echte Daten werden nie überschrieben.
// Alle Fälle sind erfunden. Die Alter werden in Arbeitszeit gerechnet, damit
// die Eskalationsbalken zu jeder Uhrzeit dieselbe Lage zeigen.
// =========================================================================

import { createTicket, generateActionId } from '../services/actionService.js';
import { levelName } from '../services/escalation.js';
import { workingMsBetween } from '../services/shiftCalendar.js';
import { PHASES, CLOSED_STATUS } from '../config/actionFlow.js';

const HOUR = 3600 * 1000;

// Zeitpunkt, der genau workMs Arbeitszeit vor "jetzt" liegt (Intervallsuche)
function workingAgo(workMs, calendarId, now = Date.now()) {
  let lo = now - 120 * 24 * HOUR;
  let hi = now;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (workingMsBetween(mid, now, calendarId) > workMs) lo = mid;
    else hi = mid;
  }
  return new Date(hi).toISOString();
}

const phaseLabel = (id) => PHASES.find((p) => p.id === id).label;

const CASES = [
  {
    panelId: 'schleifen', machineId: '13503', criterion: 'Maschine', note: 'Spindel vibriert',
    workedH: 2.7, level: 0, phase: 'ursache',
    containment: 'Maschine gestoppt, Teile seit 10:00 gesperrt.',
    whys: ['Unwucht an der Schleifscheibe', 'Nach Scheibenwechsel nicht ausgewuchtet']
  },
  {
    panelId: 'schleifen', machineId: '13704', criterion: 'DISPO', note: 'Rohmaterial fehlt',
    workedH: 5, level: 1, phase: 'massnahme',
    containment: 'Auf Auftrag 4711 umgerüstet.',
    whys: ['Lieferung nicht eingetroffen', 'Bestellung zu spät ausgelöst'],
    cause: 'Mindestbestand im ERP zu tief eingestellt.',
    tasks: [
      { title: 'Lieferant kontaktieren', owner: 'Einkauf / Material', dueH: -30, done: true },
      { title: 'Mindestbestand anpassen', owner: 'Logistik / Lager', dueH: -26, done: false }
    ]
  },
  {
    panelId: 'schleifen', machineId: '13402', criterion: 'Messmittel', note: 'Lehrring fehlt',
    workedH: 0.4, level: 0, phase: 'sofort'
  },
  {
    panelId: 'drehen', machineId: '12768', criterion: 'Qualität', note: 'Rundlauf ausser Toleranz',
    workedH: 2.6 * 17.5, level: 2, phase: 'wirksamkeit',
    containment: '100 % Prüfung eingeführt.',
    whys: ['Spannfutter verschmutzt', 'Reinigung nicht im Rüstablauf'],
    cause: 'Reinigung des Spannfutters fehlt in der Rüstcheckliste.',
    tasks: [{ title: 'Rüstcheckliste ergänzen', owner: 'AVOR / KVP', dueH: -10, done: true }]
  },
  {
    panelId: 'drehen', machineId: '12774', criterion: 'Werkzeug', note: 'Werkzeugbruch Bohrer Ø 6',
    workedH: 1, level: 0, phase: 'sofort', calendar: 'einschicht'
  },
  {
    panelId: 'schleifen', machineId: '13509', criterion: 'Material', note: 'Falsche Charge',
    workedH: 30, level: 1, phase: 'standard', closed: true,
    containment: 'Charge gesperrt.', cause: 'Etikett vertauscht beim Umlagern.',
    lessons: 'Chargen-Scan beim Umlagern ist jetzt Pflicht.'
  }
];

// Erfundene, abgeschlossene Fälle der letzten 6 Monate für "Historie & Auswertung".
// Mehrere Vorlagen wiederholen sich bewusst (gleiche Maschine + Kriterium).
const HISTORY_TEMPLATES = [
  { panelId: 'schleifen', machineId: '13503', criterion: 'Maschine', note: 'Spindel vibriert', cause: 'Scheibe nach Wechsel nicht ausgewuchtet', lessons: 'Auswuchten in Rüstcheckliste', level: 2 },
  { panelId: 'schleifen', machineId: '13503', criterion: 'Qualität', note: 'Rauheit zu hoch', cause: 'Abrichtintervall zu lang', lessons: 'Abrichten nach 20 Teilen', level: 1 },
  { panelId: 'schleifen', machineId: '13704', criterion: 'DISPO', note: 'Rohmaterial fehlt', cause: 'Mindestbestand zu tief', lessons: 'Mindestbestand monatlich prüfen', level: 1 },
  { panelId: 'schleifen', machineId: '13402', criterion: 'Messmittel', note: 'Lehrring fehlt', cause: 'Lehrring nicht zurückgebracht', lessons: 'Ausleihliste im Messraum', level: 0 },
  { panelId: 'schleifen', machineId: '13510', criterion: 'AVOR', note: 'Zeichnung veraltet', cause: 'Revision nicht freigegeben', lessons: 'Freigabe vor Auftragsstart prüfen', level: 1 },
  { panelId: 'drehen', machineId: '12768', criterion: 'Qualität', note: 'Rundlauf ausser Toleranz', cause: 'Spannfutter verschmutzt', lessons: 'Reinigung in Rüstcheckliste', level: 2, failed: true },
  { panelId: 'drehen', machineId: '12766', criterion: 'Maschine', note: 'Hydraulikleck', cause: 'Dichtung verschlissen', lessons: 'Dichtung in Wartungsplan', level: 3 },
  { panelId: 'drehen', machineId: '12774', criterion: 'Werkzeug', note: 'Werkzeugbruch', cause: 'Standzeit überschritten', lessons: 'Standzeitüberwachung aktiviert', level: 0, calendar: 'einschicht' },
  { panelId: 'drehen', machineId: '12769', criterion: 'Personal', note: 'Bediener krank', cause: 'Keine Stellvertretung qualifiziert', lessons: 'Zweiten Bediener anlernen', level: 2 }
];

// Einfacher Zufallsgenerator mit festem Startwert: jede Vorführung zeigt dasselbe
function seededRandom(seed) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function seedHistory(data) {
  const random = seededRandom(42);
  const now = Date.now();
  for (let i = 0; i < 40; i++) {
    const tpl = HISTORY_TEMPLATES[Math.floor(random() * HISTORY_TEMPLATES.length)];
    if (!data[tpl.panelId]) continue;
    // Meldung an einem Werktag um ca. 8–14 Uhr, damit Arbeitszeit anfällt
    const day = new Date(now - Math.floor(5 + random() * 175) * 24 * HOUR);
    while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1);
    day.setUTCHours(7 + Math.floor(random() * 6), Math.floor(random() * 60), 0, 0);
    const created = day.getTime();
    const closed = created + (1 + random() * (tpl.level >= 2 ? 120 : 20)) * HOUR;

    const t = createTicket({
      id: generateActionId(data),
      title: `${tpl.criterion}: ${tpl.note}`,
      panelId: tpl.panelId,
      machineId: tpl.machineId,
      criterion: tpl.criterion,
      note: tpl.note,
      author: 'Beispiel'
    });
    const closedIso = new Date(closed).toISOString();
    t.createdAt = new Date(created).toISOString();
    t.closedAt = closedIso;
    t.status = CLOSED_STATUS;
    t.phase = 'standard';
    t.containment = 'Teile gesperrt, Maschine gesichert.';
    t.whys = [tpl.note, tpl.cause];
    t.cause = tpl.cause;
    t.lessonsLearned = tpl.lessons;
    t.tasks = [{ id: `TSK-H${i}`, title: tpl.lessons, owner: 'AVOR / KVP', due: closedIso.slice(0, 10), status: 'completed', createdAt: t.createdAt, doneAt: closedIso }];
    t.escalationLevel = levelName(tpl.level);
    t.escalation.history = Array.from({ length: tpl.level }, (_, j) => ({ from: j, to: j + 1, reason: 'Zeitbudget überschritten', by: 'Beispiel', at: t.createdAt }));
    t.effectiveness = { result: 'wirksam', note: '', by: 'Beispiel', at: closedIso };
    if (tpl.failed && random() < 0.6) {
      t.history.push({ event: 'effectiveness', user: 'Beispiel', timestamp: t.createdAt, details: 'Nicht wirksam – zurück zur Ursache. Fehler trat erneut auf' });
    }
    data._actions[t.id] = t;
  }
}

export function seedDemoData(data, saveData) {
  if (Object.keys(data._actions).length > 0) return;
  seedHistory(data);

  for (const c of CASES) {
    const panel = data[c.panelId];
    if (!panel) continue;
    const calendarId = c.calendar || 'zweischicht';
    if (c.calendar) panel.machineCalendars = { ...(panel.machineCalendars || {}), [c.machineId]: c.calendar };

    const t = createTicket({
      id: generateActionId(data),
      title: `${c.criterion}: ${c.note}`,
      panelId: c.panelId,
      machineId: c.machineId,
      criterion: c.criterion,
      note: c.note,
      author: 'Beispiel'
    });
    t.createdAt = workingAgo(c.workedH * HOUR, calendarId);
    t.phase = c.phase;
    t.status = phaseLabel(c.phase);
    t.escalationLevel = levelName(c.level);
    t.containment = c.containment || '';
    t.whys = c.whys || [];
    t.cause = c.cause || '';
    t.lessonsLearned = c.lessons || '';
    t.tasks = (c.tasks || []).map((x, i) => ({
      id: `TSK-DEMO${i}${t.id.slice(-2)}`,
      title: x.title,
      owner: x.owner,
      due: new Date(Date.now() + x.dueH * HOUR).toISOString().slice(0, 10),
      status: x.done ? 'completed' : 'open',
      createdAt: t.createdAt,
      doneAt: x.done ? new Date().toISOString() : null
    }));
    if (c.closed) {
      t.status = CLOSED_STATUS;
      t.closedAt = new Date().toISOString();
      t.effectiveness = { result: 'wirksam', note: '', by: 'Beispiel', at: t.closedAt };
    } else {
      panel.cells[`${c.machineId}-${c.criterion}`] = { status: 'red', notes: [] };
    }
    data._actions[t.id] = t;
  }
  saveData(data);
  console.log('Beispieldaten für die Vorführung angelegt.');
}
