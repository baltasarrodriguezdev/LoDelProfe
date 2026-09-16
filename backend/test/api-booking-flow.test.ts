import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from '../src/prisma/client.js';
import { subscribeRealtimeEvents } from '../src/realtime/events.js';

const db = prisma as any;
let server: ReturnType<typeof app.listen>;
let baseUrl = '';
let created: any[] = [];
let queriedWhere: any = null;
let transactionOptions: any = null;

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
    user: { update: async ({ where, data }: any) => ({ id: where.id, ...data }) },
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
  transactionOptions = null;
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Valentino', lastName: 'Rodríguez', phone: '3576000000', role: 'CLIENT', active: true, phoneVerified: true, isBlocked: false });
  db.$transaction = async (work: any, options?: any) => { transactionOptions = options; return typeof work === 'function' ? work(transactionClient()) : Promise.all(work); };
  db.booking.findFirst = async () => null;
  db.booking.findMany = async ({ where }: any) => { queriedWhere = where; return []; };
  db.booking.findUnique = async ({ where }: any) => ({ id: where.id, priceTotal: 20000 });
  db.booking.update = async ({ where, data }: any) => ({ id: where.id, ...data });
  db.booking.updateMany = async () => ({ count: 0 });
  db.auditLog.create = async ({ data }: any) => ({ id: 1n, ...data });
  db.leagueMatch.findFirst = async () => null;
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
  assert.equal(transactionOptions?.isolationLevel, 'RepeatableRead');
});


test('usuario no verificado crea primera reserva pendiente para validar telefono', async () => {
  const requestedAt = Date.now();
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Fabian', lastName: 'Carlos', phone: '3576524440', role: 'CLIENT', active: true, phoneVerified: false, isBlocked: false });
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(22)),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '20:30', durationMinutes: 90, playersCount: 4, status: 'CONFIRMED' })
  });
  assert.equal(response.status, 201);
  assert.equal(created[0].status, 'PENDING');
  assert.equal(created[0].origin, 'WEB');
  assert.ok(created[0].holdExpiresAt instanceof Date);
  assert.ok(created[0].holdExpiresAt.getTime() >= requestedAt + 9 * 60_000);
  assert.ok(created[0].holdExpiresAt.getTime() <= Date.now() + 10 * 60_000);
  const body = await response.json() as any;
  assert.equal(body.reservation.status, 'PENDING');
  assert.equal(body.alreadyPending, false);
  assert.equal(body.requiresWhatsappConfirmation, undefined);
  assert.equal(body.whatsappUrl, undefined);
});

test('phoneVerified es la única fuente de verdad aunque status legado diga VERIFIED', async () => {
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Ana', lastName: 'Perez', phone: '3576524440', role: 'CLIENT', active: true, phoneVerified: false, status: 'VERIFIED', isBlocked: false });
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(23)),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '20:30', durationMinutes: 90, playersCount: 4 })
  });
  assert.equal(response.status, 201);
  assert.equal(created[0].status, 'PENDING');
});
test('usuario no verificado con la misma solicitud pendiente recibe la existente', async () => {
  const pending = {
    id: 77,
    courtId: 1,
    userId: 22,
    status: 'PENDING',
    startTime: new Date('2030-01-02T20:30:00-03:00'),
    durationMinutes: 90,
    court: { id: 1, name: 'Cancha 1' }
  };
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Fabian', lastName: 'Carlos', phone: '3576524440', role: 'CLIENT', active: true, phoneVerified: false, isBlocked: false });
  db.booking.findFirst = async ({ where }: any) => where.courtId ? pending : null;
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(22)),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '20:30', durationMinutes: 90, playersCount: 4 })
  });
  assert.equal(response.status, 200);
  assert.equal(created.length, 0);
  const body = await response.json() as any;
  assert.equal(body.reservation.id, 77);
  assert.equal(body.alreadyPending, true);
});

