import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/prisma/client.js';
import { subscribeRealtimeEvents } from '../src/realtime/events.js';

const db = prisma as any;
const apiKey = 'test-only-bot-api-key';
const futureDate = '2030-01-02';
const localPhone = '3576000000';
let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let users: any[] = [];
let bookings: any[] = [];
let requests: any[] = [];
let audits: any[] = [];
let nextBookingId = 100;
let nextRequestId = 1;
let cancellationCutoffMinutes = 120;
let transactionQueue = Promise.resolve();

const botHeaders = { 'content-type': 'application/json', 'x-api-key': apiKey };
const adminToken = () => jwt.sign({ userId: 1, role: 'SUPERADMIN' }, config.jwtSecret);

function matches(row: any, where: any): boolean {
  if (!where) return true;
  if (where.AND && !where.AND.every((item: any) => matches(row, item))) return false;
  if (where.OR && !where.OR.some((item: any) => matches(row, item))) return false;
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.courtId !== undefined && row.courtId !== where.courtId) return false;
  if (where.clientPhone?.in && !where.clientPhone.in.includes(row.clientPhone)) return false;
  if (typeof where.status === 'string' && row.status !== where.status) return false;
  if (where.status?.in && !where.status.in.includes(row.status)) return false;
  for (const field of ['startTime', 'endTime', 'holdExpiresAt']) {
    const rule = where[field];
    if (!rule) continue;
    const value = row[field] as Date | null;
    if (rule.gt && (!value || value <= rule.gt)) return false;
    if (rule.gte && (!value || value < rule.gte)) return false;
    if (rule.lt && (!value || value >= rule.lt)) return false;
    if (rule.lte && (!value || value > rule.lte)) return false;
  }
  return true;
}

