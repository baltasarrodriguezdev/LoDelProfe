import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { publishRealtimeEvent } from '../src/realtime/events.js';
import { attachRealtimeServer } from '../src/realtime/server.js';

const httpServer = createServer(app);
attachRealtimeServer(httpServer);

let baseUrl = '';
const sockets: WebSocket[] = [];
const inbox = new Map<WebSocket, any[]>();

const token = (userId: number, role: 'CLIENT' | 'ADMIN' | 'SUPERADMIN') =>
  jwt.sign({ userId, role }, config.jwtSecret, { expiresIn: '5m' });

async function connect(userId?: number, role: 'CLIENT' | 'ADMIN' | 'SUPERADMIN' = 'CLIENT') {
  const headers = userId ? { Cookie: `${config.authCookieName}=${token(userId, role)}` } : undefined;
  const socket = new WebSocket(`${baseUrl}/api/realtime`, { origin: 'http://localhost:4200', headers });
  sockets.push(socket);
  inbox.set(socket, []);
  const connected = new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket no conectó')), 2_000);
    socket.on('message', raw => {
      const message = JSON.parse(String(raw));
      if (message.type === 'REALTIME_CONNECTED') {
        clearTimeout(timeout);
        resolve(message);
      } else if (message.type !== 'PONG') inbox.get(socket)!.push(message);
    });
    socket.once('error', reject);
  });
  return { socket, connected: await connected };
}

const delay = (milliseconds = 80) => new Promise(resolve => setTimeout(resolve, milliseconds));

before(async () => {
  await new Promise<void>(resolve => {
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address();
      if (!address || typeof address === 'string') throw new Error('No se pudo iniciar realtime');
      baseUrl = `ws://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  for (const socket of sockets) socket.close();
  await new Promise<void>(resolve => httpServer.close(() => resolve()));
});

test('los canales se asignan por la sesión y nunca por una suscripción del cliente', async () => {
  const guest = await connect();
  const user = await connect(11, 'CLIENT');
  const admin = await connect(99, 'ADMIN');

  assert.deepEqual(guest.connected.channels, ['availability']);
  assert.deepEqual(user.connected.channels, ['availability', 'private']);
  assert.deepEqual(admin.connected.channels, ['availability', 'private', 'admin']);

  user.socket.send(JSON.stringify({ type: 'SUBSCRIBE', channel: 'admin' }));
  await publishRealtimeEvent({ audience: 'ADMIN', type: 'CASH_MOVEMENT_CREATED', resource: { resource: 'CASH' } });
  await delay();

  assert.equal(inbox.get(user.socket)!.length, 0);
  assert.equal(inbox.get(guest.socket)!.length, 0);
  assert.equal(inbox.get(admin.socket)!.at(-1)?.type, 'CASH_MOVEMENT_CREATED');
});

test('un usuario no recibe eventos privados de otro y el payload no filtra metadatos de ruteo', async () => {
  const first = await connect(21, 'CLIENT');
  const second = await connect(22, 'CLIENT');
  await publishRealtimeEvent({
    audience: 'USER',
    targetUserId: 21,
    type: 'BOOKING_CANCELLED',
    resource: { bookingId: 7, courtId: 1, date: '2030-01-02', status: 'CANCELLED' }
  });
  await delay();

  const received = inbox.get(first.socket)!.at(-1);
  assert.equal(received.type, 'BOOKING_CANCELLED');
  assert.equal(received.resource.bookingId, 7);
  assert.equal(received.audience, undefined);
  assert.equal(received.targetUserId, undefined);
  assert.equal(inbox.get(second.socket)!.length, 0);
});

test('la disponibilidad pública llega a todos los navegadores conectados', async () => {
  const first = await connect(31, 'CLIENT');
  const second = await connect(32, 'CLIENT');
  const admin = await connect(100, 'SUPERADMIN');
  const event = await publishRealtimeEvent({
    audience: 'PUBLIC',
    type: 'AVAILABILITY_CHANGED',
    resource: { courtId: 1, date: '2030-01-02' }
  });
  await delay();

  assert.equal(inbox.get(first.socket)!.at(-1)?.id, event.id);
  assert.equal(inbox.get(second.socket)!.at(-1)?.id, event.id);
  assert.equal(inbox.get(admin.socket)!.at(-1)?.id, event.id);
});

test('GET /api/realtime informa que se requiere upgrade sin responder 500', async () => {
  const response = await fetch(`${baseUrl.replace('ws://', 'http://')}/api/realtime`);
  assert.equal(response.status, 426);
  assert.equal(response.headers.get('upgrade'), 'websocket');
  assert.match((await response.json() as { message: string }).message, /WebSocket/i);
});
