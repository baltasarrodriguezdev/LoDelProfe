import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/prisma/client.js';
import {
  buildBookingNotification,
  buildPendingUserNotification
} from '../src/services/push-notification.service.js';

const db = prisma as any;
const server = createServer(app);
let baseUrl = '';

const token = (userId: number, role: 'CLIENT' | 'ADMIN' | 'SUPERADMIN') =>
  jwt.sign({ userId, role }, config.jwtSecret, { expiresIn: '5m' });

const headers = (userId: number, role: 'CLIENT' | 'ADMIN' | 'SUPERADMIN') => ({
  authorization: `Bearer ${token(userId, role)}`,
  'content-type': 'application/json'
});

before(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de prueba');
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  }));
});

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

test('las rutas push requieren una sesión administrativa', async () => {
  const guest = await fetch(`${baseUrl}/api/admin/push/public-key`);
  const client = await fetch(`${baseUrl}/api/admin/push/public-key`, { headers: headers(3, 'CLIENT') });
  assert.equal(guest.status, 401);
  assert.equal(client.status, 403);
});

test('informa claramente cuando faltan las claves VAPID', async () => {
  const previous = { ...config.webPush };
  Object.assign(config.webPush, { enabled: false, publicKey: '', privateKey: '', subject: '' });
  const response = await fetch(`${baseUrl}/api/admin/push/public-key`, { headers: headers(7, 'ADMIN') });
  assert.equal(response.status, 503);
  assert.match((await response.json() as { message: string }).message, /no est.n configuradas/i);
  Object.assign(config.webPush, previous);
});

test('un administrador registra y elimina únicamente su dispositivo', async () => {
  const previous = { ...config.webPush };
  Object.assign(config.webPush, {
    enabled: true,
    publicKey: 'public-test-key',
    privateKey: 'private-test-key',
    subject: 'mailto:test@example.com'
  });
  let upsert: any;
  let removal: any;
  db.pushSubscription.upsert = async (input: any) => {
    upsert = input;
    return { id: 91, createdAt: new Date(), updatedAt: new Date() };
  };
  db.pushSubscription.deleteMany = async (input: any) => {
    removal = input;
    return { count: 1 };
  };

  const subscription = {
    endpoint: 'https://push.example.test/device-123',
    expirationTime: null,
    keys: { p256dh: 'public-device-key', auth: 'auth-device-key' }
  };
  const created = await fetch(`${baseUrl}/api/admin/push/subscriptions`, {
    method: 'POST',
    headers: headers(12, 'SUPERADMIN'),
    body: JSON.stringify(subscription)
  });
  assert.equal(created.status, 201);
  assert.equal(upsert.create.userId, 12);
  assert.equal(upsert.create.endpoint, subscription.endpoint);
  assert.match(upsert.create.endpointHash, /^[a-f0-9]{64}$/);

  const deleted = await fetch(`${baseUrl}/api/admin/push/subscriptions`, {
    method: 'DELETE',
    headers: headers(12, 'SUPERADMIN'),
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });
  assert.equal(deleted.status, 204);
  assert.equal(removal.where.userId, 12);
  assert.equal(removal.where.endpointHash, upsert.create.endpointHash);
  Object.assign(config.webPush, previous);
});

test('construye avisos accionables sin exponer datos sensibles', () => {
  const booking = buildBookingNotification('BOOKING_CREATED', {
    id: 44,
    clientName: 'Juan Pérez',
    startTime: new Date('2030-01-15T23:00:00.000Z'),
    endTime: new Date('2030-01-16T00:30:00.000Z'),
    status: 'CONFIRMED'
  });
  assert.equal(booking.title, 'Nuevo turno reservado');
  assert.match(booking.body, /Juan Pérez/);
  assert.match(booking.body, /20:00 a 21:30/);
  assert.equal(booking.url, '/admin?date=2030-01-15&booking=44');

  const pendingUser = buildPendingUserNotification({ id: 8, firstName: 'Ana', lastName: 'Gómez' });
  assert.equal(pendingUser.title, 'Nuevo usuario pendiente');
  assert.equal(pendingUser.url, '/admin/seguridad');
  assert.doesNotMatch(pendingUser.body, /teléfono|contraseña|código/i);
});
