import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { createBooking } from '../services/booking.service.js';
import { prisma } from '../prisma/client.js';
import { HttpError } from '../utils/http-error.js';
import { localDateTime } from '../utils/time.js';
import { writeAudit } from '../services/audit.service.js';

const r = Router();
r.use(authenticate);

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

  const isVerified = user.phoneVerified === true;
  if (!isVerified) {
    const requestedStart = localDateTime(input.date, input.startTime).toJSDate();
    const samePending = await prisma.booking.findFirst({
      where: {
        userId: user.id,
        status: 'PENDING',
        courtId: input.courtId,
        startTime: requestedStart,
        durationMinutes: input.durationMinutes
      },
      include: { court: true },
      orderBy: { createdAt: 'desc' }
    });
    if (samePending) return res.status(200).json({ reservation: samePending, alreadyPending: true });

    const pending = await prisma.booking.findFirst({
      where: { userId: user.id, status: 'PENDING', startTime: { gte: new Date() } },
      include: { court: true },
      orderBy: { createdAt: 'desc' }
    });
    if (pending) {
      throw new HttpError(409, 'Ya tenés una solicitud pendiente de confirmación. Esperá la respuesta de la cancha antes de pedir otro turno.');
    }
  }

  const booking = await createBooking({
    ...input,
    userId: user.id,
    clientName: `${user.firstName} ${user.lastName}`,
    clientPhone: user.phone,
    status: isVerified ? 'CONFIRMED' : 'PENDING',
    origin: 'WEB'
  }, user.id);
  await writeAudit({
    actorId: user.id,
    action: isVerified ? 'BOOKING_WEB_CREATED' : 'BOOKING_REQUESTED',
    entityType: 'BOOKING',
    entityId: booking.id
  });

  res.status(201).json(isVerified ? booking : { reservation: booking, alreadyPending: false });
}));

r.get('/my', asyncHandler(async (req, res) => {
  res.json(await prisma.booking.findMany({
    where: { userId: req.auth!.userId, startTime: { gte: new Date() }, status: { not: 'CANCELLED' } },
    include: { court: true },
    orderBy: { startTime: 'asc' }
  }));
}));

r.get('/my/history', asyncHandler(async (req, res) => res.json(await prisma.booking.findMany({
  where: { userId: req.auth!.userId, OR: [{ startTime: { lt: new Date() } }, { status: 'CANCELLED' }] },
  include: { court: true },
  orderBy: { startTime: 'desc' }
}))));

r.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const id = +req.params.id;
  const booking = await prisma.booking.findFirst({ where: { id, userId: req.auth!.userId } });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  if (!['PENDING', 'CONFIRMED'].includes(booking.status) || booking.startTime <= new Date()) {
    throw new HttpError(409, 'Solo se pueden cancelar turnos futuros pendientes o confirmados.');
  }
  const settings = await prisma.venueSetting.findUnique({ where: { id: 1 } });
  const cutoffMinutes = settings?.cancellationCutoffMinutes ?? 120;
  if (booking.startTime.getTime() - Date.now() < cutoffMinutes * 60_000) {
    throw new HttpError(409, `La cancelación online cierra ${cutoffMinutes} minutos antes del turno. Comunicate con la cancha.`);
  }
  const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  await writeAudit({ actorId: req.auth!.userId, action: 'BOOKING_CLIENT_CANCELLED', entityType: 'BOOKING', entityId: id });
  res.json(updated);
}));

export default r;
