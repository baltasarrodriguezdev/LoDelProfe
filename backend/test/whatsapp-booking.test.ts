import test from 'node:test';
import assert from 'node:assert/strict';
import * as helperModule from '../../frontend/src/app/shared/whatsapp-booking.js';

// El frontend se carga como CommonJS fuera del compilador de Angular.
const { buildPhoneVerificationWhatsappMessage, buildPhoneVerificationWhatsappUrl } =
  (helperModule as { default?: typeof helperModule }).default ?? helperModule;

const request = {
  firstName: '  Ana ',
  lastName: ' Perez  ',
  formattedDate: 'Martes 7 de julio',
  startTime: '20:30',
  endTime: '22:00',
  durationLabel: '1h 30m',
  playersCount: 4,
  formattedPrice: '$ 20.000',
  registeredPhone: '3576123456'
};

test('arma el mensaje de WhatsApp para validar telefono y primer turno', () => {
  const message = buildPhoneVerificationWhatsappMessage(request);
  assert.match(message, /Hola, soy Ana Perez\. Quiero validar mi cuenta y solicitar mi primer turno en Lo del Profe\./);
  assert.match(message, /Datos del turno:/);
  assert.match(message, /Día: Martes 7 de julio/);
  assert.match(message, /Horario: 20:30 a 22:00/);
  assert.match(message, /Duración: 1h 30m/);
  assert.match(message, /Jugadores: 4/);
  assert.match(message, /Precio: \$ 20\.000/);
  assert.match(message, /Teléfono registrado: 3576123456/);
  assert.match(message, /Quedo atento\/a a la confirmación/);
  assert.doesNotMatch(message, /Hola, quiero reservar un turno/i);
});

test('codifica el mensaje completo en una URL valida de WhatsApp', () => {
  const url = buildPhoneVerificationWhatsappUrl('+54 9 3576 468131', request);
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://wa.me');
  assert.equal(parsed.pathname, '/5493576468131');
  assert.equal(parsed.searchParams.get('text'), buildPhoneVerificationWhatsappMessage(request));
  assert.match(url, /%0A/);
  assert.doesNotMatch(url, /Ana Perez/);
});
