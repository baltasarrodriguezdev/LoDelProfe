import test from 'node:test';
import assert from 'node:assert/strict';
import { businessIntervals } from '../src/utils/time.js';
import { canTransitionBookingStatus } from '../src/services/booking.service.js';

test('los descansos configurados dividen el horario sin depender de un día especial', () => {
  const intervals = businessIntervals('2030-01-03', '09:00', '00:00', '13:00', '15:00');
  assert.equal(intervals.length, 2);
  assert.equal(intervals[0].open.toFormat('HH:mm'), '09:00');
  assert.equal(intervals[0].close.toFormat('HH:mm'), '13:00');
  assert.equal(intervals[1].open.toFormat('HH:mm'), '15:00');
  assert.equal(intervals[1].close.toFormat('HH:mm'), '00:00');
});

test('la máquina de estados permite sólo transiciones operativas válidas', () => {
  assert.equal(canTransitionBookingStatus('PENDING', 'CONFIRMED'), true);
  assert.equal(canTransitionBookingStatus('CONFIRMED', 'PLAYED'), true);
  assert.equal(canTransitionBookingStatus('BLOCKED', 'CANCELLED'), true);
  assert.equal(canTransitionBookingStatus('PLAYED', 'CANCELLED'), false);
  assert.equal(canTransitionBookingStatus('NO_SHOW', 'CONFIRMED'), false);
});
