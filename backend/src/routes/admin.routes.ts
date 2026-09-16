import { Router } from 'express';
import bcrypt from 'bcrypt';
import { randomBytes, timingSafeEqual } from 'crypto';
import {
  BookingOrigin,
  BookingStatus,
  CashCategory,
  CashType,
  PaymentStatus,
  PhoneVerificationMethod,
  Role,
  UserStatus
} from '@prisma/client';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../prisma/client.js';
import {
  availability,
  bookingTransactionOptions,
  createBooking,
  createBookingInTransaction,
  expirePendingBookings,
  expiredPendingCancellationReason,
  transitionBookingStatus,
  updateBooking
} from '../services/booking.service.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { ARGENTINA_PHONE_ERROR, localArgentinaPhone, normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';
import { businessIntervals, localDateTime } from '../utils/time.js';
import * as passwordReset from '../services/password-reset.service.js';
import { writeAudit } from '../services/audit.service.js';
import {
  publishAdminChange,
  publishBookingChange,
  publishConfigurationChange,
  publishRealtimeEvent,
  publishUserChange,
  type RealtimeEventType
} from '../realtime/events.js';
import { onLinkedBookingCancelled, syncLeagueMatchFromBooking } from '../services/league.service.js';

const r = Router();
r.use(authenticate, authorize(Role.ADMIN, Role.SUPERADMIN));

function bookingEventForStatus(status: BookingStatus, previousStatus?: BookingStatus): Extract<RealtimeEventType,
  'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED' | 'BOOKING_STATUS_CHANGED' | 'SCHEDULE_BLOCKED' | 'SCHEDULE_UNBLOCKED'> {
  if (status === BookingStatus.CONFIRMED) return 'BOOKING_CONFIRMED';
  if (status === BookingStatus.BLOCKED) return 'SCHEDULE_BLOCKED';
  if (status === BookingStatus.CANCELLED && previousStatus === BookingStatus.BLOCKED) return 'SCHEDULE_UNBLOCKED';
  if (status === BookingStatus.CANCELLED) return 'BOOKING_CANCELLED';
  return 'BOOKING_STATUS_CHANGED';
}

async function publishRecurringInvalidation(courtId: number, userId?: number | null) {
  const resource = { resource: 'RECURRING_BOOKINGS' as const, courtId };
  await Promise.all([
    publishRealtimeEvent({ audience: 'PUBLIC', type: 'AVAILABILITY_CHANGED', resource }),
    publishRealtimeEvent({ audience: 'ADMIN', type: 'RECURRING_BOOKING_CHANGED', resource }),
    ...(userId ? [publishRealtimeEvent({ audience: 'USER' as const, targetUserId: userId, type: 'BOOKING_UPDATED' as const, resource })] : [])
  ]);
}

const manualVerificationSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal(PhoneVerificationMethod.WHATSAPP_MANUAL), senderPhone: z.string().min(6).max(30), code: z.string().trim().min(6).max(20) }),
  z.object({ method: z.literal(PhoneVerificationMethod.PHONE_CALL), confirmedIdentity: z.literal(true) }),
  z.object({ method: z.literal(PhoneVerificationMethod.IN_PERSON), confirmedIdentity: z.literal(true) })
]);

