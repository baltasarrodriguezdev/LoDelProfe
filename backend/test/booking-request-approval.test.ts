import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/prisma/client.js';

const db = prisma as any;
let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let created: any[] = [];
let approved: any[] = [];
let requestStatus = 'PENDING';
let occupied: { startTime: Date; endTime: Date }[] = [];
const start = new Date('2030-01-02T20:30:00-03:00');
const code = 'VAL-ABCDEF012345';
const user = {
  id: 17, firstName: 'Ana', lastName: 'Pérez', phone: '3515551234',
  active: true, isBlocked: false, emailVerifiedAt: new Date(), bookingApprovedAt: null
};
const request = {
  id: 'first-17', userId: 17, user, courtId: 1, phone: user.phone,
  startTime: start, durationMinutes: 90, playersCount: 4, notes: null,
  priceQuoted: 20000, codeHash: createHash('sha256').update(code).digest('hex'),
  codeExpiresAt: new Date('2030-01-01T00:00:00Z')
};
const authHeaders = () => ({
  authorization: `Bearer ${jwt.sign({ userId: 2, role: 'SUPERADMIN' }, config.jwtSecret)}`,
  'content-type': 'application/json', origin: 'http://localhost:4200'
});

before(async () => new Promise<void>(resolve => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Sin puerto de prueba');
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  });
}));
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

beforeEach(() => {
  created = []; approved = []; requestStatus = 'PENDING'; occupied = [];
  db.bookingRequest.findUnique = async () => ({ ...request, status: requestStatus, codeExpiresAt: new Date(Date.now() + 60_000) });
  db.bookingRequest.updateMany = async ({ where, data }: any) => {
    if (where.status !== requestStatus) return { count: 0 };
    requestStatus = data.status;
    return { count: 1 };
  };
  db.user.update = async ({ data }: any) => { approved.push(data); return { ...user, ...data }; };
  db.auditLog.create = async ({ data }: any) => ({ id: 1n, ...data });
  db.$transaction = async (work: any) => {
    const originalStatus = requestStatus;
    try { return await work({
    bookingRequest: {
      updateMany: db.bookingRequest.updateMany,
      update: async ({ data }: any) => data
    },
    price: { findFirst: async () => ({ price: 20000 }) },
    court: { findFirst: async () => ({ id: 1, active: true }) },
    businessHour: { findUnique: async () => ({ active: true, openTime: '15:00', closeTime: '00:00' }) },
    booking: {
      findMany: async () => occupied,
      create: async ({ data }: any) => { const booking = { id: created.length + 1, ...data }; created.push(booking); return booking; }
    }
    }); } catch (error) { requestStatus = originalStatus; throw error; }
  };
});

test('el remitente incorrecto no aprueba ni crea turno', async () => {
  const response = await fetch(`${baseUrl}/api/admin/booking-requests/first-17/approve`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ senderPhone: '3511112222', code })
  });
  assert.equal(response.status, 400);
  assert.equal(approved.length, 0);
  assert.equal(created.length, 0);
});

test('el remitente y código correctos aprueban una sola primera reserva', async () => {
  const submit = () => fetch(`${baseUrl}/api/admin/booking-requests/first-17/approve`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ senderPhone: '+54 3515551234', code })
  });
  const first = await submit();
  assert.equal(first.status, 200);
  assert.equal((await first.json() as any).status, 'CONFIRMED');
  assert.equal(approved.length, 1);
  assert.equal(created.length, 1);
  assert.equal(created[0].status, 'CONFIRMED');
  const second = await submit();
  assert.equal(second.status, 409);
  assert.equal(created.length, 1);
});

test('el cliente queda aprobado si el horario ya fue ocupado', async () => {
  occupied = [{ startTime: start, endTime: new Date(start.getTime() + 90 * 60_000) }];
  const response = await fetch(`${baseUrl}/api/admin/booking-requests/first-17/approve`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ senderPhone: '3515551234', code })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json() as any).status, 'NEEDS_NEW_SLOT');
  assert.equal(approved.length, 1);
  assert.equal(created.length, 0);
  assert.equal(requestStatus, 'NEEDS_NEW_SLOT');
});
