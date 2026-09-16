import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedBookingConfirmAction } from '../src/domain/league-rules.js';

const minute = 60_000;
const now = new Date('2026-09-16T20:00:00.000Z');

test('marca el turno como jugado cuando estaba confirmado y el partido ya empezó', () => {
  const action = linkedBookingConfirmAction({ status: 'CONFIRMED', startTime: new Date(now.getTime() - 60 * minute) }, now);
  assert.deepEqual(action, { allowed: true, markPlayed: true, reason: null });
});

test('permite confirmar sin jugar cuando un pendiente ya venció su horario', () => {
  const action = linkedBookingConfirmAction({ status: 'PENDING', startTime: new Date(now.getTime() - 30 * minute) }, now);
  assert.equal(action.allowed, true);
  assert.equal(action.markPlayed, true);
});

test('rechaza confirmar con un turno vinculado cancelado, bloqueado o ausente', () => {
  for (const status of ['CANCELLED', 'BLOCKED', 'NO_SHOW']) {
    const action = linkedBookingConfirmAction({ status, startTime: new Date(now.getTime() - 60 * minute) }, now);
    assert.equal(action.allowed, false, status);
    assert.equal(action.markPlayed, false);
    assert.match(action.reason!, /no se puede confirmar/i);
  }
});

test('rechaza confirmar antes de que arranque el turno confirmado', () => {
  const action = linkedBookingConfirmAction({ status: 'CONFIRMED', startTime: new Date(now.getTime() + 60 * minute) }, now);
  assert.equal(action.allowed, false);
  assert.match(action.reason!, /todavía no empezó/i);
});