function sameText(left: string, right: string) {
  const a = Buffer.from(left.trim().toUpperCase());
  const b = Buffer.from(right.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

function approvalWhatsappUrl(user: { firstName: string; phone: string }) {
  const local = user.phone.replace(/\D/g, '').replace(/^549?/, '');
  const message = `Hola ${user.firstName}. Tu cuenta de Lo del Profe fue verificada. Ya podés ingresar y reservar turnos.`;
  return `https://wa.me/549${local}?text=${encodeURIComponent(message)}`;
}

async function verifyUserIdentity(client: any, userId: number, adminId: number, input: z.infer<typeof manualVerificationSchema>) {
  const user = await client.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  if (user.role !== Role.CLIENT) throw new HttpError(403, 'No se puede verificar un usuario administrador desde este flujo.');
  if (user.phoneVerified) throw new HttpError(409, 'El usuario ya está verificado.');
  if (user.isBlocked || !user.active) throw new HttpError(409, 'La cuenta está bloqueada o inactiva.');

  if (input.method === PhoneVerificationMethod.WHATSAPP_MANUAL) {
    const sender = normalizeArgentinaPhone(input.senderPhone);
    if (!sender || !storedPhoneCandidates(sender).includes(user.phone)) {
      throw new HttpError(400, 'El número remitente no coincide con el teléfono registrado.');
    }
    if (!user.verificationCode || !sameText(input.code, user.verificationCode)) {
      throw new HttpError(400, 'El código recibido no coincide con la solicitud del usuario.');
    }
  }

  const updated = await client.user.update({
    where: { id: userId },
    data: {
      phoneVerified: true,
      status: UserStatus.VERIFIED,
      phoneVerifiedAt: new Date(),
      phoneVerifiedById: adminId,
      phoneVerificationMethod: input.method,
      verificationCode: null
    },
    omit: { passwordHash: true, securityVersion: true }
  });
  await writeAudit({
    actorId: adminId,
    action: 'USER_VERIFIED',
    entityType: 'USER',
    entityId: userId,
    details: { method: input.method }
  }, client);
  return { user: updated, approvalWhatsappUrl: approvalWhatsappUrl(updated) };
}

r.get('/password-reset-requests', authorize(Role.SUPERADMIN), asyncHandler(async (_req, res) => {
  res.json(await passwordReset.listPendingPasswordResets());
}));

r.patch('/password-reset-requests/:id/authorize', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  res.json(await passwordReset.authorizePasswordReset(String(req.params.id), req.auth!.userId));
}));

r.delete('/password-reset-requests/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  res.json(await passwordReset.cancelPasswordReset(String(req.params.id)));
}));

const bookingSchema = z.object({
  courtId: z.number(),
  userId: z.number().nullable().optional(),
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z.string().trim().min(6).max(30),
  date: z.string().date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(1).max(240),
  playersCount: z.number().int().min(0).max(12).default(4),
  notes: z.string().max(1000).optional(),
  status: z.nativeEnum(BookingStatus).optional(),
  origin: z.nativeEnum(BookingOrigin).optional(),
  priceTotal: z.number().positive().optional()
}).strict();
const courtPatchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().max(1000).nullable().optional(),
  active: z.boolean().optional()
}).strict();
const pricePatchSchema = z.object({
  durationMinutes: z.number().int().min(1).max(240).optional(),
  price: z.number().positive().optional(),
  active: z.boolean().optional()
}).strict();
const recurringPatchSchema = z.object({
  clientName: z.string().trim().min(2).max(120).optional(),
  clientPhone: z.string().trim().min(6).max(30).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  durationMinutes: z.number().int().min(1).max(240).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  active: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional()
}).strict();

function reservationInclude() {
  return {
    court: true,
    user: { omit: { passwordHash: true, securityVersion: true } }
  } as const;
}

async function findReservation(id: number) {
  await expirePendingBookings({ bookingId: id });
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: reservationInclude()
  });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  return booking;
}

function assertPendingReservation(booking: { status: BookingStatus; cancellationReason: string | null; holdExpiresAt: Date | null }) {
  if (booking.status !== 'PENDING') {
    if (booking.status === 'CANCELLED' && booking.cancellationReason === expiredPendingCancellationReason) {
      throw new HttpError(409, 'La retención de este turno ya venció y el horario fue liberado.');
    }
    throw new HttpError(409, 'Solo se pueden confirmar turnos pendientes.');
  }
  if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
    throw new HttpError(409, 'La retención de este turno ya venció y el horario fue liberado.');
  }
}

r.get('/users', asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '');
  res.json(await prisma.user.findMany({
    where: search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { phone: { contains: search } }] } : {},
    omit: { passwordHash: true, securityVersion: true }
  }));
}));

r.get('/users/pending-verification', asyncHandler(async (_req, res) => {
  await expirePendingBookings();
  res.json(await prisma.user.findMany({
    where: { role: Role.CLIENT, active: true, phoneVerified: false, isBlocked: false },
    omit: { passwordHash: true, securityVersion: true },
    include: { _count: { select: { bookings: { where: { status: 'PENDING' } } } } },
    orderBy: { createdAt: 'asc' }
  }));
}));

r.get('/users/:id', asyncHandler(async (req, res) => {
  res.json(await prisma.user.findUnique({ where: { id: +req.params.id }, omit: { passwordHash: true, securityVersion: true } }));
}));

