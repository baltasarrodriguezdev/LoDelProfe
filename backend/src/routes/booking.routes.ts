import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { availability, bookingTransactionOptions, createBooking, expirePendingBookings } from '../services/booking.service.js';
import { prisma } from '../prisma/client.js';
import { HttpError } from '../utils/http-error.js';
import { localDateTime } from '../utils/time.js';
import { writeAudit } from '../services/audit.service.js';
import { publishBookingChange, publishUserChange } from '../realtime/events.js';
import { createHash, randomBytes } from 'node:crypto';
import { normalizeArgentinaPhone, localArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';
import { config } from '../config.js';
import { rateLimit } from '../middlewares/security.js';
import { DateTime } from 'luxon';

const hashCode = (value: string) => createHash('sha256').update(value.toUpperCase()).digest('hex');

const r = Router();
r.use(authenticate);

const requestSchema = z.object({
  courtId: z.number().int().positive(),
  date: z.string().date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().positive(),
  playersCount: z.number().int().min(1).max(12).default(4),
  notes: z.string().max(1000).optional(),
  phone: z.string().optional()
});

r.get('/requests/my', asyncHandler(async (req, res) => {
  await prisma.bookingRequest.updateMany({ where: { userId: req.auth!.userId, status: 'PENDING', startTime: { lte: new Date() } }, data: { status: 'EXPIRED' } });
  res.json(await prisma.bookingRequest.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'desc' }, take: 30 }));
}));

