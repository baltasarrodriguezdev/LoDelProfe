import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/prisma/client.js';

const db = prisma as any;
let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let created: any[] = [];
let queriedWhere: any = null;

const token = (userId: number, role: 'CLIENT' | 'ADMIN' | 'SUPERADMIN' = 'CLIENT') =>
  jwt.sign({ userId, role }, config.jwtSecret);
const headers = (value?: string) => ({ 'content-type': 'application/json', ...(value ? { authorization: `Bearer ${value}` } : {}) });
const futureDate = '2030-01-02';

function transactionClient(existing: { startTime: Date; endTime: Date }[] = []) {
  return {
    court: { findFirst: async () => ({ id: 1, active: true }) },
    price: { findFirst: async ({ where }: any) => [60, 90, 120].includes(where.durationMinutes) ? ({ price: where.durationMinutes === 90 ? 20000 : 16000 }) : null },
    businessHour: { findUnique: async () => ({ active: true, openTime: '15:00', closeTime: '00:00' }) },
    booking: {
      findMany: async () => existing,
      create: async ({ data }: any) => { const row = { id: created.length + 1, ...data }; created.push(row); return row; },
      update: async ({ where, data }: any) => ({ id: where.id, ...data })
    },
    cashMovement: { findFirst: async () => null, create: async ({ data }: any) => data }
  };
}

before(async () => {
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de test');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

beforeEach(() => {
  created = [];
  queriedWhere = null;
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Valentino', lastName: 'Rodríguez', phone: '3576000000', role: 'CLIENT' });
  db.$transaction = async (work: any) => typeof work === 'function' ? work(transactionClient()) : Promise.all(work);
  db.booking.findMany = async ({ where }: any) => { queriedWhere = where; return []; };
  db.booking.findUnique = async ({ where }: any) => ({ id: where.id, priceTotal: 20000 });
  db.booking.update = async ({ where, data }: any) => ({ id: where.id, ...data });
});

test('un visitante no puede crear una reserva web', async () => {
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '20:30', durationMinutes: 90, playersCount: 4 })
  });
  assert.equal(response.status, 401);
  assert.equal(created.length, 0);
});

test('un usuario autenticado crea una reserva asociada a su cuenta', async () => {
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(17)),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '20:30', durationMinutes: 90, playersCount: 4 })
  });
  assert.equal(response.status, 201);
  assert.equal(created.length, 1);
  assert.equal(created[0].userId, 17);
  assert.equal(created[0].origin, 'WEB');
  assert.equal(created[0].status, 'CONFIRMED');
});

test('rechaza una duración sin precio activo', async () => {
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(17)),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '20:30', durationMinutes: 75, playersCount: 4 })
  });
  assert.equal(response.status, 400);
  assert.equal(created.length, 0);
});

test('rechaza una reserva que se superpone y devuelve un mensaje claro', async () => {
  const occupied = [{ startTime: new Date('2030-01-02T20:30:00-03:00'), endTime: new Date('2030-01-02T22:00:00-03:00') }];
  db.$transaction = async (work: any) => work(transactionClient(occupied));
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(18)),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '21:00', durationMinutes: 60, playersCount: 4 })
  });
  assert.equal(response.status, 409);
  const body = await response.json() as any;
  assert.match(body.message, /horario ya no est/i);
  assert.equal(created.length, 0);
});

test('disponibilidad marca la superposición 20:30–22:00 y libera las 22:00', async () => {
  db.businessHour.findUnique = async () => ({ active: true, openTime: '15:00', closeTime: '00:00' });
  db.price.findFirst = async () => ({ price: 16000 });
  db.booking.findMany = async () => [{
    startTime: new Date('2030-01-02T20:30:00-03:00'),
    endTime: new Date('2030-01-02T22:00:00-03:00')
  }];
  const response = await fetch(`${baseUrl}/availability?date=${futureDate}&duration=60&courtId=1`);
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  const slots = new Map(body.slots.map((slot: any) => [slot.startTime, slot]));
  assert.equal((slots.get('20:30') as any).available, false);
  assert.equal((slots.get('21:00') as any).available, false);
  assert.equal((slots.get('21:30') as any).available, false);
  assert.equal((slots.get('22:00') as any).available, true);
});

test('rechaza horarios pasados aunque el cliente intente enviarlos manualmente', async () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(17)),
    body: JSON.stringify({ courtId: 1, date: yesterday, startTime: '20:30', durationMinutes: 90, playersCount: 4 })
  });
  assert.equal(response.status, 400);
  const body = await response.json() as any;
  assert.match(body.message, /horario pasado/i);
  assert.equal(created.length, 0);
});
test('Mis turnos filtra exclusivamente por el usuario autenticado', async () => {
  const response = await fetch(`${baseUrl}/bookings/my`, { headers: headers(token(44)) });
  assert.equal(response.status, 200);
  assert.equal(queriedWhere.userId, 44);
});

test('un usuario común no puede acceder al admin por URL directa', async () => {
  const response = await fetch(`${baseUrl}/admin/bookings`, { headers: headers(token(1, 'CLIENT')) });
  assert.equal(response.status, 403);
});

test('un admin puede cargar un turno confirmado con origen WhatsApp', async () => {
  const response = await fetch(`${baseUrl}/admin/bookings`, {
    method: 'POST', headers: headers(token(2, 'ADMIN')),
    body: JSON.stringify({ courtId: 1, clientName: 'Ana Pérez', clientPhone: '3576111111', date: futureDate, startTime: '18:00', durationMinutes: 90, playersCount: 4, origin: 'WHATSAPP' })
  });
  assert.equal(response.status, 201);
  assert.equal(created[0].origin, 'WHATSAPP');
  assert.equal(created[0].status, 'CONFIRMED');
  assert.equal(created[0].userId, undefined);
});

test('los estados de pago se actualizan a seña y pagado', async () => {
  const seen: string[] = [];
  db.$transaction = async (work: any) => work({
    booking: { update: async ({ data }: any) => { seen.push(data.paymentStatus); return { id: 8, priceTotal: 20000, ...data }; } },
    cashMovement: { findFirst: async () => null, create: async () => ({ id: 1 }) }
  });
  for (const paymentStatus of ['PARTIAL', 'PAID']) {
    const response = await fetch(`${baseUrl}/admin/bookings/8/payment`, {
      method: 'PATCH', headers: headers(token(2, 'ADMIN')),
      body: JSON.stringify({ paymentStatus, createCashMovement: paymentStatus === 'PAID' })
    });
    assert.equal(response.status, 200);
  }
  assert.deepEqual(seen, ['PARTIAL', 'PAID']);
});