r.post('/users', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({
    firstName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres'),
    lastName: z.string().trim().min(2, 'El apellido debe tener al menos 2 caracteres'),
    phone: z.string().transform((value, context) => {
      const normalized = normalizeArgentinaPhone(value);
      if (!normalized) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: ARGENTINA_PHONE_ERROR });
        return z.NEVER;
      }
      return normalized;
    }),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'La contraseña es demasiado larga')
  }).parse(req.body);
  if (await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(data.phone) } } })) {
    throw new HttpError(409, 'Ese teléfono ya está registrado');
  }
  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: localArgentinaPhone(data.phone),
      passwordHash: await bcrypt.hash(data.password, 12),
      role: Role.CLIENT,
      active: true,
      phoneVerified: false,
      status: UserStatus.PENDING_VERIFICATION,
      isBlocked: false,
      verificationCode: `VAL-${randomBytes(4).toString('hex').toUpperCase()}`
    },
    omit: { passwordHash: true, securityVersion: true }
  });
  await publishUserChange('USER_CREATED', user.id);
  res.status(201).json(user);
}));

r.patch('/users/:id/verify', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const result = await verifyUserIdentity(prisma, id, req.auth!.userId, manualVerificationSchema.parse(req.body));
  await publishUserChange('USER_VERIFICATION_CHANGED', id);
  res.json(result);
}));

r.delete('/users/:id/pending-verification', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  if (user.role !== 'CLIENT') throw new HttpError(403, 'No se puede cancelar un usuario administrador.');
  if (user.phoneVerified) throw new HttpError(409, 'Solo se pueden cancelar usuarios pendientes de verificación.');

  const affectedBookings = await prisma.booking.findMany({
    where: { userId: id, status: 'PENDING' },
    select: { id: true, courtId: true, userId: true, startTime: true, status: true, holdExpiresAt: true }
  });
  const result = await prisma.$transaction(async tx => {
    const cancelledBookings = await tx.booking.updateMany({
      where: { userId: id, status: 'PENDING' },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: 'Usuario pendiente cancelado por administración'
      }
    });
    await tx.user.delete({ where: { id } });
    return { cancelledBookings: cancelledBookings.count };
  });

  await Promise.all([
    publishUserChange('USER_UPDATED', id),
    ...affectedBookings.map(booking => publishBookingChange('BOOKING_CANCELLED', { ...booking, status: 'CANCELLED' }))
  ]);
  res.json({ message: 'Usuario pendiente cancelado. El número quedó disponible.', ...result });
}));

r.patch('/users/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    active: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
    role: z.nativeEnum(Role).optional()
  }).parse(req.body);
  if (data.role && req.auth!.role !== Role.SUPERADMIN) throw new HttpError(403, 'Solo SUPERADMIN puede cambiar roles');
  const id = +req.params.id;
  const updated = await prisma.user.update({ where: { id }, data, omit: { passwordHash: true, securityVersion: true } });
  await writeAudit({
    actorId: req.auth!.userId,
    action: data.active === false ? 'USER_DEACTIVATED'
      : data.active === true ? 'USER_REACTIVATED'
        : data.isBlocked === true ? 'USER_BLOCKED'
          : data.isBlocked === false ? 'USER_UNBLOCKED'
            : 'USER_UPDATED',
    entityType: 'USER',
    entityId: id,
    details: data
  });
  await publishUserChange('USER_UPDATED', id);
  res.json(updated);
}));

r.post('/users/:id/release-phone', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  if (id === req.auth!.userId) throw new HttpError(409, 'No podés liberar el teléfono de tu propia cuenta.');
  z.object({ confirmation: z.literal('LIBERAR') }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  if (user.role !== Role.CLIENT) throw new HttpError(403, 'Sólo se pueden cerrar cuentas de clientes.');
  if (user.releasedAt) throw new HttpError(409, 'El teléfono de esta cuenta ya fue liberado.');

  const released = await prisma.$transaction(async tx => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        firstName: 'Cliente',
        lastName: `liberado ${id}`,
        phone: `liberado-${id}-${Date.now()}`,
        passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
        active: false,
        isBlocked: true,
        phoneVerified: false,
        status: UserStatus.PENDING_VERIFICATION,
        verificationCode: null,
        phoneVerifiedAt: null,
        phoneVerifiedById: null,
        phoneVerificationMethod: null,
        releasedAt: new Date(),
        securityVersion: { increment: 1 }
      },
      omit: { passwordHash: true, securityVersion: true }
    });
    await tx.passwordResetRequest.updateMany({
      where: { userId: id, status: { in: ['PENDING', 'AUTHORIZED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), tokenHash: null }
    });
    await writeAudit({
      actorId: req.auth!.userId,
      action: 'USER_PHONE_RELEASED',
      entityType: 'USER',
      entityId: id,
      details: { preservedBookings: true }
    }, tx);
    return updated;
  });
  await publishUserChange('USER_UPDATED', id);
  res.json({ message: 'La cuenta fue cerrada y el número quedó disponible.', user: released });
}));

