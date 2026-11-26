// Tests für den Schichtkalender. Ausführen mit: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workingMsBetween, reachWorkingMs, easterSunday, holidaysOf, dayLengthMs } from '../services/shiftCalendar.js';

const H = 3600 * 1000;
// Hilfsfunktion: Schweizer Ortszeit als Zeitpunkt (Winter = UTC+1, Sommer = UTC+2)
const ch = (iso, offset = '+01:00') => Date.parse(`${iso}${offset}`);

test('Ostersonntag wird richtig berechnet', () => {
  assert.deepEqual(easterSunday(2026), { year: 2026, month: 4, day: 5 });
  assert.deepEqual(easterSunday(2027), { year: 2027, month: 3, day: 28 });
});

test('Thurgauer Feiertage 2026 enthalten bewegliche Tage', () => {
  const h = holidaysOf(2026);
  assert.equal(h.get('2026-04-03'), 'Karfreitag');
  assert.equal(h.get('2026-05-14'), 'Auffahrt');
  assert.equal(h.get('2026-05-25'), 'Pfingstmontag');
});

test('Tageslänge: Einschicht 10 h, Zweischicht 17,5 h', () => {
  assert.equal(dayLengthMs('einschicht'), 10 * H);
  assert.equal(dayLengthMs('zweischicht'), 17.5 * H);
  assert.equal(dayLengthMs('gibt-es-nicht'), 17.5 * H); // Standardkalender
});

test('Zeit innerhalb eines Arbeitstags zählt voll', () => {
  // Do 26.11.2026, 08:00–10:30
  assert.equal(workingMsBetween(ch('2026-11-26T08:00'), ch('2026-11-26T10:30'), 'einschicht'), 2.5 * H);
});

test('Nacht zählt nicht: Einschicht 16:00 → nächster Tag 08:00 = 2 h', () => {
  assert.equal(workingMsBetween(ch('2026-11-26T16:00'), ch('2026-11-27T08:00'), 'einschicht'), 2 * H);
});

test('Zweischicht: 22:00 → 06:00 = 0,5 h + 1 h', () => {
  assert.equal(workingMsBetween(ch('2026-11-26T22:00'), ch('2026-11-27T06:00'), 'zweischicht'), 1.5 * H);
});

test('Wochenende zählt nicht: Fr 16:00 → Mo 08:00 = 2 h', () => {
  assert.equal(workingMsBetween(ch('2026-11-27T16:00'), ch('2026-11-30T08:00'), 'einschicht'), 2 * H);
});

test('Feiertag zählt nicht: Do vor Auffahrt 16:00 → Fr 08:00 = 2 h', () => {
  // Auffahrt 2026 = Do 14.05.; Mi 13.05. 16:00 → Fr 15.05. 08:00 (Sommerzeit)
  const from = ch('2026-05-13T16:00', '+02:00');
  const to = ch('2026-05-15T08:00', '+02:00');
  assert.equal(workingMsBetween(from, to, 'einschicht'), 2 * H);
});

test('Umstellung auf Sommerzeit verfälscht nichts', () => {
  // Fr 27.03.2026 07:00 (Winter) → Mo 30.03.2026 07:00 (Sommer) = 1 Arbeitstag
  const from = ch('2026-03-27T07:00', '+01:00');
  const to = ch('2026-03-30T07:00', '+02:00');
  assert.equal(workingMsBetween(from, to, 'einschicht'), 10 * H);
});

test('reachWorkingMs ist die Umkehrung von workingMsBetween', () => {
  const from = ch('2026-11-26T15:00');
  const at = reachWorkingMs(from, 4 * H, 'einschicht');
  assert.equal(at, ch('2026-11-27T09:00')); // 2 h Do + 2 h Fr
  assert.equal(workingMsBetween(from, at, 'einschicht'), 4 * H);
});