r.post('/requests/:id/resend', rateLimit({ windowMs: 60 * 60_000, max: 4, key: req => `${req.ip}:${req.auth?.userId}:resend` }), asyncHandler(async (req, res) => {
  if (!config.businessWhatsappPhone) throw new HttpError(503, 'La validación por WhatsApp no está configurada.');
  const request = await prisma.bookingRequest.findFirst({ where: { id: String(req.params.id), userId: req.auth!.userId, status: 'PENDING' }, include: { user: true } });
  if (!request || request.startTime <= new Date()) throw new HttpError(409, 'Esta solicitud ya no está vigente.');
  const local = DateTime.fromJSDate(request.startTime, { zone: config.timezone });
  const date = local.toISODate()!;
  const time = local.toFormat('HH:mm');
  const offered = await availability(date, request.durationMinutes, request.courtId);
  if (!offered.slots.some(slot => slot.startTime === time && slot.available)) {
    await prisma.bookingRequest.update({ where: { id: request.id }, data: { status: 'NEEDS_NEW_SLOT' } });
    throw new HttpError(409, 'Ese horario se ocupó. Elegí otro turno.');
  }
  const code = `VAL-${randomBytes(6).toString('hex').toUpperCase()}`;
  await prisma.bookingRequest.update({ where: { id: request.id }, data: { codeHash: hashCode(code), codeExpiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
  const message = `Hola, soy ${request.user.firstName} ${request.user.lastName}. Quiero validar mi teléfono y solicitar mi primer turno en Lo del Profe.\n\nTeléfono: ${request.phone}\nTurno: ${date} ${time}, ${request.durationMinutes} minutos\nSolicitud: ${request.id}\nCódigo: ${code}\n\nSé que el horario queda confirmado cuando la cancha lo apruebe.`;
  res.json({ whatsappUrl: `https://wa.me/${config.businessWhatsappPhone}?text=${encodeURIComponent(message)}` });
}));

r.post('/requests', rateLimit({ windowMs: 60 * 60_000, max: 6, key: req => `${req.ip}:${req.auth?.userId}` }), asyncHandler(async (req, res) => {
  const input = requestSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || !user.active || user.isBlocked) throw new HttpError(403, 'La cuenta no está habilitada.');
  if (!user.emailVerifiedAt) throw new HttpError(403, 'Confirmá tu email antes de solicitar un turno.');
  if (!config.businessWhatsappPhone) throw new HttpError(503, 'La validación por WhatsApp no está configurada. Comunicate con la cancha.');
  if (user.bookingApprovedAt && user.phone) throw new HttpError(409, 'Tu cuenta ya puede reservar directamente.');
  const e164 = normalizeArgentinaPhone(input.phone || user.phone || '');
  if (!e164) throw new HttpError(400, 'Ingresá un teléfono argentino válido.');
  const phone = localArgentinaPhone(e164);
  const owner = await prisma.user.findFirst({ where: { phone: { in: storedPhoneCandidates(e164) } } });
  if (owner && owner.id !== user.id) throw new HttpError(409, 'Ese teléfono ya está registrado. Ingresá con tu cuenta anterior o comunicate con la cancha.');
  const court = await prisma.court.findFirst({ where: { id: input.courtId, active: true } });
  if (!court) throw new HttpError(404, 'Cancha no encontrada.');
  const offered = await availability(input.date, input.durationMinutes, input.courtId);
  if (!offered.slots.some(slot => slot.startTime === input.startTime && slot.available)) throw new HttpError(409, 'El horario ya no está disponible. Elegí otro.');
  const startTime = localDateTime(input.date, input.startTime).toJSDate();
  const code = `VAL-${randomBytes(6).toString('hex').toUpperCase()}`;
  const data = {
    courtId: input.courtId, phone, startTime, durationMinutes: input.durationMinutes,
    playersCount: input.playersCount, notes: input.notes, priceQuoted: offered.price!,
    codeHash: hashCode(code), codeExpiresAt: new Date(Date.now() + 24 * 60 * 60_000)
  };
  const request = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`;
    await tx.user.update({ where: { id: user.id }, data: { phone, phoneVerified: false } });
    const active = await tx.bookingRequest.findFirst({ where: { userId: user.id, status: 'PENDING' } });
    if (active && active.startTime.getTime() !== startTime.getTime()) {
      await tx.bookingRequest.update({ where: { id: active.id }, data: { status: 'CANCELLED' } });
    }
    return active && active.startTime.getTime() === startTime.getTime()
      ? tx.bookingRequest.update({ where: { id: active.id }, data })
      : tx.bookingRequest.create({ data: { userId: user.id, ...data } });
  }, bookingTransactionOptions);
  const message = `Hola, soy ${user.firstName} ${user.lastName}. Quiero validar mi teléfono y solicitar mi primer turno en Lo del Profe.\n\nTeléfono: ${phone}\nTurno: ${input.date} ${input.startTime}, ${input.durationMinutes} minutos\nSolicitud: ${request.id}\nCódigo: ${code}\n\nSé que el horario queda confirmado cuando la cancha lo apruebe.`;
  const whatsappUrl = `https://wa.me/${config.businessWhatsappPhone}?text=${encodeURIComponent(message)}`;
  await publishUserChange('USER_UPDATED', user.id);
  if (config.webPush.enabled) {
    try {
      const { notifyPendingUser } = await import('../services/push-notification.service.js');
      await notifyPendingUser(user.id);
    } catch (error) {
      console.error('[web-push] la solicitud se guardó, pero no se pudo avisar al panel', error);
    }
  }
  res.status(201).json({ request, whatsappUrl });
}));

r.patch('/requests/:id/cancel', asyncHandler(async (req, res) => {
  const updated = await prisma.bookingRequest.updateMany({ where: { id: String(req.params.id), userId: req.auth!.userId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
  if (!updated.count) throw new HttpError(404, 'Solicitud no encontrada.');
  res.json({ message: 'Solicitud cancelada.' });
}));

const bookingSchema = z.object({
  courtId: z.number(),
  date: z.string().date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number(),
  playersCount: z.number().min(1).max(12).default(4),
  notes: z.string().max(1000).optional()
});

r.post('/', asyncHandler(async (req, res) => {
  const input = bookingSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  if (user.isBlocked) throw new HttpError(403, 'Tu cuenta está bloqueada. Comunicate con la cancha.');

  if (!user.emailVerifiedAt) throw new HttpError(403, 'Confirmá tu email antes de reservar.');
  if (!user.phone || !user.bookingApprovedAt) throw new HttpError(403, 'Tu teléfono debe ser aprobado antes de reservar.');

  const booking = await createBooking({
    ...input,
    userId: user.id,
    clientName: `${user.firstName} ${user.lastName}`,
    clientPhone: user.phone,
    status: 'CONFIRMED',
    holdExpiresAt: null,
    origin: 'WEB'
  }, user.id);
  await writeAudit({
    actorId: user.id,
    action: 'BOOKING_WEB_CREATED',
    entityType: 'BOOKING',
    entityId: booking.id
  });
  await publishBookingChange('BOOKING_CREATED', booking);

  res.status(201).json(booking);
}));

r.get('/my', asyncHandler(async (req, res) => {
  await expirePendingBookings({ userId: req.auth!.userId });
  res.json(await prisma.booking.findMany({
    where: { userId: req.auth!.userId, startTime: { gte: new Date() }, status: { not: 'CANCELLED' } },
    include: { court: true },
    orderBy: { startTime: 'asc' }
  }));
}));

r.get('/my/history', asyncHandler(async (req, res) => {
  await expirePendingBookings({ userId: req.auth!.userId });
  res.json(await prisma.booking.findMany({
    where: { userId: req.auth!.userId, OR: [{ startTime: { lt: new Date() } }, { status: 'CANCELLED' }] },
    include: { court: true },
    orderBy: { startTime: 'desc' }
  }));
}));

r.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const booking = await prisma.booking.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.startTime <= new Date()) {
    throw new HttpError(409, 'Solo se pueden cancelar turnos futuros pendientes o confirmados.');
  }
  if (booking.status === 'CONFIRMED') {
    const settings = await prisma.venueSetting.findUnique({ where: { id: 1 } });
    const cutoffMinutes = settings?.cancellationCutoffMinutes ?? 120;
    if (booking.startTime.getTime() - Date.now() < cutoffMinutes * 60_000) {
      throw new HttpError(409, `La cancelación online cierra ${cutoffMinutes} minutos antes del turno. Comunicate con la cancha.`);
    }
  }
  const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_CLIENT_CANCELLED', entityType: 'BOOKING', entityId: id });
  await publishBookingChange('BOOKING_CANCELLED', updated, booking);
  res.json(updated);
}));

export default r;