r.post('/courts', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({ name: z.string(), description: z.string().optional(), active: z.boolean().default(true) }).parse(req.body);
  if (data.active && await prisma.court.findFirst({ where: { active: true } })) {
    throw new HttpError(409, 'El sistema está configurado para una sola cancha activa.');
  }
  const court = await prisma.court.create({ data });
  await publishConfigurationChange('COURTS');
  res.status(201).json(court);
}));

r.patch('/courts/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const data = courtPatchSchema.parse(req.body);
  if (data.active && await prisma.court.findFirst({ where: { active: true, id: { not: id } } })) {
    throw new HttpError(409, 'Sólo puede existir una cancha activa.');
  }
  const court = await prisma.court.update({ where: { id }, data });
  await publishConfigurationChange('COURTS');
  res.json(court);
}));

r.post('/prices', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({ durationMinutes: z.number(), price: z.number(), active: z.boolean().default(true) }).parse(req.body);
  const price = await prisma.price.create({ data });
  await publishConfigurationChange('PRICES');
  res.status(201).json(price);
}));

r.patch('/prices/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const price = await prisma.price.update({ where: { id: +req.params.id }, data: pricePatchSchema.parse(req.body) });
  await publishConfigurationChange('PRICES');
  res.json(price);
}));

r.put('/business-hours', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usá un horario HH:mm válido');
  const rows = z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: time,
    closeTime: time,
    breakStartTime: time.nullable().optional(),
    breakEndTime: time.nullable().optional(),
    active: z.boolean()
  }).superRefine((row, context) => {
    if (row.openTime === row.closeTime) context.addIssue({ code: z.ZodIssueCode.custom, message: 'La apertura y el cierre no pueden ser iguales' });
    if (Boolean(row.breakStartTime) !== Boolean(row.breakEndTime)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Completá ambos horarios del descanso' });
  })).min(1).superRefine((value, context) => {
    if (new Set(value.map(item => item.dayOfWeek)).size !== value.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'No puede repetirse un día' });
    }
  }).parse(req.body);
  for (const row of rows) {
    if (row.active) businessIntervals('2030-01-01', row.openTime, row.closeTime, row.breakStartTime, row.breakEndTime);
  }
  await prisma.$transaction(rows.map(item => prisma.businessHour.upsert({
    where: { dayOfWeek: item.dayOfWeek },
    update: item,
    create: item
  })));
  await writeAudit({
    actorId: req.auth!.userId,
    action: 'BUSINESS_HOURS_UPDATED',
    entityType: 'VENUE',
    entityId: 1,
    details: { days: rows.length }
  });
  await publishConfigurationChange('BUSINESS_HOURS');
  res.json(rows);
}));

r.get('/booking-policy', authorize(Role.SUPERADMIN), asyncHandler(async (_req, res) => {
  const settings = await prisma.venueSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, cancellationCutoffMinutes: 120 }
  });
  res.json(settings);
}));

r.put('/booking-policy', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({
    cancellationCutoffMinutes: z.number().int().min(0).max(10080)
  }).strict().parse(req.body);
  const settings = await prisma.venueSetting.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data }
  });
  await writeAudit({
    actorId: req.auth!.userId,
    action: 'BOOKING_POLICY_UPDATED',
    entityType: 'VENUE',
    entityId: 1,
    details: data
  });
  await publishConfigurationChange('BOOKING_POLICY');
  res.json(settings);
}));

r.get('/audit-logs', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(200).default(100).parse(req.query.limit);
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  res.json(logs.map(item => ({ ...item, id: item.id.toString() })));
}));

r.get('/bookings', asyncHandler(async (req, res) => {
  await expirePendingBookings();
  const status = req.query.status ? z.nativeEnum(BookingStatus).parse(req.query.status) : undefined;
  res.json(await prisma.booking.findMany({
    where: {
      status,
      startTime: {
        gte: req.query.from ? new Date(String(req.query.from)) : undefined,
        lte: req.query.to ? new Date(String(req.query.to)) : undefined
      }
    },
    include: reservationInclude(),
    orderBy: { startTime: 'asc' }
  }));
}));