test('usuario no verificado con otra solicitud pendiente no duplica reservas', async () => {
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Fabian', lastName: 'Carlos', phone: '3576524440', role: 'CLIENT', active: true, phoneVerified: false, isBlocked: false });
  db.booking.findFirst = async ({ where }: any) => where.courtId ? null : ({
    id: 78,
    courtId: 1,
    userId: 22,
    status: 'PENDING',
    startTime: new Date('2030-01-02T18:00:00-03:00'),
    durationMinutes: 90
  });
  const response = await fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(22)),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '20:30', durationMinutes: 90, playersCount: 4 })
  });
  assert.equal(response.status, 409);
  assert.equal(created.length, 0);
  const body = await response.json() as any;
  assert.match(body.message, /solicitud pendiente/i);
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
  const emitted: string[] = [];
  const unsubscribe = subscribeRealtimeEvents(event => emitted.push(event.type));
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
  unsubscribe();
  assert.deepEqual(emitted, []);
});

test('dos reservas simultáneas del mismo horario aceptan solamente una', async () => {
  let lock = Promise.resolve();
  db.$transaction = async (work: any, options?: any) => {
    transactionOptions = options;
    let release!: () => void;
    const previous = lock;
    lock = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      const occupied = created.map(item => ({ startTime: item.startTime, endTime: item.endTime }));
      return await work(transactionClient(occupied));
    } finally {
      release();
    }
  };
  const request = (userId: number) => fetch(`${baseUrl}/bookings`, {
    method: 'POST', headers: headers(token(userId)),
    body: JSON.stringify({ courtId: 1, date: futureDate, startTime: '21:00', durationMinutes: 60, playersCount: 4 })
  });

  const responses = await Promise.all([request(71), request(72)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal(created.length, 1);
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

test('disponibilidad bloquea pendientes y no consulta canceladas como ocupadas', async () => {
  db.businessHour.findUnique = async () => ({ active: true, openTime: '15:00', closeTime: '00:00' });
  db.price.findFirst = async () => ({ price: 16000 });
  db.booking.findMany = async ({ where }: any) => {
    const permanent = where.OR.find((item: any) => item.status?.in);
    const temporary = where.OR.find((item: any) => item.status === 'PENDING');
    assert.ok(permanent.status.in.includes('CONFIRMED'));
    assert.equal(permanent.status.in.includes('CANCELLED'), false);
    assert.ok(temporary.holdExpiresAt.gt instanceof Date);
    return [];
  };
  const response = await fetch(`${baseUrl}/availability?date=${futureDate}&duration=60&courtId=1`);
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.ok(body.slots.some((slot: any) => slot.available));
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

test('Mis turnos vence solicitudes pendientes y libera el horario', async () => {
  let expirationArgs: any = null;
  db.booking.updateMany = async (args: any) => { expirationArgs = args; return { count: 1 }; };
  const response = await fetch(`${baseUrl}/bookings/my`, { headers: headers(token(44)) });
  assert.equal(response.status, 200);
  assert.equal(expirationArgs.where.userId, 44);
  assert.equal(expirationArgs.where.status, 'PENDING');
  assert.equal(expirationArgs.data.status, 'CANCELLED');
  assert.match(expirationArgs.data.cancellationReason, /Solicitud vencida/i);
});

test('una solicitud pendiente puede cancelarse aunque falten menos de dos horas', async () => {
  let updateData: any = null;
  db.booking.findFirst = async ({ where }: any) => ({
    id: where.id,
    userId: where.userId,
    status: 'PENDING',
    startTime: new Date(Date.now() + 30 * 60_000)
  });
  db.booking.update = async ({ where, data }: any) => { updateData = data; return { id: where.id, ...data }; };
  const response = await fetch(`${baseUrl}/bookings/94/cancel`, {
    method: 'PATCH', headers: headers(token(44)), body: '{}'
  });
  assert.equal(response.status, 200);
  assert.equal(updateData.status, 'CANCELLED');
});

test('cliente no puede cancelar dentro del límite configurado', async () => {
  db.booking.findFirst = async ({ where }: any) => ({
    id: where.id,
    userId: where.userId,
    status: 'CONFIRMED',
    startTime: new Date(Date.now() + 60 * 60_000)
  });
  db.venueSetting.findUnique = async () => ({ id: 1, cancellationCutoffMinutes: 120 });
  const response = await fetch(`${baseUrl}/bookings/91/cancel`, {
    method: 'PATCH',
    headers: headers(token(44)),
    body: '{}'
  });
  assert.equal(response.status, 409);
  assert.match((await response.json() as any).message, /120 minutos/i);
});

test('un estado terminal no se puede cancelar por el cambio genérico', async () => {
  db.booking.findUnique = async ({ where }: any) => ({ id: where.id, status: 'PLAYED' });
  const response = await fetch(`${baseUrl}/admin/bookings/92/status`, {
    method: 'PATCH',
    headers: headers(token(2, 'ADMIN')),
    body: JSON.stringify({ status: 'CANCELLED' })
  });
  assert.equal(response.status, 409);
  assert.match((await response.json() as any).message, /no se puede cambiar/i);
});

test('sólo superadmin puede borrar definitivamente el historial de un turno', async () => {
  const response = await fetch(`${baseUrl}/admin/bookings/93/permanent`, {
    method: 'DELETE',
    headers: headers(token(2, 'ADMIN'))
  });
  assert.equal(response.status, 403);
});

test('un usuario común no puede acceder al admin por URL directa', async () => {
  const response = await fetch(`${baseUrl}/admin/bookings`, { headers: headers(token(1, 'CLIENT')) });
  assert.equal(response.status, 403);
});

test('admin lista reservas pendientes de confirmación', async () => {
  db.booking.findMany = async ({ where, include, orderBy }: any) => {
    queriedWhere = where;
    assert.equal(where.status, 'PENDING');
    assert.ok(include.user);
    assert.deepEqual(orderBy, { createdAt: 'asc' });
    return [{
      id: 55,
      startTime: new Date('2030-01-02T20:30:00-03:00'),
      endTime: new Date('2030-01-02T22:00:00-03:00'),
      durationMinutes: 90,
      status: 'PENDING',
      clientName: 'Fabian Carlos',
      clientPhone: '3576524440',
      createdAt: new Date('2030-01-01T12:00:00Z'),
      user: { firstName: 'Fabian', lastName: 'Carlos', phone: '3576524440', phoneVerified: false }
    }];
  };
  const response = await fetch(`${baseUrl}/admin/reservations?status=PENDING`, { headers: headers(token(2, 'ADMIN')) });
  assert.equal(response.status, 200);
  const body = await response.json() as any[];
  assert.equal(body[0].id, 55);
  assert.equal(body[0].user.phoneVerified, false);
});


test('admin cancela usuario pendiente y libera número cancelando sus reservas pendientes', async () => {
  let updateManyArgs: any = null;
  let deletedUserId: number | null = null;
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Fabián', lastName: 'Carlos', phone: '3576524440', role: 'CLIENT', active: true, phoneVerified: false, isBlocked: false });
  db.$transaction = async (work: any) => work({
    booking: {
      updateMany: async (args: any) => { updateManyArgs = args; return { count: 2 }; }
    },
    user: {
      delete: async ({ where }: any) => { deletedUserId = where.id; return { id: where.id }; }
    }
  });

  const response = await fetch(`${baseUrl}/admin/users/22/pending-verification`, {
    method: 'DELETE', headers: headers(token(2, 'SUPERADMIN'))
  });

  assert.equal(response.status, 200);
  assert.equal(deletedUserId, 22);
  assert.deepEqual(updateManyArgs.where, { userId: 22, status: 'PENDING' });
  assert.equal(updateManyArgs.data.status, 'CANCELLED');
  assert.equal(updateManyArgs.data.cancellationReason, 'Usuario pendiente cancelado por administración');
  assert.ok(updateManyArgs.data.cancelledAt instanceof Date);
  const body = await response.json() as any;
  assert.equal(body.message, 'Usuario pendiente cancelado. El número quedó disponible.');
  assert.equal(body.cancelledBookings, 2);
});

test('admin no puede cancelar usuario ya verificado desde pendientes', async () => {
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Ana', lastName: 'Pérez', phone: '3510000000', role: 'CLIENT', active: true, phoneVerified: true, isBlocked: false });

  const response = await fetch(`${baseUrl}/admin/users/23/pending-verification`, {
    method: 'DELETE', headers: headers(token(2, 'SUPERADMIN'))
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { message: 'Solo se pueden cancelar usuarios pendientes de verificación.' });
});

test('admin no puede cancelar otro administrador desde pendientes', async () => {
  db.user.findUnique = async ({ where }: any) => ({ id: where.id, firstName: 'Admin', lastName: 'Club', phone: '3510000000', role: 'ADMIN', active: true, phoneVerified: false, isBlocked: false });

  const response = await fetch(`${baseUrl}/admin/users/24/pending-verification`, {
    method: 'DELETE', headers: headers(token(2, 'SUPERADMIN'))
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: 'No se puede cancelar un usuario administrador.' });
});
test('admin confirma una reserva pendiente sin verificar usuario', async () => {
  let updateData: any = null;
  let currentStatus = 'PENDING';
  db.booking.findUnique = async ({ where }: any) => ({ id: where.id, status: currentStatus, userId: 22, holdExpiresAt: new Date(Date.now() + 60_000), cancellationReason: null });
  db.booking.update = async ({ where, data }: any) => { updateData = data; currentStatus = data.status; return { id: where.id, status: data.status }; };
  const response = await fetch(`${baseUrl}/admin/reservations/55/confirm`, {
    method: 'PATCH', headers: headers(token(2, 'SUPERADMIN')), body: '{}'
  });
  assert.equal(response.status, 200);
  assert.deepEqual(updateData, { status: 'CONFIRMED', holdExpiresAt: null, cancelledAt: null, cancellationReason: null });
  assert.equal((await response.json() as any).status, 'CONFIRMED');
});

test('admin no puede confirmar una retención temporal vencida', async () => {
  db.booking.findUnique = async ({ where }: any) => ({
    id: where.id,
    status: 'PENDING',
    userId: 22,
    holdExpiresAt: new Date(Date.now() - 60_000),
    cancellationReason: null
  });

  const response = await fetch(`${baseUrl}/admin/reservations/55/confirm`, {
    method: 'PATCH', headers: headers(token(2, 'SUPERADMIN')), body: '{}'
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { message: 'La retención de este turno ya venció y el horario fue liberado.' });
});

test('admin confirma y verifica usuario en una transaccion', async () => {
  const seen: string[] = [];
  db.booking.findUnique = async ({ where }: any) => ({ id: where.id, status: 'PENDING', userId: 22, holdExpiresAt: new Date(Date.now() + 60_000), cancellationReason: null });
  db.$transaction = async (work: any) => work({
    booking: { update: async ({ data }: any) => { seen.push(`booking:${data.status}`); return { id: 55, status: data.status, userId: 22 }; } },
    user: {
      findUnique: async () => ({ id: 22, firstName: 'Fabián', phone: '3576524440', role: 'CLIENT', active: true, isBlocked: false, phoneVerified: false, status: 'PENDING_VERIFICATION', verificationCode: 'VAL-A1B2C3D4' }),
      update: async ({ data }: any) => { seen.push(`user:${data.phoneVerified}`); assert.equal(data.status, 'VERIFIED'); assert.equal(data.phoneVerifiedById, 2); return { id: 22, firstName: 'Fabián', phone: '3576524440', phoneVerified: data.phoneVerified, status: data.status }; }
    }
  });
  const response = await fetch(`${baseUrl}/admin/reservations/55/confirm-and-verify-user`, {
    method: 'PATCH', headers: headers(token(2, 'SUPERADMIN')),
    body: JSON.stringify({ method: 'WHATSAPP_MANUAL', senderPhone: '+54 3576 524440', code: 'VAL-A1B2C3D4' })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(seen, ['booking:CONFIRMED', 'user:true']);
  const body = await response.json() as any;
  assert.equal(body.reservation.status, 'CONFIRMED');
  assert.equal(body.user.phoneVerified, true);
  assert.equal(body.user.status, 'VERIFIED');
});

test('admin cancela una reserva pendiente', async () => {
  let updateData: any = null;
  db.booking.findUnique = async ({ where }: any) => ({ id: where.id, status: 'PENDING', userId: 22 });
  db.booking.update = async ({ where, data }: any) => { updateData = data; return { id: where.id, ...data }; };
  const response = await fetch(`${baseUrl}/admin/reservations/55/cancel`, {
    method: 'PATCH', headers: headers(token(2, 'ADMIN')),
    body: JSON.stringify({ cancellationReason: 'No confirmo por WhatsApp' })
  });
  assert.equal(response.status, 200);
  assert.equal(updateData.status, 'CANCELLED');
  assert.equal(updateData.cancellationReason, 'No confirmo por WhatsApp');
  assert.ok(updateData.cancelledAt instanceof Date);
});

test('admin no confirma reservas que ya no estan pendientes', async () => {
  db.booking.findUnique = async ({ where }: any) => ({ id: where.id, status: 'CONFIRMED', userId: 22 });
  const response = await fetch(`${baseUrl}/admin/reservations/55/confirm`, {
    method: 'PATCH', headers: headers(token(2, 'ADMIN')), body: '{}'
  });
  assert.equal(response.status, 409);
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

test('admin rechaza una hora fuera de la grilla aunque intente forzarla', async () => {
  const response = await fetch(`${baseUrl}/admin/bookings`, {
    method: 'POST', headers: headers(token(2, 'ADMIN')),
    body: JSON.stringify({
      courtId: 1,
      clientName: 'Ana Pérez',
      clientPhone: '3576111111',
      date: futureDate,
      startTime: '16:02',
      durationMinutes: 90,
      playersCount: 4,
      origin: 'MANUAL'
    })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json() as any).message, /intervalos de 30 minutos/i);
  assert.equal(created.length, 0);
});

test('admin no puede forzar un turno que deja un hueco no disponible', async () => {
  const occupied = [{
    startTime: new Date('2030-01-02T18:00:00-03:00'),
    endTime: new Date('2030-01-02T19:30:00-03:00')
  }];
  db.$transaction = async (work: any) => work(transactionClient(occupied));

  const payload = {
    courtId: 1,
    clientName: 'Ana Pérez',
    clientPhone: '3576111111',
    date: futureDate,
    startTime: '16:00',
    durationMinutes: 90,
    playersCount: 4,
    origin: 'MANUAL'
  };
  const forcedResponse = await fetch(`${baseUrl}/admin/bookings`, {
    method: 'POST', headers: headers(token(2, 'ADMIN')),
    body: JSON.stringify({ ...payload, adminOverride: true })
  });
  assert.equal(forcedResponse.status, 400);
  assert.match((await forcedResponse.json() as any).message, /datos inválidos/i);

  const response = await fetch(`${baseUrl}/admin/bookings`, {
    method: 'POST', headers: headers(token(2, 'ADMIN')),
    body: JSON.stringify(payload)
  });
  assert.equal(response.status, 409);
  assert.match((await response.json() as any).message, /espacio libre menor a 60 minutos/i);
  assert.equal(created.length, 0);
});

test('disponibilidad administrativa ignora el propio turno durante la edición', async () => {
  db.businessHour.findUnique = async () => ({ active: true, openTime: '15:00', closeTime: '00:00' });
  db.price.findFirst = async () => ({ price: 20000 });
  db.booking.findMany = async ({ where }: any) => {
    assert.deepEqual(where.id, { not: 55 });
    return [];
  };

  const response = await fetch(`${baseUrl}/admin/availability?date=${futureDate}&duration=90&courtId=1&ignoreBookingId=55`, {
    headers: headers(token(2, 'ADMIN'))
  });
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.slots.find((slot: any) => slot.startTime === '18:00')?.available, true);
});

test('los estados de pago se actualizan a seña y pagado', async () => {
  const seen: string[] = [];
  let amountPaid = 0;
  db.booking.findUnique = async ({ where }: any) => ({ id: where.id, priceTotal: 20000, amountPaid, paymentStatus: amountPaid ? 'PARTIAL' : 'PENDING', status: 'CONFIRMED' });
  db.$transaction = async (work: any) => work({
    booking: { update: async ({ data }: any) => { seen.push(data.paymentStatus); amountPaid = data.amountPaid; return { id: 8, priceTotal: 20000, ...data }; } },
    cashMovement: { create: async () => ({ id: 1 }) }
  });
  for (const paymentStatus of ['PARTIAL', 'PAID']) {
    const response = await fetch(`${baseUrl}/admin/bookings/8/payment`, {
      method: 'PATCH', headers: headers(token(2, 'ADMIN')),
      body: JSON.stringify({ paymentStatus, amountPaid: paymentStatus === 'PARTIAL' ? 5000 : undefined, paymentMethod: 'EFECTIVO', createCashMovement: true })
    });
    assert.equal(response.status, 200);
  }
  assert.deepEqual(seen, ['PARTIAL', 'PAID']);
});
