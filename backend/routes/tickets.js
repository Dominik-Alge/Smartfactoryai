// =========================================================================
// ACTION ENGINE API – alle Routen rund um Tickets, Eskalation und Kalender
// -------------------------------------------------------------------------
// Jede Route, die ein Ticket ändert, antwortet mit dem aktualisierten
// Ticket inklusive berechneter Eskalationslage (Feld "escalationInfo").
// Fehler, die der Benutzer beheben kann, kommen als 400 mit Klartext.
// =========================================================================

import { Router } from 'express';
import { loadData, saveData, getPanelKeys } from '../services/storage.js';
import {
  advancePhase,
  backPhase,
  recordEffectiveness,
  changeLevel,
  dismissSuggestion,
  addHistory
} from '../services/actionService.js';
import { evaluateEscalation, levelIndex } from '../services/escalation.js';
import { resolveCalendarId, holidaysOf } from '../services/shiftCalendar.js';
import { sendEscalationMail, getOutbox, mailEnabled } from '../services/emailService.js';
import { ESCALATION_LEVELS } from '../config/escalation.js';
import { criterionContacts } from '../config/notifications.js';
import { PHASES, TASK_OWNERS } from '../config/actionFlow.js';
import { SHIFT_CALENDARS, DEFAULT_CALENDAR, COMPANY_HOLIDAYS } from '../config/calendar.js';

const router = Router();

// --- Hilfsfunktionen ----------------------------------------------------------

function calendarOf(data, ticket) {
  const panel = data[ticket.panelId];
  return resolveCalendarId(panel?.machineCalendars?.[ticket.machineId]);
}

// Wer muss jetzt handeln? 1. Verantwortliche offener Massnahmen,
// 2. zuständiger Bereich des Kriteriums, 3. Person der aktuellen Stufe.
function responsibleOf(ticket, info) {
  const owners = [...new Set(ticket.tasks.filter((t) => t.status !== 'completed').map((t) => t.owner))];
  if (owners.length) return owners.join(', ');
  const area = criterionContacts[ticket.criterion]?.label;
  return area || ESCALATION_LEVELS[info.currentLevel].short;
}

function withInfo(data, ticket) {
  const calendarId = calendarOf(data, ticket);
  const escalationInfo = evaluateEscalation(ticket, calendarId);
  return { ...ticket, calendarId, escalationInfo, responsible: responsibleOf(ticket, escalationInfo) };
}

// Lädt das Ticket, führt die Änderung aus, speichert und antwortet.
// "change" gibt bei einem Problem einen Text zurück, sonst nichts.
function updateTicket(req, res, change) {
  const data = loadData();
  const ticket = data._actions[req.params.id];
  if (!ticket) return res.status(404).json({ error: 'Ticket nicht gefunden.' });

  const problem = change(ticket, data);
  if (problem) return res.status(400).json({ error: problem });

  saveData(data);
  res.json(withInfo(data, ticket));
}

const authorOf = (req) => (req.body?.author || '').trim() || 'Unbekannt';

// --- Konfiguration --------------------------------------------------------------

router.get('/action-config', (req, res) => {
  const year = new Date().getFullYear();
  const holidays = [year, year + 1].flatMap((y) =>
    [...holidaysOf(y)].map(([date, label]) => ({ date, label }))
  ).sort((a, b) => a.date.localeCompare(b.date));
  res.json({
    levels: ESCALATION_LEVELS,
    phases: PHASES,
    owners: TASK_OWNERS,
    calendars: SHIFT_CALENDARS,
    defaultCalendar: DEFAULT_CALENDAR,
    holidays,
    companyHolidays: COMPANY_HOLIDAYS
  });
});

// --- Tickets lesen ----------------------------------------------------------------

router.get('/tickets', (req, res) => {
  const data = loadData();
  res.json(Object.values(data._actions).map((t) => withInfo(data, t)));
});

// --- Inhalte bearbeiten -------------------------------------------------------------

const EDITABLE_FIELDS = ['title', 'containment', 'cause', 'lessonsLearned'];

router.patch('/ticket/:id', (req, res) =>
  updateTicket(req, res, (t) => {
    if (t.closedAt) return 'Geschlossene Tickets können nicht mehr bearbeitet werden.';
    const changed = [];
    for (const field of EDITABLE_FIELDS) {
      if (typeof req.body[field] === 'string' && req.body[field] !== t[field]) {
        t[field] = req.body[field];
        changed.push(field);
      }
    }
    if (Array.isArray(req.body.whys)) {
      t.whys = req.body.whys.map((w) => String(w)).slice(0, 10);
      changed.push('whys');
    }
    if (changed.length) addHistory(t, 'edited', authorOf(req), `Bearbeitet: ${changed.join(', ')}`);
  })
);