r.get('/reservations', asyncHandler(async (req, res) => {
  await expirePendingBookings();
  const status = req.query.status ? z.nativeEnum(BookingStatus).parse(req.query.status) : undefined;
  res.json(await prisma.booking.findMany({
    where: { status },
    include: reservationInclude(),
    orderBy: { createdAt: 'asc' }
  }));
}));

r.get('/availability', asyncHandler(async (req, res) => {
  const data = z.object({
    date: z.string().date(),
    duration: z.coerce.number().int().positive(),
    courtId: z.coerce.number().int().positive(),
    ignoreBookingId: z.coerce.number().int().positive().optional()
  }).parse(req.query);
  res.json(await availability(data.date, data.duration, data.courtId, data.ignoreBookingId));
}));

r.get('/bookings/:id', asyncHandler(async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: +req.params.id },
    include: reservationInclude()
  });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  const creator = await prisma.user.findUnique({
    where: { id: booking.createdBy },
    select: { id: true, firstName: true, lastName: true, role: true }
  });
  res.json({ ...booking, creator });
}));

r.post('/bookings', asyncHandler(async (req, res) => {
  const booking = await createBooking(bookingSchema.parse(req.body), req.auth!.userId);
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_CREATED', entityType: 'BOOKING', entityId: booking.id });
  await publishBookingChange('BOOKING_CREATED', booking);
  res.status(201).json(booking);
}));

r.post('/blocks', asyncHandler(async (req, res) => {
  const data = z.object({
    courtId: z.number().int().positive().optional(),
    date: z.string().date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMinutes: z.number(),
    notes: z.string().optional()
  }).parse(req.body);
  const court = data.courtId
    ? await prisma.court.findFirst({ where: { id: data.courtId, active: true } })
    : await prisma.court.findFirst({ where: { active: true }, orderBy: { id: 'asc' } });
  if (!court) throw new HttpError(409, 'No hay una cancha activa configurada.');
  const booking = await createBooking({
    courtId: court.id,
    clientName: 'Bloqueo',
    clientPhone: '',
    date: data.date,
    startTime: data.startTime,
    durationMinutes: data.durationMinutes,
    playersCount: 0,
    notes: data.notes,
    status: 'BLOCKED',
    origin: 'MANUAL',
    priceTotal: 0,
    adminOverride: true
  }, req.auth!.userId);
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_BLOCKED', entityType: 'BOOKING', entityId: booking.id });
  await publishBookingChange('SCHEDULE_BLOCKED', booking);
  res.status(201).json(booking);
}));

r.patch('/bookings/:id', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const previous = await prisma.booking.findUnique({ where: { id } });
  if (!previous) throw new HttpError(404, 'Turno no encontrado');
  const updated = await updateBooking(id, bookingSchema.partial().parse(req.body));
  await syncLeagueMatchFromBooking(id);
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_UPDATED', entityType: 'BOOKING', entityId: id });
  await publishBookingChange('BOOKING_UPDATED', updated, previous);
  res.json(updated);
}));

r.patch('/bookings/:id/status', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const status = z.nativeEnum(BookingStatus).parse(req.body.status);
  const previous = await prisma.booking.findUnique({ where: { id } });
  if (!previous) throw new HttpError(404, 'Turno no encontrado');
  const updated = await transitionBookingStatus(id, status);
  if (status === 'CANCELLED') await onLinkedBookingCancelled(id);
  await writeAudit({
    actorId: req.auth!.userId,
    action: `BOOKING_${status}`,
    entityType: 'BOOKING',
    entityId: id
  });
  await publishBookingChange(bookingEventForStatus(updated.status, previous.status), updated, previous);
  res.json(updated);
}));

r.patch('/reservations/:id/confirm', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const booking = await findReservation(id);
  assertPendingReservation(booking);
  const updated = await transitionBookingStatus(id, 'CONFIRMED');
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_CONFIRMED', entityType: 'BOOKING', entityId: id });
  await publishBookingChange('BOOKING_CONFIRMED', updated, booking);
  res.json(await findReservation(id));
}));

