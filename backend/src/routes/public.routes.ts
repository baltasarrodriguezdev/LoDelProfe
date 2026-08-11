import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import { availability, freeAvailability } from '../services/booking.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { config } from '../config.js';

const router = Router();

router.get('/courts', asyncHandler(async (_req, res) => {
  const courts = await prisma.court.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
  res.json(courts.slice(0, 1));
}));

router.get('/prices', asyncHandler(async (_req, res) => {
  const prices = await prisma.price.findMany({ where: { active: true }, orderBy: { durationMinutes: 'asc' } });
  res.json(prices.map(item => ({ ...item, price: Number(item.price) })));
}));

router.get('/business-hours', asyncHandler(async (_req, res) => {
  res.json(await prisma.businessHour.findMany({ orderBy: { dayOfWeek: 'asc' } }));
}));

router.get('/booking-policy', asyncHandler(async (_req, res) => {
  const settings = await prisma.venueSetting.findUnique({ where: { id: 1 } });
  res.json({
    cancellationCutoffMinutes: settings?.cancellationCutoffMinutes ?? 120,
    pendingHoldMinutes: config.booking.pendingHoldMinutes
  });
}));

router.get('/availability', asyncHandler(async (req, res) => {
  const data = z.object({
    date: z.string().date(),
    duration: z.coerce.number().int().positive(),
    courtId: z.coerce.number().int().positive()
  }).parse(req.query);
  res.json(await availability(data.date, data.duration, data.courtId));
}));

router.get('/availability/slots', asyncHandler(async (req, res) => {
  const data = z.object({
    date: z.string().date(),
    courtId: z.coerce.number().int().positive()
  }).parse(req.query);
  res.json(await freeAvailability(data.date, data.courtId));
}));

export default router;
