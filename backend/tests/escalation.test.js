// Tests für Eskalationsvorschläge und Ticket-Ablauf. Ausführen mit: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEscalation, levelIndex } from '../services/escalation.js';
import { createTicket, upgradeTicket, advancePhase, recordEffectiveness, changeLevel, dismissSuggestion } from '../services/actionService.js';

const H = 3600 * 1000;
const ch = (iso) => Date.parse(`${iso}+01:00`);

function ticketAt(iso) {
  const t = createTicket({ id: 'ACT-T', title: 'Test', panelId: 'p', machineId: 'm', criterion: 'Maschine' });
  t.createdAt = new Date(ch(iso)).toISOString();
  return t;
}

test('Alte Stufennamen werden richtig zugeordnet', () => {
  assert.equal(levelIndex('Shopfloor (Lvl 1)'), 0);
  assert.equal(levelIndex('Schichtleitung (Lvl 2)'), 1);
  assert.equal(levelIndex('Produktionsleitung (Lvl 3)'), 3);
  assert.equal(levelIndex('Werksleitung (Lvl 4)'), 4);
  assert.equal(levelIndex(undefined), 0);
});

test('Unter 2 h: kein Vorschlag', () => {
  const t = ticketAt('2026-11-26T08:00');
  const e = evaluateEscalation(t, 'einschicht', ch('2026-11-26T09:30'));
  assert.equal(e.suggestedLevel, null);
  assert.equal(e.state, 'warn'); // 1,5 h von 2 h
});

test('Nach 2 h Arbeitszeit: Gruppenleiter wird vorgeschlagen', () => {
  const t = ticketAt('2026-11-26T08:00');
  const e = evaluateEscalation(t, 'einschicht', ch('2026-11-26T10:30'));
  assert.equal(e.suggestedLevel, 1);
  assert.equal(e.state, 'due');
});

test('Nach 2 Arbeitstagen ist Produktionsleiter fällig', () => {
  const t = ticketAt('2026-11-23T07:00'); // Montag
  const e = evaluateEscalation(t, 'einschicht', ch('2026-11-25T07:30'));
  assert.equal(e.dueLevel, 3);
  assert.equal(e.suggestedLevel, 1); // es wird immer nur eine Stufe weiter vorgeschlagen
});

test('Begründet abgelehnt: Vorschlag ruht bis zur nächsten fälligen Stufe', () => {
  const t = ticketAt('2026-11-26T08:00');
  const now = ch('2026-11-26T10:30');
  assert.equal(dismissSuggestion(t, { reason: 'Ersatzteil kommt um 11 Uhr', dueLevel: 1 }), null);
  assert.equal(evaluateEscalation(t, 'einschicht', now).suggestedLevel, null);
  // 6 h später ist Inselleiter fällig → Vorschlag kommt wieder
  assert.equal(evaluateEscalation(t, 'einschicht', ch('2026-11-26T14:30')).suggestedLevel, 1);
});

test('Eskalieren braucht eine Begründung', () => {
  const t = ticketAt('2026-11-26T08:00');
  assert.ok(changeLevel(t, { direction: 'up', reason: '' }));
  assert.equal(changeLevel(t, { direction: 'up', reason: 'Ersatzteil fehlt' }), null);
  assert.equal(t.escalationLevel, 'Gruppenleiter (Lvl 2)');
  assert.ok(changeLevel(t, { direction: 'down', reason: 'x' }) === null);
  assert.ok(changeLevel(t, { direction: 'down', reason: 'x' })); // unter Lvl 1 geht nicht
});

test('Phasen: weiter nur mit Inhalt, "nicht wirksam" führt zurück zur Ursache', () => {
  const t = ticketAt('2026-11-26T08:00');
  assert.ok(advancePhase(t)); // Sofortmassnahme fehlt
  t.containment = 'Maschine gestoppt';
  assert.equal(advancePhase(t), null);
  assert.equal(t.phase, 'ursache');
  t.cause = 'Unwucht';
  advancePhase(t);
  assert.ok(advancePhase(t)); // keine Massnahme
  t.tasks.push({ id: '1', title: 'Auswuchten', status: 'completed' });
  advancePhase(t);
  assert.equal(t.phase, 'wirksamkeit');
  recordEffectiveness(t, { result: 'nicht_wirksam', note: 'vibriert weiter' });
  assert.equal(t.phase, 'ursache');
});

test('Ticket aus Version 1 wird ergänzt, ohne Inhalte zu verlieren', () => {
  const old = {
    id: 'ACT-000001', status: 'Massnahmen', priority: 'normal', title: 'Maschine: Leck',
    source: { panelId: 'schleifen', machineId: '13503', criterion: 'Maschine' },
    createdAt: '2026-11-18T08:00:00.000Z', escalationLevel: 'Schichtleitung (Lvl 2)',
    tasks: [{ id: 'TSK-1', title: 'Dichtung', owner: 'Instandhaltung', status: 'open' }],
    cause: '', lessonsLearned: ''
  };
  const t = upgradeTicket(structuredClone(old));
  assert.equal(t.phase, 'massnahme');
  assert.equal(t.escalationLevel, 'Gruppenleiter (Lvl 2)');
  assert.equal(t.machineId, '13503');
  assert.equal(t.tasks[0].title, 'Dichtung');
  assert.equal(t.priority, 'normal'); // unbekannte Felder bleiben erhalten
});
