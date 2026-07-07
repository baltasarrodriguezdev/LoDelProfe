import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsappBookingMessage, buildWhatsappBookingUrl } from '../../frontend/src/app/shared/whatsapp-booking.js';

const request = {
  firstName: '  Ana ', lastName: ' Pérez  ', formattedDate: 'Martes 7 de julio',
  startTime: '20:30', endTime: '22:00', durationLabel: '1h 30m', formattedPrice: '$ 20.000'
};

test('arma el mensaje de WhatsApp con todos los datos del turno', () => {
  const message = buildWhatsappBookingMessage(request);
  assert.match(message, /Nombre: Ana Pérez/);
  assert.match(message, /Día: Martes 7 de julio/);
  assert.match(message, /Horario: 20:30 a 22:00/);
  assert.match(message, /Duración: 1h 30m/);
  assert.match(message, /Precio: \$ 20\.000/);
  assert.match(message, /Quedo atento\/a a la confirmación/);
});

test('codifica el mensaje completo en una URL válida de WhatsApp', () => {
  const url = buildWhatsappBookingUrl('5493576468131', request);
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://wa.me');
  assert.equal(parsed.pathname, '/5493576468131');
  assert.equal(parsed.searchParams.get('text'), buildWhatsappBookingMessage(request));
  assert.match(url, /%0A/);
  assert.doesNotMatch(url, /Ana Pérez/);
});