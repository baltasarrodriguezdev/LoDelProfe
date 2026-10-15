import { Router } from 'express';
import { z } from 'zod';
import { authenticateBot } from '../middlewares/bot-auth.js';
import { rateLimit } from '../middlewares/security.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import {
  botBookingResponse,
  cancelBotBooking,
  createBotBooking,
  defaultPlayersCount,
  getBotCustomer,
  listBotBookings
} from '../services/bot-booking.service.js';
import { publishBookingChange } from '../realtime/events.js';

const router = Router();
const botRateLimit = rateLimit({ windowMs: 60_000, max: 120 });
router.use(botRateLimit, authenticateBot);

const phone = z.string().trim().min(6).max(30);
const noControlCharacters = (value: string) => !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const createSchema = z.object({
  phone,
  name: z.string().trim().min(1).max(60).refine(noControlCharacters).optional(),
  date: z.string().date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().positive(),
  playersCount: z.number().int().min(1).max(12).default(defaultPlayersCount),
  idempotencyKey: z.string().trim().min(1).max(200).refine(noControlCharacters)
}).strict();

function parse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, 'Los datos enviados no son válidos.', 'VALIDATION_ERROR');
  return result.data;
}

router.get('/customer', asyncHandler(async (req, res) => {
  const query = parse(z.object({ phone }), req.query);
  res.json(await getBotCustomer(query.phone));
}));

router.get('/bookings', asyncHandler(async (req, res) => {
  const query = parse(z.object({ phone }), req.query);
  res.json(await listBotBookings(query.phone));
}));

router.post('/bookings', asyncHandler(async (req, res) => {
  const input = parse(createSchema, req.body);
  const result = await createBotBooking(input);
  if (!result.idempotentReplay) await publishBookingChange('BOOKING_CREATED', result.booking);
  res.status(result.idempotentReplay ? 200 : 201).json({
    ...botBookingResponse(result.booking),
    idempotentReplay: result.idempotentReplay
  });
}));

router.patch('/bookings/:id/cancel', asyncHandler(async (req, res) => {
  const id = parse(z.coerce.number().int().positive(), req.params.id);
  const input = parse(z.object({ phone }).strict(), req.body);
  const { previous, updated } = await cancelBotBooking(id, input.phone);
  await publishBookingChange('BOOKING_CANCELLED', updated, previous!);
  res.json({ id: updated.id, status: updated.status, message: 'La reserva fue cancelada.' });
}));

export default router;
