import { BookingStatus, Role } from '@prisma/client';
import { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { config } from '../config.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { prisma } from '../prisma/client.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { businessIntervals } from '../utils/time.js';

const router = Router();
router.use(authenticate, authorize(Role.ADMIN, Role.SUPERADMIN));

const occupiedStatuses: BookingStatus[] = ['CONFIRMED', 'PLAYED', 'NO_SHOW'];
const reportableStatuses: BookingStatus[] = ['CONFIRMED', 'PLAYED', 'CANCELLED', 'NO_SHOW'];

const minutesBetween = (start: Date, end: Date, rangeStart: Date, rangeEnd: Date) => {
  const from = Math.max(start.getTime(), rangeStart.getTime());
  const to = Math.min(end.getTime(), rangeEnd.getTime());
  return Math.max(0, (to - from) / 60_000);
};

router.get('/dashboard', asyncHandler(async (req, res) => {
  const query = z.object({ from: z.string().date(), to: z.string().date() }).parse(req.query);
  const from = DateTime.fromISO(query.from, { zone: config.timezone }).startOf('day');
  const to = DateTime.fromISO(query.to, { zone: config.timezone }).endOf('day');
  if (to < from) throw new HttpError(400, 'El período es inválido');
  if (to.diff(from, 'days').days > 366) throw new HttpError(400, 'El período máximo es de 366 días');

  const [bookings, movements, businessHours, activeCourts, newClients] = await Promise.all([
    prisma.booking.findMany({
      where: { startTime: { lte: to.toJSDate() }, endTime: { gte: from.toJSDate() } },
      select: { id: true, startTime: true, endTime: true, durationMinutes: true, priceTotal: true, status: true, paymentStatus: true }
    }),
    prisma.cashMovement.findMany({ where: { createdAt: { gte: from.toJSDate(), lte: to.toJSDate() } }, select: { type: true, amount: true, createdAt: true } }),
    prisma.businessHour.findMany({ where: { active: true } }),
    prisma.court.count({ where: { active: true } }),
    prisma.user.count({ where: { role: 'CLIENT', createdAt: { gte: from.toJSDate(), lte: to.toJSDate() } } })
  ]);

  let grossCapacityMinutes = 0;
  const days: Array<{ date: string; bookings: number; income: number }> = [];
  for (let cursor = from.startOf('day'); cursor <= to.startOf('day'); cursor = cursor.plus({ days: 1 })) {
    const date = cursor.toISODate()!;
    const hours = businessHours.find(item => item.dayOfWeek === cursor.weekday % 7);
    if (hours) {
      const schedules = businessIntervals(date, hours.openTime, hours.closeTime);
      grossCapacityMinutes += schedules.reduce((total, schedule) => total + schedule.close.diff(schedule.open, 'minutes').minutes, 0) * activeCourts;
    }
    days.push({ date, bookings: 0, income: 0 });
  }

  const blockedMinutes = bookings.filter(item => item.status === 'BLOCKED')
    .reduce((total, item) => total + minutesBetween(item.startTime, item.endTime, from.toJSDate(), to.toJSDate()), 0);
  const occupiedMinutes = bookings.filter(item => occupiedStatuses.includes(item.status))
    .reduce((total, item) => total + minutesBetween(item.startTime, item.endTime, from.toJSDate(), to.toJSDate()), 0);
  const sellableMinutes = Math.max(0, grossCapacityMinutes - blockedMinutes);

  const reportableBookings = bookings.filter(item => reportableStatuses.includes(item.status));
  const activeBookings = reportableBookings.filter(item => item.status !== 'CANCELLED');
  const cancelledCount = reportableBookings.filter(item => item.status === 'CANCELLED').length;
  const noShowCount = reportableBookings.filter(item => item.status === 'NO_SHOW').length;

  for (const booking of activeBookings) {
    const key = DateTime.fromJSDate(booking.startTime, { zone: config.timezone }).toISODate();
    const day = days.find(item => item.date === key);
    if (day) day.bookings++;
  }

  let income = 0;
  let expense = 0;
  for (const movement of movements) {
    const amount = Number(movement.amount);
    if (movement.type === 'INCOME') income += amount;
    else expense += amount;
    if (movement.type === 'INCOME') {
      const key = DateTime.fromJSDate(movement.createdAt, { zone: config.timezone }).toISODate();
      const day = days.find(item => item.date === key);
      if (day) day.income += amount;
    }
  }

  const byStatus = reportableStatuses.map(status => ({ status, count: reportableBookings.filter(item => item.status === status).length }));
  const hourCounts = new Map<string, number>();
  const durationCounts = new Map<number, number>();
  for (const booking of activeBookings) {
    const hour = DateTime.fromJSDate(booking.startTime, { zone: config.timezone }).toFormat('HH:00');
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    durationCounts.set(booking.durationMinutes, (durationCounts.get(booking.durationMinutes) ?? 0) + 1);
  }

  res.json({
    period: { from: query.from, to: query.to },
    summary: {
      totalBookings: reportableBookings.length,
      activeBookings: activeBookings.length,
      occupancyRate: sellableMinutes ? Math.min(100, Math.round((occupiedMinutes / sellableMinutes) * 1000) / 10) : 0,
      cancelledCount,
      cancellationRate: reportableBookings.length ? Math.round((cancelledCount / reportableBookings.length) * 1000) / 10 : 0,
      noShowCount,
      blockedHours: Math.round((blockedMinutes / 60) * 10) / 10,
      newClients
    },
    finance: {
      income,
      expense,
      balance: income - expense,
      pendingPaymentCount: activeBookings.filter(item => item.paymentStatus === 'PENDING').length,
      pendingAmount: activeBookings.filter(item => item.paymentStatus === 'PENDING').reduce((total, item) => total + Number(item.priceTotal), 0),
      partialPaymentCount: activeBookings.filter(item => item.paymentStatus === 'PARTIAL').length
    },
    byDay: days,
    byStatus,
    popularHours: [...hourCounts.entries()].map(([hour, count]) => ({ hour, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    durations: [...durationCounts.entries()].map(([durationMinutes, count]) => ({ durationMinutes, count })).sort((a, b) => a.durationMinutes - b.durationMinutes)
  });
}));

export default router;
