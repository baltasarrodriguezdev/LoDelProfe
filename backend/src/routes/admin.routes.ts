import { Router } from 'express';
import bcrypt from 'bcrypt';
import {
  BookingOrigin,
  BookingStatus,
  CashCategory,
  CashType,
  PaymentStatus,
  Role,
  UserStatus
} from '@prisma/client';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { authenticate, authorize } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../prisma/client.js';
import { createBooking, updateBooking } from '../services/booking.service.js';
import { config } from '../config.js';
import { HttpError } from '../utils/http-error.js';
import { ARGENTINA_PHONE_ERROR, localArgentinaPhone, normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';

const r = Router();
r.use(authenticate, authorize(Role.ADMIN, Role.SUPERADMIN));

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
    user: { omit: { passwordHash: true } }
  } as const;
}

async function findReservation(id: number) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: reservationInclude()
  });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  return booking;
}

function assertPendingReservation(status: BookingStatus) {
  if (status !== 'PENDING') {
    throw new HttpError(409, 'Solo se pueden confirmar turnos pendientes.');
  }
}

r.get('/users', asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '');
  res.json(await prisma.user.findMany({
    where: search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { phone: { contains: search } }] } : {},
    omit: { passwordHash: true }
  }));
}));

r.get('/users/pending-verification', asyncHandler(async (_req, res) => {
  res.json(await prisma.user.findMany({
    where: { phoneVerified: false, isBlocked: false },
    omit: { passwordHash: true },
    include: { _count: { select: { bookings: { where: { status: 'PENDING' } } } } },
    orderBy: { createdAt: 'asc' }
  }));
}));

r.get('/users/:id', asyncHandler(async (req, res) => {
  res.json(await prisma.user.findUnique({ where: { id: +req.params.id }, omit: { passwordHash: true } }));
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
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
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
      isBlocked: false
    },
    omit: { passwordHash: true }
  });
  res.status(201).json(user);
}));

r.patch('/users/:id/verify', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  res.json(await prisma.user.update({
    where: { id: +req.params.id },
    data: { phoneVerified: true, status: UserStatus.VERIFIED },
    omit: { passwordHash: true }
  }));
}));

r.delete('/users/:id/pending-verification', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  if (user.role !== 'CLIENT') throw new HttpError(403, 'No se puede cancelar un usuario administrador.');
  if (user.phoneVerified) throw new HttpError(409, 'Solo se pueden cancelar usuarios pendientes de verificación.');

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

  res.json({ message: 'Usuario pendiente cancelado. El número quedó disponible.', ...result });
}));

r.patch('/users/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    active: z.boolean().optional(),
    phoneVerified: z.boolean().optional(),
    isBlocked: z.boolean().optional(),
    role: z.nativeEnum(Role).optional()
  }).parse(req.body);
  if (data.role && req.auth!.role !== Role.SUPERADMIN) throw new HttpError(403, 'Solo SUPERADMIN puede cambiar roles');
  const updateData = {
    ...data,
    status: data.phoneVerified === true ? UserStatus.VERIFIED : data.phoneVerified === false ? UserStatus.PENDING_VERIFICATION : undefined
  };
  res.json(await prisma.user.update({ where: { id: +req.params.id }, data: updateData, omit: { passwordHash: true } }));
}));

r.post('/courts', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({ name: z.string(), description: z.string().optional(), active: z.boolean().default(true) }).parse(req.body);
  res.status(201).json(await prisma.court.create({ data }));
}));

r.patch('/courts/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  res.json(await prisma.court.update({ where: { id: +req.params.id }, data: courtPatchSchema.parse(req.body) }));
}));

r.post('/prices', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = z.object({ durationMinutes: z.number(), price: z.number(), active: z.boolean().default(true) }).parse(req.body);
  res.status(201).json(await prisma.price.create({ data }));
}));

r.patch('/prices/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  res.json(await prisma.price.update({ where: { id: +req.params.id }, data: pricePatchSchema.parse(req.body) }));
}));

r.put('/business-hours', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const rows = z.array(z.object({
    dayOfWeek: z.number(),
    openTime: z.string(),
    closeTime: z.string(),
    active: z.boolean()
  })).parse(req.body);
  await prisma.$transaction(rows.map(item => prisma.businessHour.upsert({
    where: { dayOfWeek: item.dayOfWeek },
    update: item,
    create: item
  })));
  res.json(rows);
}));

r.get('/bookings', asyncHandler(async (req, res) => {
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
  const status = req.query.status ? z.nativeEnum(BookingStatus).parse(req.query.status) : undefined;
  res.json(await prisma.booking.findMany({
    where: { status },
    include: reservationInclude(),
    orderBy: { createdAt: 'asc' }
  }));
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
  res.status(201).json(await createBooking(bookingSchema.extend({ adminOverride: z.boolean().optional() }).parse(req.body), req.auth!.userId));
}));

r.post('/blocks', asyncHandler(async (req, res) => {
  const data = z.object({
    date: z.string().date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMinutes: z.number(),
    notes: z.string().optional()
  }).parse(req.body);
  res.status(201).json(await createBooking({
    courtId: 1,
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
  }, req.auth!.userId));
}));

r.patch('/bookings/:id', asyncHandler(async (req, res) => {
  res.json(await updateBooking(+req.params.id, bookingSchema.partial().extend({ adminOverride: z.boolean().optional() }).parse(req.body)));
}));