function transactionClient() {
  return {
    user: { findUnique: async ({ where }: any) => users.find(user => user.id === where.id) ?? null },
    court: {
      findFirst: async ({ where }: any) => where?.id && where.id !== 1 ? null : ({ id: 1, active: true, name: 'Lo del Profe' })
    },
    price: {
      findFirst: async ({ where }: any) => [60, 90, 120].includes(where.durationMinutes)
        ? ({ price: where.durationMinutes === 60 ? 16000 : where.durationMinutes === 90 ? 20000 : 24000 })
        : null
    },
    businessHour: { findUnique: async () => ({ active: true, openTime: '15:00', closeTime: '00:00', breakStartTime: null, breakEndTime: null }) },
    venueSetting: { findUnique: async () => ({ id: 1, cancellationCutoffMinutes }) },
    botPhoneLock: { upsert: async ({ create }: any) => create },
    botBookingRequest: {
      create: async ({ data }: any) => {
        if (requests.some(item => item.keyHash === data.keyHash)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        const row = { id: nextRequestId++, ...data, bookingId: null, createdAt: new Date() };
        requests.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = requests.find(item => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      count: async () => requests.filter(item => item.bookingId != null).length
    },
    booking: {
      count: async ({ where }: any) => bookings.filter(item => matches(item, where)).length,
      findMany: async ({ where }: any) => bookings.filter(item => matches(item, where)),
      findFirst: async ({ where }: any) => bookings.find(item => matches(item, where)) ?? null,
      create: async ({ data }: any) => {
        const row = { id: nextBookingId++, ...data, priceTotal: Number(data.priceTotal), createdAt: new Date(), updatedAt: new Date() };
        bookings.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = bookings.find(item => item.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }
    },
    auditLog: { create: async ({ data }: any) => { const row = { id: BigInt(audits.length + 1), ...data }; audits.push(row); return row; } }
  };
}

before(async () => {
  config.botApiKey = apiKey;
  await new Promise<void>(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de prueba');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

beforeEach(() => {
  users = [];
  bookings = [];
  requests = [];
  audits = [];
  nextBookingId = 100;
  nextRequestId = 1;
  cancellationCutoffMinutes = 120;
  transactionQueue = Promise.resolve();

  db.user.findFirst = async ({ where }: any) => users.find(user => where.phone.in.includes(user.phone)) ?? null;
  db.user.findUnique = async ({ where }: any) => users.find(user => user.id === where.id) ?? null;
  db.booking.findMany = async ({ where }: any) => bookings.filter(item => matches(item, where));
  db.booking.findFirst = async ({ where }: any) => bookings.find(item => matches(item, where)) ?? null;
  db.booking.findUnique = async ({ where }: any) => bookings.find(item => item.id === where.id) ?? null;
  db.booking.count = async ({ where }: any) => bookings.filter(item => matches(item, where)).length;
  db.botBookingRequest.findUnique = async ({ where, include }: any) => {
    const row = requests.find(item => item.keyHash === where.keyHash);
    return row ? { ...row, ...(include?.booking ? { booking: bookings.find(item => item.id === row.bookingId) ?? null } : {}) } : null;
  };
  db.auditLog.create = async ({ data }: any) => { const row = { id: BigInt(audits.length + 1), ...data }; audits.push(row); return row; };
  db.cashMovement.findMany = async () => [];
  db.businessHour.findMany = async () => [];
  db.court.count = async () => 1;
  db.user.count = async () => 0;
  db.$transaction = async (work: any) => {
    const run = transactionQueue.then(() => work(transactionClient()));
    transactionQueue = run.then(() => undefined, () => undefined);
    return run;
  };
});

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    phone: `549${localPhone}`,
    name: 'Cliente WhatsApp',
    date: futureDate,
    startTime: '20:30',
    durationMinutes: 90,
    idempotencyKey: 'event-1',
    ...overrides
  };
}

test('bot exige x-api-key y no acepta una clave incorrecta', async () => {
  const missing = await fetch(`${baseUrl}/api/bot/customer?phone=549${localPhone}`);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { message: 'No autorizado.', code: 'BOT_UNAUTHORIZED' });
  const wrong = await fetch(`${baseUrl}/api/bot/customer?phone=549${localPhone}`, { headers: { 'x-api-key': 'wrong' } });
  assert.equal(wrong.status, 401);
});

test('customer normaliza 549, 54 y diez dígitos y expone solamente nombre', async () => {
  users.push({ id: 7, firstName: 'Ana', lastName: 'Pérez', phone: localPhone, active: true, isBlocked: false, phoneVerified: true });
  for (const phone of [`549${localPhone}`, `54${localPhone}`, localPhone]) {
    const response = await fetch(`${baseUrl}/api/bot/customer?phone=${phone}`, { headers: botHeaders });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { exists: true, firstName: 'Ana' });
  }
});

test('cliente sin cuenta requiere nombre válido y crea CONFIRMED con defaults', async () => {
  const missingName = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody({ name: undefined }))
  });
  assert.equal(missingName.status, 400);
  assert.equal((await missingName.json() as any).code, 'NAME_REQUIRED');

  const invalid = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody({ name: 'Nombre\nInyectado' }))
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json() as any).code, 'VALIDATION_ERROR');

  const response = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody())
  });
  assert.equal(response.status, 201);
  const body = await response.json() as any;
  assert.equal(body.status, 'CONFIRMED');
  assert.equal(body.pendingApproval, false);
  assert.equal(body.holdExpiresAt, null);
  assert.equal(bookings[0].playersCount, 4);
  assert.equal(bookings[0].userId, null);
  assert.equal(bookings[0].createdBy, null);
  assert.equal(bookings[0].origin, 'WHATSAPP');
  assert.equal(audits[0].action, 'BOOKING_BOT_CREATED');
});

test('usuario existente usa sus datos y conserva la regla VERIFIED/PENDING', async () => {
  users.push({ id: 8, firstName: 'Mora', lastName: 'Díaz', phone: localPhone, active: true, isBlocked: false, phoneVerified: true });
  let response = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody({ name: undefined }))
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json() as any).status, 'CONFIRMED');
  assert.equal(bookings[0].clientName, 'Mora Díaz');
  assert.equal(bookings[0].userId, 8);

  users[0].phoneVerified = false;
  bookings = [];
  requests = [];
  response = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody({ idempotencyKey: 'event-2', name: undefined }))
  });
  assert.equal(response.status, 201);
  const pending = await response.json() as any;
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.pendingApproval, true);
  assert.ok(pending.holdExpiresAt);
});

