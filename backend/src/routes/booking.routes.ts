import { Router } from 'express';
import { z } from 'zod';
import { BookingStatus } from '@prisma/client';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';
import { createBooking } from '../services/booking.service.js';
import { whatsappConfirmation } from '../services/whatsapp-confirmation.service.js';
import { prisma } from '../prisma/client.js';
import { HttpError } from '../utils/http-error.js';

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

function withWhatsapp(booking: any) {
  if (booking.status !== 'PENDING_CONFIRMATION') return booking;
  return { ...booking, ...whatsappConfirmation(booking) };
}

r.post('/', asyncHandler(async (req, res) => {
  const input = bookingSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) throw new HttpError(404, 'Usuario no encontrado');
  if (user.isBlocked) throw new HttpError(403, 'Tu cuenta está bloqueada. Comunicate con la cancha.');

  const status: BookingStatus = user.phoneVerified ? 'CONFIRMED' : 'PENDING_CONFIRMATION';
  if (!user.phoneVerified) {
    const pending = await prisma.booking.findFirst({
      where: { userId: user.id, status: 'PENDING_CONFIRMATION', startTime: { gte: new Date() } }
    });
    if (pending) throw new HttpError(409, 'Ya tenés una reserva pendiente de confirmación por WhatsApp.');
  }

  const booking = await createBooking({
    ...input,
    userId: user.id,
    clientName: `${user.firstName} ${user.lastName}`,
    clientPhone: user.phone,
    status,
    origin: 'WEB'
  }, user.id);

  if (status === 'PENDING_CONFIRMATION') {
    return res.status(201).json({
      reservation: booking,
      requiresWhatsappConfirmation: true,
      ...whatsappConfirmation(booking),
      message: 'Tu turno quedó pendiente. Confirmalo por WhatsApp para que podamos aprobarlo.'
    });
  }

  res.status(201).json(booking);
}));

r.get('/my', asyncHandler(async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { userId: req.auth!.userId, startTime: { gte: new Date() }, status: { not: 'CANCELLED' } },
    include: { court: true },
    orderBy: { startTime: 'asc' }
  });
  res.json(bookings.map(withWhatsapp));
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
  res.json(await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } }));
}));

export default r;