r.patch('/reservations/:id/confirm-and-verify-user', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const booking = await findReservation(id);
  assertPendingReservation(booking);
  if (!booking.userId) throw new HttpError(409, 'El turno no tiene un usuario asociado para verificar.');

  const verification = manualVerificationSchema.parse(req.body);
  const result = await prisma.$transaction(async tx => {
    const reservation = await tx.booking.update({
      where: { id },
      data: { status: 'CONFIRMED', holdExpiresAt: null },
      include: reservationInclude()
    });
    const verified = await verifyUserIdentity(tx, booking.userId!, req.auth!.userId, verification);
    return { reservation, ...verified };
  });
  await Promise.all([
    publishBookingChange('BOOKING_CONFIRMED', result.reservation, booking),
    publishUserChange('USER_VERIFICATION_CHANGED', booking.userId!)
  ]);
  res.json(result);
}));

r.patch('/reservations/:id/cancel', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const data = z.object({ cancellationReason: z.string().max(1000).optional() }).parse(req.body ?? {});
  const booking = await findReservation(id);
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new HttpError(409, 'Solo se pueden cancelar turnos pendientes o confirmados.');
  }
  const updated = await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: data.cancellationReason },
    include: reservationInclude()
  });
  await onLinkedBookingCancelled(id);
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_CANCELLED', entityType: 'BOOKING', entityId: id, details: data });
  await publishBookingChange('BOOKING_CANCELLED', updated, booking);
  res.json(updated);
}));

r.delete('/bookings/:id', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const previous = await prisma.booking.findUnique({ where: { id } });
  if (!previous) throw new HttpError(404, 'Turno no encontrado');
  const updated = await transitionBookingStatus(id, 'CANCELLED');
  await onLinkedBookingCancelled(id);
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_CANCELLED', entityType: 'BOOKING', entityId: id });
  await publishBookingChange(bookingEventForStatus(updated.status, previous.status), updated, previous);
  res.json(updated);
}));

r.delete('/bookings/:id/permanent', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  if (booking.status !== 'CANCELLED') throw new HttpError(409, 'Solo se pueden eliminar turnos cancelados');
  await prisma.$transaction([
    prisma.cashMovement.updateMany({ where: { bookingId: id }, data: { bookingId: null } }),
    prisma.booking.delete({ where: { id } })
  ]);
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_PERMANENTLY_DELETED', entityType: 'BOOKING', entityId: id });
  await publishBookingChange('BOOKING_UPDATED', booking);
  res.json({ message: 'Turno eliminado del historial' });
}));

r.patch('/bookings/:id/payment', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const data = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus),
    amountPaid: z.number().nonnegative().optional(),
    paymentMethod: z.string().trim().min(2).max(50).optional(),
    createCashMovement: z.boolean().default(false)
  }).strict().parse(req.body);
  const existing = await prisma.booking.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Turno no encontrado');
  if (['CANCELLED', 'BLOCKED'].includes(existing.status)) throw new HttpError(409, 'No se pueden registrar pagos en un turno cancelado o bloqueado.');
  const priceTotal = Number(existing.priceTotal);
  const previousPaid = Number(existing.amountPaid ?? (existing.paymentStatus === 'PAID' ? existing.priceTotal : 0));
  const amountPaid = data.paymentStatus === 'PENDING'
    ? 0
    : data.paymentStatus === 'PAID'
      ? priceTotal
      : data.amountPaid;
  if (amountPaid == null || !Number.isFinite(amountPaid)) throw new HttpError(400, 'Indicá el importe de la seña.');
  if (data.paymentStatus === 'PARTIAL' && (amountPaid <= 0 || amountPaid >= priceTotal)) {
    throw new HttpError(400, 'La seña debe ser mayor a cero y menor al total del turno.');
  }
  if (amountPaid < previousPaid) {
    throw new HttpError(409, 'Para reducir un cobro se necesita registrar una devolución.');
  }
  const delta = amountPaid - previousPaid;
  if (delta > 0 && !data.createCashMovement) {
    throw new HttpError(400, 'El cobro debe registrarse también en caja.');
  }

  const booking = await prisma.$transaction(async tx => {
    const updated = await tx.booking.update({
      where: { id },
      data: { paymentStatus: data.paymentStatus, amountPaid, paymentMethod: data.paymentMethod }
    });
    if (delta > 0) {
      await tx.cashMovement.create({
        data: {
          type: 'INCOME',
          category: 'TURNO',
          amount: delta,
          description: data.paymentStatus === 'PARTIAL' ? `Seña turno #${id}` : `Pago turno #${id}`,
          bookingId: id,
          createdBy: req.auth!.userId
        }
      });
    }
    await writeAudit({
      actorId: req.auth!.userId,
      action: data.paymentStatus === 'PARTIAL' ? 'BOOKING_DEPOSIT_RECORDED' : 'BOOKING_PAYMENT_RECORDED',
      entityType: 'BOOKING',
      entityId: id,
      details: { previousPaid, amountPaid, delta, paymentMethod: data.paymentMethod }
    }, tx);
    return updated;
  });
  await publishBookingChange('BOOKING_PAYMENT_CHANGED', booking, existing);
  if (delta > 0) await publishAdminChange('CASH_MOVEMENT_CREATED', 'CASH');
  res.json(booking);
}));