r.patch('/bookings/:id/status', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const status = z.nativeEnum(BookingStatus).parse(req.body.status);
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  if (booking.status === 'CANCELLED' && ['CONFIRMED', 'BLOCKED'].includes(status)) return res.json(await updateBooking(id, { status }));
  res.json(await prisma.booking.update({
    where: { id },
    data: { status, cancelledAt: status === 'CANCELLED' ? new Date() : undefined }
  }));
}));

r.patch('/reservations/:id/confirm', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const booking = await findReservation(id);
  assertPendingReservation(booking.status);
  res.json(await prisma.booking.update({
    where: { id },
    data: { status: 'CONFIRMED' },
    include: reservationInclude()
  }));
}));

r.patch('/reservations/:id/confirm-and-verify-user', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const booking = await findReservation(id);
  assertPendingReservation(booking.status);
  if (!booking.userId) throw new HttpError(409, 'El turno no tiene un usuario asociado para verificar.');

  const result = await prisma.$transaction(async tx => {
    const reservation = await tx.booking.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: reservationInclude()
    });
    const user = await tx.user.update({
      where: { id: booking.userId! },
      data: { phoneVerified: true, status: UserStatus.VERIFIED },
      omit: { passwordHash: true }
    });
    return { reservation, user };
  });
  res.json(result);
}));

r.patch('/reservations/:id/cancel', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const data = z.object({ cancellationReason: z.string().max(1000).optional() }).parse(req.body ?? {});
  const booking = await findReservation(id);
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new HttpError(409, 'Solo se pueden cancelar turnos pendientes o confirmados.');
  }
  res.json(await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: data.cancellationReason },
    include: reservationInclude()
  }));
}));

r.delete('/bookings/:id', asyncHandler(async (req, res) => {
  res.json(await prisma.booking.update({
    where: { id: +req.params.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() }
  }));
}));

r.delete('/bookings/:id/permanent', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  if (booking.status !== 'CANCELLED') throw new HttpError(409, 'Solo se pueden eliminar turnos cancelados');
  await prisma.$transaction([
    prisma.cashMovement.updateMany({ where: { bookingId: id }, data: { bookingId: null } }),
    prisma.booking.delete({ where: { id } })
  ]);
  res.json({ message: 'Turno eliminado del historial' });
}));

r.patch('/bookings/:id/payment', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const data = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus),
    paymentMethod: z.string().optional(),
    createCashMovement: z.boolean().default(false)
  }).parse(req.body);
  const booking = await prisma.$transaction(async tx => {
    const updated = await tx.booking.update({
      where: { id },
      data: { paymentStatus: data.paymentStatus, paymentMethod: data.paymentMethod }
    });
    if (data.paymentStatus === 'PAID' && data.createCashMovement && !await tx.cashMovement.findFirst({ where: { bookingId: id, category: 'TURNO' } })) {
      await tx.cashMovement.create({
        data: {
          type: 'INCOME',
          category: 'TURNO',
          amount: updated.priceTotal,
          description: `Pago turno #${id}`,
          bookingId: id,
          createdBy: req.auth!.userId
        }
      });
    }
    return updated;
  });
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

r.get('/recurring-bookings', authorize(Role.SUPERADMIN), asyncHandler(async (_req, res) => {
  res.json(await prisma.recurringBooking.findMany({ include: { court: true, _count: { select: { bookings: true } } } }));
}));

r.post('/recurring-bookings', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const data = recurringSchema.parse(req.body);
  const price = await prisma.price.findFirst({ where: { durationMinutes: data.durationMinutes, active: true } });
  if (!price) throw new HttpError(400, 'Duración sin precio');

  let cursor = DateTime.fromISO(data.startDate, { zone: config.timezone });
  const end = DateTime.fromISO(data.endDate, { zone: config.timezone });
  while (cursor.weekday % 7 !== data.dayOfWeek) cursor = cursor.plus({ days: 1 });
  const dates: string[] = [];
  while (cursor <= end) {
    dates.push(cursor.toISODate()!);
    cursor = cursor.plus({ weeks: 1 });
  }

  const recurring = await prisma.recurringBooking.create({
    data: { ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate), priceTotal: price.price, createdBy: req.auth!.userId }
  });

  try {
    for (const date of dates) await createBooking({ ...data, date, status: 'CONFIRMED', origin: 'MANUAL' }, req.auth!.userId, recurring.id);
  } catch (error) {
    await prisma.booking.deleteMany({ where: { recurringId: recurring.id } });
    await prisma.recurringBooking.delete({ where: { id: recurring.id } });
    throw error;
  }

  res.status(201).json(recurring);
}));

r.patch('/recurring-bookings/:id', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  res.json(await prisma.recurringBooking.update({ where: { id: +req.params.id }, data: recurringPatchSchema.parse(req.body) }));
}));

r.patch('/recurring-bookings/:id/deactivate', authorize(Role.SUPERADMIN), asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const recurring = await prisma.recurringBooking.findUnique({ where: { id } });
  if (!recurring) throw new HttpError(404, 'Turno fijo no encontrado');
  if (!recurring.active) return res.json({ message: 'El turno fijo ya estaba desactivado', cancelledBookings: 0 });
  const [, cancelled] = await prisma.$transaction([
    prisma.recurringBooking.update({ where: { id }, data: { active: false } }),
    prisma.booking.updateMany({ where: { recurringId: id, startTime: { gte: new Date() }, status: { in: ['CONFIRMED'] } }, data: { status: 'CANCELLED' } })
  ]);
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
    description: z.string(),
    bookingId: z.number().nullable().optional()
  }).parse(req.body);
  res.status(201).json(await prisma.cashMovement.create({ data: { ...data, createdBy: req.auth!.userId } }));
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
