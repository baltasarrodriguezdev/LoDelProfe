import test from 'node:test';
import assert from 'node:assert/strict';
import { hasBookingOverlap, isSupportedDuration, rangesOverlap } from '../src/domain/booking-rules.js';

const at = (hour: number, minute = 0) => new Date(Date.UTC(2030, 0, 2, hour, minute));
const range = (startHour: number, startMinute: number, endHour: number, endMinute: number) => ({
  start: at(startHour, startMinute), end: at(endHour, endMinute)
});

const occupied = range(20, 30, 22, 0);

test('detecta superposición cuando el turno empieza dentro de uno ocupado', () => {
  assert.equal(rangesOverlap(range(21, 0, 22, 0), occupied), true);
  assert.equal(rangesOverlap(range(21, 30, 22, 30), occupied), true);
});

test('detecta superposición cuando el turno contiene al ocupado', () => {
  assert.equal(rangesOverlap(range(20, 0, 22, 30), occupied), true);
});

test('permite un turno que comienza exactamente cuando termina el anterior', () => {
  assert.equal(rangesOverlap(range(22, 0, 23, 0), occupied), false);
});

test('permite un turno que termina exactamente cuando comienza el siguiente', () => {
  assert.equal(rangesOverlap(range(19, 30, 20, 30), occupied), false);
});

test('valida superposición para duraciones de 60, 90 y 120 minutos', () => {
  for (const duration of [60, 90, 120]) {
    const start = at(21, 0);
    const candidate = { start, end: new Date(start.getTime() + duration * 60_000) };
    assert.equal(hasBookingOverlap(candidate, [occupied]), true, `debe rechazar ${duration} minutos`);
  }
});

test('considera libre las 22:00 después de un turno 20:30 a 22:00', () => {
  for (const duration of [60, 90, 120]) {
    const start = at(22, 0);
    const candidate = { start, end: new Date(start.getTime() + duration * 60_000) };
    assert.equal(hasBookingOverlap(candidate, [occupied]), false, `debe permitir ${duration} minutos`);
  }
});

test('solo acepta las duraciones comerciales configuradas', () => {
  assert.equal(isSupportedDuration(60), true);
  assert.equal(isSupportedDuration(90), true);
  assert.equal(isSupportedDuration(120), true);
  assert.equal(isSupportedDuration(30), false);
  assert.equal(isSupportedDuration(75), false);
});