const recurringSchema = z.object({
  courtId: z.number(),
  userId: z.number().nullable().optional(),
  clientName: z.string().trim().min(2).max(120),
  clientPhone: z.string().trim().min(6).max(30),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(1).max(240),
  startDate: z.string().date(),
  endDate: z.string().date(),
  notes: z.string().max(1000).optional()
}).strict();

function datesForRecurring(data: z.infer<typeof recurringSchema>) {
  let cursor = DateTime.fromISO(data.startDate, { zone: config.timezone }).startOf('day');
  const end = DateTime.fromISO(data.endDate, { zone: config.timezone }).startOf('day');
  if (!cursor.isValid || !end.isValid || end < cursor) throw new HttpError(400, 'El rango de fechas del turno fijo es inválido.');
  if (end.diff(cursor, 'days').days > 366) throw new HttpError(400, 'Un turno fijo no puede abarcar más de 366 días.');
  while (cursor.weekday % 7 !== data.dayOfWeek) cursor = cursor.plus({ days: 1 });
  const dates: string[] = [];
  while (cursor <= end) {
    dates.push(cursor.toISODate()!);
    cursor = cursor.plus({ weeks: 1 });
  }
  if (!dates.length) throw new HttpError(400, 'El rango no contiene ninguna fecha para el día elegido.');
  return dates;
}

r.get('/recurring-bookings', authorize(Role.SUPERADMIN), asyncHandler(async (_req, res) => {
  res.json(await prisma.recurringBooking.findMany({ include: { court: true, _count: { select: { bookings: true } } } }));
}));

r.post('/recurring-bookings', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = recurringSchema.parse(req.body);
  const dates = datesForRecurring(data);
  const recurring = await prisma.$transaction(async tx => {
    const [price, court] = await Promise.all([
      tx.price.findFirst({ where: { durationMinutes: data.durationMinutes, active: true } }),
      tx.court.findFirst({ where: { id: data.courtId, active: true } })
    ]);
    if (!price) throw new HttpError(400, 'Duración sin precio');
    if (!court) throw new HttpError(400, 'La cancha seleccionada no está activa');
    const row = await tx.recurringBooking.create({
      data: { ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate), priceTotal: price.price, createdBy: req.auth!.userId }
    });
    for (const date of dates) {
      await createBookingInTransaction(tx, { ...data, date, status: 'CONFIRMED', origin: 'MANUAL' }, req.auth!.userId, row.id);
    }
    await writeAudit({
      actorId: req.auth!.userId,
      action: 'RECURRING_BOOKING_CREATED',
      entityType: 'RECURRING_BOOKING',
      entityId: row.id,
      details: { generatedBookings: dates.length }
    }, tx);
    return row;
  }, bookingTransactionOptions);
  await publishRecurringInvalidation(recurring.courtId, recurring.userId);
  res.status(201).json(recurring);
}));

