// Tests für Schicht-Punkte (Personal bei Zweischicht-Maschinen). Ausführen mit: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSplitCell, applyShiftStatus } from '../services/shiftCells.js';

const panel = { machineCalendars: { A: 'zweischicht', B: 'einschicht' } };

test('Nur Personal bei Zweischicht-Maschinen wird geteilt', () => {
  assert.equal(isSplitCell(panel, 'A', 'Personal'), true);
  assert.equal(isSplitCell(panel, 'B', 'Personal'), false);
  assert.equal(isSplitCell(panel, 'A', 'Qualität'), false);
  assert.equal(isSplitCell(panel, 'C', 'Personal'), true); // ohne Eintrag gilt der Standard Zweischicht
});

test('Eine fehlende Schicht macht die Zelle rot, grau bleibt erhalten', () => {
  const cell = { status: 'green', notes: [] };
  applyShiftStatus(cell, 'spaet', 'off');
  assert.equal(cell.status, 'green');
  applyShiftStatus(cell, 'frueh', 'red');
  assert.deepEqual(cell.shifts, { frueh: 'red', spaet: 'off' });
  assert.equal(cell.status, 'red');
  applyShiftStatus(cell, 'frueh', 'green');
  assert.equal(cell.status, 'green');
  assert.equal(cell.shifts.spaet, 'off');
});

test('Alte rote Zelle ohne Schichtangabe: beide Schichten gelten als rot', () => {
  const cell = { status: 'red', notes: [] };
  applyShiftStatus(cell, 'frueh', 'green'); // Frühschicht ist wieder da
  assert.deepEqual(cell.shifts, { frueh: 'green', spaet: 'red' });
  assert.equal(cell.status, 'red');
});