test('doble envío idempotente devuelve la misma reserva y no repite auditoría', async () => {
  const events: any[] = [];
  const unsubscribe = subscribeRealtimeEvents(event => events.push(event));
  const request = () => fetch(`${baseUrl}/api/bot/bookings`, { method: 'POST', headers: botHeaders, body: JSON.stringify(createBody()) });
  const first = await request();
  const second = await request();
  unsubscribe();
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]) as any[];
  assert.equal(firstBody.id, secondBody.id);
  assert.equal(secondBody.idempotentReplay, true);
  assert.equal(bookings.length, 1);
  assert.equal(audits.length, 1);
  assert.equal(events.filter(event => event.type === 'BOOKING_CREATED').length, 1);
  assert.equal(events.filter(event => event.type === 'AVAILABILITY_CHANGED').length, 1);
});

test('rechaza reutilizar una idempotencyKey con datos distintos', async () => {
  const first = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody())
  });
  assert.equal(first.status, 201);
  const second = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody({ startTime: '21:00' }))
  });
  assert.equal(second.status, 409);
  assert.equal((await second.json() as any).code, 'IDEMPOTENCY_KEY_REUSED');
});

test('dos reintentos simultáneos crean una sola reserva', async () => {
  const request = () => fetch(`${baseUrl}/api/bot/bookings`, { method: 'POST', headers: botHeaders, body: JSON.stringify(createBody()) });
  const responses = await Promise.all([request(), request()]);
  assert.deepEqual(responses.map(item => item.status).sort(), [200, 201]);
  assert.equal(bookings.length, 1);
});

test('dos pedidos distintos al mismo horario: sólo uno gana', async () => {
  const request = (key: string) => fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody({ idempotencyKey: key }))
  });
  const responses = await Promise.all([request('event-a'), request('event-b')]);
  assert.deepEqual(responses.map(item => item.status).sort(), [201, 409]);
  const rejected = responses.find(item => item.status === 409)!;
  assert.equal((await rejected.json() as any).code, 'SLOT_UNAVAILABLE');
  assert.equal(bookings.length, 1);
});

test('aplica el límite de dos reservas futuras activas por teléfono', async () => {
  for (const [index, startTime] of ['18:00', '20:30'].entries()) {
    const response = await fetch(`${baseUrl}/api/bot/bookings`, {
      method: 'POST', headers: botHeaders,
      body: JSON.stringify(createBody({ startTime, idempotencyKey: `active-${index}` }))
    });
    assert.equal(response.status, 201);
  }
  const response = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify(createBody({ startTime: '22:30', idempotencyKey: 'active-limit' }))
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json() as any).code, 'PHONE_ACTIVE_BOOKING_LIMIT');
});

test('el límite diario cuenta reservas exitosas aunque luego se cancelen', async () => {
  for (let index = 0; index < 4; index++) {
    const created = await fetch(`${baseUrl}/api/bot/bookings`, {
      method: 'POST', headers: botHeaders,
      body: JSON.stringify(createBody({ idempotencyKey: `daily-${index}` }))
    });
    assert.equal(created.status, 201);
    const booking = await created.json() as any;
    const cancelled = await fetch(`${baseUrl}/api/bot/bookings/${booking.id}/cancel`, {
      method: 'PATCH', headers: botHeaders, body: JSON.stringify({ phone: localPhone })
    });
    assert.equal(cancelled.status, 200);
  }
  const response = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders,
    body: JSON.stringify(createBody({ idempotencyKey: 'daily-limit' }))
  });
  assert.equal(response.status, 429);
  assert.equal((await response.json() as any).code, 'PHONE_DAILY_BOOKING_LIMIT');
});

test('rechaza horario pasado y duración sin precio', async () => {
  let response = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody({ date: '2020-01-02' }))
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json() as any).code, 'PAST_START_TIME');
  response = await fetch(`${baseUrl}/api/bot/bookings`, {
    method: 'POST', headers: botHeaders, body: JSON.stringify(createBody({ durationMinutes: 75, idempotencyKey: 'event-duration' }))
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json() as any).code, 'DURATION_NOT_AVAILABLE');
});