// --- Phasen -------------------------------------------------------------------------------

router.post('/ticket/:id/phase', (req, res) =>
  updateTicket(req, res, (t) =>
    req.body.direction === 'back' ? backPhase(t, authorOf(req)) : advancePhase(t, authorOf(req))
  )
);

router.post('/ticket/:id/effectiveness', (req, res) =>
  updateTicket(req, res, (t) =>
    recordEffectiveness(t, { result: req.body.result, note: req.body.note, author: authorOf(req) })
  )
);

// --- Tasks (Abstellmassnahmen) ----------------------------------------------------------------

router.post('/ticket/:id/task', (req, res) =>
  updateTicket(req, res, (t) => {
    const title = (req.body.title || '').trim();
    if (!title) return 'Bitte die Massnahme beschreiben.';
    const task = {
      id: `TSK-${Date.now().toString(36).toUpperCase()}`,
      title,
      owner: req.body.owner || TASK_OWNERS[0],
      due: req.body.due || null,
      status: 'open',
      createdAt: new Date().toISOString(),
      doneAt: null
    };
    t.tasks.push(task);
    addHistory(t, 'task_added', authorOf(req), `${task.title} → ${task.owner}`);
  })
);

router.post('/ticket/:id/task/:taskId/toggle', (req, res) =>
  updateTicket(req, res, (t) => {
    const task = t.tasks.find((x) => x.id === req.params.taskId);
    if (!task) return 'Massnahme nicht gefunden.';
    task.status = task.status === 'completed' ? 'open' : 'completed';
    task.doneAt = task.status === 'completed' ? new Date().toISOString() : null;
    addHistory(t, 'task_toggled', authorOf(req), `${task.title}: ${task.status === 'completed' ? 'erledigt' : 'wieder offen'}`);
  })
);

router.delete('/ticket/:id/task/:taskId', (req, res) =>
  updateTicket(req, res, (t) => {
    const task = t.tasks.find((x) => x.id === req.params.taskId);
    if (!task) return 'Massnahme nicht gefunden.';
    t.tasks = t.tasks.filter((x) => x.id !== task.id);
    addHistory(t, 'task_removed', authorOf(req), task.title);
  })
);

// --- Eskalation -------------------------------------------------------------------------------

router.post('/ticket/:id/escalate', (req, res) =>
  updateTicket(req, res, (t) => {
    const problem = changeLevel(t, { direction: 'up', reason: req.body.reason, author: authorOf(req) });
    if (!problem) sendEscalationMail(t, levelIndex(t.escalationLevel), req.body.reason, authorOf(req));
    return problem;
  })
);

router.post('/ticket/:id/de-escalate', (req, res) =>
  updateTicket(req, res, (t) =>
    changeLevel(t, { direction: 'down', reason: req.body.reason, author: authorOf(req) })
  )
);

router.post('/ticket/:id/escalation/dismiss', (req, res) =>
  updateTicket(req, res, (t, data) => {
    const { dueLevel } = evaluateEscalation(t, calendarOf(data, t));
    return dismissSuggestion(t, { reason: req.body.reason, dueLevel, author: authorOf(req) });
  })
);

// --- Postausgang (Vorschau aller Mails, auch wenn der Versand aus ist) ------------

router.get('/outbox', (req, res) => {
  res.json({ enabled: mailEnabled(), mails: getOutbox() });
});

// --- Maschinen-Kalender -----------------------------------------------------------------------

router.get('/calendars', (req, res) => {
  const data = loadData();
  res.json(
    getPanelKeys(data).map((key) => ({
      panelId: key,
      name: data[key].name,
      machines: (data[key].machines || []).map((m) => ({
        machineId: m,
        calendarId: resolveCalendarId(data[key].machineCalendars?.[m])
      }))
    }))
  );
});

router.put('/panel/:id/machine-calendar', (req, res) => {
  const data = loadData();
  const panel = data[req.params.id];
  const { machineId, calendarId } = req.body;
  if (!panel || !panel.machines?.includes(machineId)) return res.status(404).json({ error: 'Maschine nicht gefunden.' });
  if (!SHIFT_CALENDARS[calendarId]) return res.status(400).json({ error: 'Unbekannter Kalender.' });

  panel.machineCalendars = { ...(panel.machineCalendars || {}), [machineId]: calendarId };
  saveData(data);
  res.json({ success: true });
});

export default router;