r.patch('/recurring-bookings/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const patch = recurringPatchSchema.parse(req.body);
  const old = await prisma.recurringBooking.findUnique({ where: { id } });
  if (!old) throw new HttpError(404, 'Turno fijo no encontrado');
  const merged = recurringSchema.parse({
    courtId: old.courtId,
    userId: old.userId,
    clientName: patch.clientName ?? old.clientName,
    clientPhone: patch.clientPhone ?? old.clientPhone,
    dayOfWeek: patch.dayOfWeek ?? old.dayOfWeek,
    startTime: patch.startTime ?? old.startTime,
    durationMinutes: patch.durationMinutes ?? old.durationMinutes,
    startDate: patch.startDate ?? DateTime.fromJSDate(old.startDate, { zone: 'utc' }).toISODate(),
    endDate: patch.endDate ?? DateTime.fromJSDate(old.endDate, { zone: 'utc' }).toISODate(),
    notes: patch.notes ?? old.notes ?? undefined
  });
  const now = DateTime.now().setZone(config.timezone);
  const dates = datesForRecurring(merged).filter(date => localDateTime(date, merged.startTime) > now);
  const updated = await prisma.$transaction(async tx => {
    const price = await tx.price.findFirst({ where: { durationMinutes: merged.durationMinutes, active: true } });
    if (!price) throw new HttpError(400, 'Duración sin precio');
    await tx.booking.updateMany({
      where: { recurringId: id, startTime: { gte: now.toJSDate() }, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Serie de turno fijo modificada' }
    });
    const row = await tx.recurringBooking.update({
      where: { id },
      data: {
        ...patch,
        startDate: patch.startDate ? new Date(patch.startDate) : undefined,
        endDate: patch.endDate ? new Date(patch.endDate) : undefined,
        priceTotal: price.price
      }
    });
    if (row.active) {
      for (const date of dates) {
        await createBookingInTransaction(tx, { ...merged, date, status: 'CONFIRMED', origin: 'MANUAL' }, req.auth!.userId, id);
      }
    }
    await writeAudit({
      actorId: req.auth!.userId,
      action: 'RECURRING_BOOKING_UPDATED',
      entityType: 'RECURRING_BOOKING',
      entityId: id,
      details: { regeneratedBookings: row.active ? dates.length : 0 }
    }, tx);
    return row;
  }, bookingTransactionOptions);
  await publishRecurringInvalidation(updated.courtId, updated.userId);
  res.json(updated);
}));

r.patch('/recurring-bookings/:id/deactivate', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const recurring = await prisma.recurringBooking.findUnique({ where: { id } });
  if (!recurring) throw new HttpError(404, 'Turno fijo no encontrado');
  if (!recurring.active) return res.json({ message: 'El turno fijo ya estaba desactivado', cancelledBookings: 0 });
  const [, cancelled] = await prisma.$transaction([
    prisma.recurringBooking.update({ where: { id }, data: { active: false } }),
    prisma.booking.updateMany({
      where: { recurringId: id, startTime: { gte: new Date() }, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: 'Turno fijo desactivado' }
    })
  ]);
  await writeAudit({
    actorId: req.auth!.userId,
    action: 'RECURRING_BOOKING_DEACTIVATED',
    entityType: 'RECURRING_BOOKING',
    entityId: id,
    details: { cancelledBookings: cancelled.count }
  });
  await publishRecurringInvalidation(recurring.courtId, recurring.userId);
  res.json({ message: 'Turno fijo desactivado correctamente', cancelledBookings: cancelled.count });
}));

r.get('/cash-movements', authorize(Role.SUPERADMIN), asyncHandler(async (_req, res) => {
  res.json(await prisma.cashMovement.findMany({ orderBy: { createdAt: 'desc' } }));
}));

r.post('/cash-movements', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({
    type: z.nativeEnum(CashType),
    category: z.nativeEnum(CashCategory),
    amount: z.number().positive(),
    description: z.string().trim().min(2).max(200),
    bookingId: z.number().nullable().optional()
  }).parse(req.body);
  const movement = await prisma.cashMovement.create({ data: { ...data, createdBy: req.auth!.userId } });
  await writeAudit({
    actorId: req.auth!.userId,
    action: 'CASH_MOVEMENT_CREATED',
    entityType: 'CASH_MOVEMENT',
    entityId: movement.id,
    details: { type: data.type, category: data.category, amount: data.amount }
  });
  await publishAdminChange('CASH_MOVEMENT_CREATED', 'CASH');
  res.status(201).json(movement);
}));

for (const period of ['daily', 'weekly', 'monthly'] as const) {
  r.get(`/reports/${period}`, authorize(Role.SUPERADMIN), asyncHandler(async (_req, res) => {
    const now = DateTime.now().setZone(config.timezone);
    const start = period === 'daily' ? now.startOf('day') : period === 'weekly' ? now.startOf('week') : now.startOf('month');
    const end = period === 'daily' ? now.endOf('day') : period === 'weekly' ? now.endOf('week') : now.endOf('month');
    const rows = await prisma.cashMovement.findMany({ where: { createdAt: { gte: start.toJSDate(), lte: end.toJSDate() } } });
    const income = rows.filter(item => item.type === 'INCOME').reduce((total, item) => total + Number(item.amount), 0);
    const expense = rows.filter(item => item.type === 'EXPENSE').reduce((total, item) => total + Number(item.amount), 0);
    res.json({ period, income, expense, balance: income - expense });
  }));
}

export default r;