test('listado y cancelación no filtran reservas de otro teléfono', async () => {
  const start = new Date('2030-01-02T23:30:00.000Z');
  bookings.push(
    { id: 1, courtId: 1, userId: null, clientPhone: localPhone, startTime: start, endTime: new Date(start.getTime() + 90 * 60_000), durationMinutes: 90, status: 'CONFIRMED', priceTotal: 20000, holdExpiresAt: null },
    { id: 2, courtId: 1, userId: null, clientPhone: '3511111111', startTime: start, endTime: new Date(start.getTime() + 90 * 60_000), durationMinutes: 90, status: 'CONFIRMED', priceTotal: 20000, holdExpiresAt: null }
  );
  const list = await fetch(`${baseUrl}/api/bot/bookings?phone=549${localPhone}`, { headers: botHeaders });
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json() as any).bookings.map((item: any) => item.id), [1]);

  const foreign = await fetch(`${baseUrl}/api/bot/bookings/2/cancel`, {
    method: 'PATCH', headers: botHeaders, body: JSON.stringify({ phone: `549${localPhone}` })
  });
  assert.equal(foreign.status, 404);
  assert.equal((await foreign.json() as any).code, 'BOOKING_NOT_FOUND');

  const own = await fetch(`${baseUrl}/api/bot/bookings/1/cancel`, {
    method: 'PATCH', headers: botHeaders, body: JSON.stringify({ phone: `54${localPhone}` })
  });
  assert.equal(own.status, 200);
  assert.equal(bookings[0].status, 'CANCELLED');
});

test('cancelación respeta el cutoff y permite cancelar PENDING dentro del plazo', async () => {
  const soon = new Date(Date.now() + 60 * 60_000);
  bookings.push({ id: 3, courtId: 1, userId: null, clientPhone: localPhone, startTime: soon, endTime: new Date(soon.getTime() + 60 * 60_000), durationMinutes: 60, status: 'CONFIRMED', priceTotal: 16000 });
  let response = await fetch(`${baseUrl}/api/bot/bookings/3/cancel`, {
    method: 'PATCH', headers: botHeaders, body: JSON.stringify({ phone: localPhone })
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json() as any).code, 'CANCELLATION_CUTOFF');

  bookings[0].status = 'PENDING';
  bookings[0].holdExpiresAt = new Date(Date.now() + 10 * 60_000);
  response = await fetch(`${baseUrl}/api/bot/bookings/3/cancel`, {
    method: 'PATCH', headers: botHeaders, body: JSON.stringify({ phone: localPhone })
  });
  assert.equal(response.status, 200);
});

test('panel y dashboard admiten reservas con createdBy nulo', async () => {
  const start = new Date('2030-01-02T23:30:00.000Z');
  bookings.push({
    id: 50, courtId: 1, userId: null, clientPhone: localPhone, clientName: 'Bot', createdBy: null,
    startTime: start, endTime: new Date(start.getTime() + 90 * 60_000), durationMinutes: 90,
    status: 'CONFIRMED', paymentStatus: 'PENDING', priceTotal: 20000, amountPaid: 0
  });
  const headers = { authorization: `Bearer ${adminToken()}` };
  const detail = await fetch(`${baseUrl}/api/admin/bookings/50`, { headers });
  assert.equal(detail.status, 200);
  assert.equal((await detail.json() as any).creator, null);

  const dashboard = await fetch(`${baseUrl}/api/admin/dashboard?from=2030-01-02&to=2030-01-02`, { headers });
  assert.equal(dashboard.status, 200);
  assert.equal((await dashboard.json() as any).summary.totalBookings, 1);
});

test('rate limit del bot corta en 120 solicitudes por minuto e IP', async () => {
  const headers = { ...botHeaders, 'x-forwarded-for': '203.0.113.25' };
  for (let index = 0; index < 120; index++) {
    const response = await fetch(`${baseUrl}/api/bot/customer?phone=${localPhone}`, { headers });
    assert.equal(response.status, 200);
  }
  const limited = await fetch(`${baseUrl}/api/bot/customer?phone=${localPhone}`, { headers });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json() as any).code, 'RATE_LIMITED');
});
