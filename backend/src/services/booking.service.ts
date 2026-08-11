import { BookingOrigin, BookingStatus, Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { prisma } from '../prisma/client.js';
import { businessIntervals, dayOfWeek, localDateTime } from '../utils/time.js';
import { HttpError } from '../utils/http-error.js';
import { config } from '../config.js';
import { hasBookingOverlap } from '../domain/booking-rules.js';
import { publishBookingChange } from '../realtime/events.js';

export type BookingInput = {
  courtId: number; userId?: number | null; clientName: string; clientPhone: string;
  date: string; startTime: string; durationMinutes: number; playersCount?: number;
  notes?: string; status?: BookingStatus; origin?: BookingOrigin; priceTotal?: number; adminOverride?: boolean;
  holdExpiresAt?: Date | null;
};

export const occupiedBookingStatuses: BookingStatus[] = ['PENDING', 'CONFIRMED', 'PLAYED', 'NO_SHOW', 'BLOCKED'];
const nonExpiringOccupiedStatuses: BookingStatus[] = ['CONFIRMED', 'PLAYED', 'NO_SHOW', 'BLOCKED'];
export const expiredPendingCancellationReason = 'Solicitud vencida sin confirmación por WhatsApp';
// TiDB admite READ COMMITTED y REPEATABLE READ, pero rechaza SERIALIZABLE.
// Mantenemos el nivel compatible más fuerte y los bloqueos FOR UPDATE del flujo.
export const bookingTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead
} as const;
const deadGapWarning = 'Este turno deja un espacio libre menor a 60 minutos. Probablemente no se venda.';
const gapIsDead = (minutes: number) => minutes > 0 && minutes < config.booking.minBookableMinutes;

export function pendingBookingExpiresAt(from = new Date()) {
  return new Date(from.getTime() + config.booking.pendingHoldMinutes * 60_000);
}

export async function expirePendingBookings(filter: { userId?: number; bookingId?: number } = {}, now = new Date()) {
  const where: Prisma.BookingWhereInput = {
    id: filter.bookingId,
    userId: filter.userId,
    status: 'PENDING',
    OR: [{ holdExpiresAt: { lte: now } }, { holdExpiresAt: null }]
  };
  const result = await prisma.booking.updateMany({
    where,
    data: { status: 'CANCELLED', cancelledAt: now, cancellationReason: expiredPendingCancellationReason }
  });
  if (result.count) {
    const expired = await prisma.booking.findMany({
      where: {
        id: filter.bookingId,
        userId: filter.userId,
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: expiredPendingCancellationReason
      },
      select: { id: true, courtId: true, userId: true, startTime: true, status: true, holdExpiresAt: true }
    });
    await Promise.all(expired.map(booking => publishBookingChange('BOOKING_CANCELLED', booking)));
  }
  return result;
}

function occupyingBookingFilter(now = new Date()): Prisma.BookingWhereInput {
  return {
    OR: [
      { status: { in: nonExpiringOccupiedStatuses } },
      { status: 'PENDING', holdExpiresAt: { gt: now } }
    ]
  };
}

function leavesDeadGap(start: DateTime, end: DateTime, open: DateTime, close: DateTime, bookings: { startTime: Date; endTime: Date }[]) {
  const before = bookings.filter(b => b.endTime <= start.toJSDate()).sort((a, b) => b.endTime.getTime() - a.endTime.getTime())[0];
  const after = bookings.filter(b => b.startTime >= end.toJSDate()).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
  const previousEnd = before ? DateTime.fromJSDate(before.endTime, { zone: config.timezone }) : open;
  const nextStart = after ? DateTime.fromJSDate(after.startTime, { zone: config.timezone }) : close;
  return gapIsDead(start.diff(previousEnd, 'minutes').minutes) || gapIsDead(nextStart.diff(end, 'minutes').minutes);
}

async function lockedBookingsInSchedule(tx: Prisma.TransactionClient, input: BookingInput, schedule: { open: DateTime; close: DateTime }, ignoreId?: number): Promise<Array<{ startTime: Date; endTime: Date }>> {
  const ignoreClause = ignoreId ? Prisma.sql`AND id <> ${ignoreId}` : Prisma.empty;
  const now = new Date();
  const client = tx as Prisma.TransactionClient & { $queryRaw?: Prisma.TransactionClient['$queryRaw'] };
  if (client.$queryRaw) {
    return client.$queryRaw<Array<{ startTime: Date; endTime: Date }>>(Prisma.sql`
      SELECT startTime, endTime
      FROM bookings
      WHERE courtId = ${input.courtId}
        ${ignoreClause}
        AND (
          status IN (${Prisma.join(nonExpiringOccupiedStatuses)})
          OR (status = 'PENDING' AND holdExpiresAt > ${now})
        )
        AND startTime < ${schedule.close.toJSDate()}
        AND endTime > ${schedule.open.toJSDate()}
      ORDER BY startTime
      FOR UPDATE
    `);
  }
  return (tx as any).booking.findMany({
    where: {
      id: ignoreId ? { not: ignoreId } : undefined,
      courtId: input.courtId,
      ...occupyingBookingFilter(now),
      startTime: { lt: schedule.close.toJSDate() },
      endTime: { gt: schedule.open.toJSDate() }
    },
    select: { startTime: true, endTime: true }
  });
}

async function validate(tx: Prisma.TransactionClient, input: BookingInput, ignoreId?: number) {
  const start = localDateTime(input.date, input.startTime);
  const end = start.plus({ minutes: input.durationMinutes });
  const [court, price, hours] = await Promise.all([
    tx.court.findFirst({ where: { active: true }, orderBy: { id: 'asc' } }),
    tx.price.findFirst({ where: { durationMinutes: input.durationMinutes, active: true } }),
    tx.businessHour.findUnique({ where: { dayOfWeek: dayOfWeek(input.date) } })
  ]);
  if (!court || court.id !== input.courtId) throw new HttpError(404, 'Cancha no encontrada');
  if (!price) throw new HttpError(400, 'Duración sin precio activo');
  if (!hours?.active) throw new HttpError(400, 'La cancha está cerrada ese día');

  if (start <= DateTime.now().setZone(config.timezone)) throw new HttpError(400, 'No se puede reservar un horario pasado');
  const schedules = businessIntervals(input.date, hours.openTime, hours.closeTime, hours.breakStartTime, hours.breakEndTime);
  const schedule = schedules.find(item => start >= item.open && end <= item.close);
  if (!schedule) throw new HttpError(400, 'El turno queda fuera del horario de apertura');
  const minutesFromOpening = start.diff(schedule.open, 'minutes').minutes;
  if (!Number.isInteger(minutesFromOpening) || minutesFromOpening % config.booking.slotStepMinutes !== 0) {
    throw new HttpError(400, `La hora de inicio debe respetar intervalos de ${config.booking.slotStepMinutes} minutos`);
  }

  const bookings = await lockedBookingsInSchedule(tx, input, schedule, ignoreId);
  if (hasBookingOverlap({ start: start.toJSDate(), end: end.toJSDate() }, bookings.map(b => ({ start: b.startTime, end: b.endTime })))) {
    throw new HttpError(409, 'Ese horario ya no está disponible. Elegí otro turno.');
  }
  if (config.booking.avoidDeadGaps && leavesDeadGap(start, end, schedule.open, schedule.close, bookings)
    && !(config.booking.allowAdminOverride && input.adminOverride)) {
    throw new HttpError(409, deadGapWarning, 'DEAD_GAP');
  }
  return { start, end, price };
}

export async function createBookingInTransaction(
  tx: Prisma.TransactionClient,
  input: BookingInput,
  createdBy: number,
  recurringId?: number
) {
  const { start, end, price } = await validate(tx, input);
  return tx.booking.create({
    data: {
      courtId: input.courtId, userId: input.userId, recurringId,
      clientName: input.clientName, clientPhone: input.clientPhone.replace(/\D/g, ''),
      startTime: start.toJSDate(), endTime: end.toJSDate(), durationMinutes: input.durationMinutes,
      playersCount: input.playersCount ?? 4, priceTotal: input.priceTotal ?? price.price, notes: input.notes,
      status: input.status ?? 'CONFIRMED', origin: input.origin ?? 'WEB', createdBy,
      holdExpiresAt: input.status === 'PENDING' ? input.holdExpiresAt ?? pendingBookingExpiresAt() : null
    },
    include: { court: true }
  });
}

export async function createBooking(input: BookingInput, createdBy: number, recurringId?: number) {
  return prisma.$transaction(
    tx => createBookingInTransaction(tx, input, createdBy, recurringId),
    bookingTransactionOptions
  );
}

export async function availability(date: string, durationMinutes: number, courtId: number, ignoreBookingId?: number) {
  const requestedDay = dayOfWeek(date);
  const [hours, price] = await Promise.all([
    prisma.businessHour.findUnique({ where: { dayOfWeek: requestedDay } }),
    prisma.price.findFirst({ where: { durationMinutes, active: true } })
  ]);
  const baseLog = { date, durationMinutes, courtId, timezone: config.timezone, dayOfWeek: requestedDay, hours, hasPrice: Boolean(price) };
  if (!hours) {
    console.warn('[Availability] missing business hours', baseLog);
    return { date, durationMinutes, price: price ? Number(price.price) : null, reason: 'NO_BUSINESS_HOURS', message: 'No hay horarios de apertura configurados para ese día.', slots: [] };
  }
  if (!hours.active) {
    console.info('[Availability] court closed for requested day', baseLog);
    return { date, durationMinutes, price: price ? Number(price.price) : null, reason: 'CLOSED', message: 'La cancha está cerrada ese día.', slots: [] };
  }
  if (!price) {
    console.warn('[Availability] missing active price for duration', baseLog);
    return { date, durationMinutes, price: null, reason: 'NO_PRICE', message: 'No hay precio activo para esa duración.', slots: [] };
  }

  const schedules = businessIntervals(date, hours.openTime, hours.closeTime, hours.breakStartTime, hours.breakEndTime);
  const rangeOpen = schedules[0].open;
  const rangeClose = schedules[schedules.length - 1].close;
  const bookings = await prisma.booking.findMany({
    where: {
      id: ignoreBookingId ? { not: ignoreBookingId } : undefined,
      courtId,
      ...occupyingBookingFilter(),
      startTime: { lt: rangeClose.toJSDate() },
      endTime: { gt: rangeOpen.toJSDate() }
    },
    select: { id: true, status: true, startTime: true, endTime: true, holdExpiresAt: true }
  });

  const slots = [];
  for (const { open, close } of schedules) {
    const intervalBookings = bookings.filter(b => b.startTime < close.toJSDate() && b.endTime > open.toJSDate());
    for (let start = open; start.plus({ minutes: durationMinutes }) <= close; start = start.plus({ minutes: config.booking.slotStepMinutes })) {
      const end = start.plus({ minutes: durationMinutes });
      const past = start <= DateTime.now().setZone(config.timezone);
      const overlaps = hasBookingOverlap({ start: start.toJSDate(), end: end.toJSDate() }, intervalBookings.map(b => ({ start: b.startTime, end: b.endTime })));
      const deadGap = !past && !overlaps && config.booking.avoidDeadGaps && leavesDeadGap(start, end, open, close, intervalBookings);
      slots.push({
        startTime: start.toFormat('HH:mm'), endTime: end.toFormat('HH:mm'),
        available: !past && !overlaps && !deadGap,
        reason: past ? 'PAST' : overlaps ? 'OCCUPIED' : deadGap ? 'DEAD_GAP' : null,
        message: past ? 'El horario ya pasó' : deadGap ? 'No disponible para esta duración' : null
      });
    }
  }
  const availableCount = slots.filter(slot => slot.available).length;
  const summary = {
    ...baseLog,
    schedules: schedules.map(item => ({ open: item.open.toISO(), close: item.close.toISO() })),
    blockingStatuses: occupiedBookingStatuses,
    bookingsFound: bookings.length,
    bookings: bookings.map(item => ({ id: item.id, status: item.status, startTime: item.startTime, endTime: item.endTime })),
    totalSlots: slots.length,
    availableSlots: availableCount
  };
  if (availableCount === 0) console.warn('[Availability] no available slots', summary);
  else if (process.env.AVAILABILITY_DEBUG === '1') console.info('[Availability] slots generated', summary);
  const nextChangeAt = bookings
    .filter(booking => booking.status === 'PENDING' && booking.holdExpiresAt)
    .map(booking => booking.holdExpiresAt!)
    .sort((left, right) => left.getTime() - right.getTime())[0]?.toISOString() ?? null;
  return { date, durationMinutes, price: Number(price.price), config: config.booking, nextChangeAt, slots };
}
const durationLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return `${hours ? `${hours}h` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest}m` : ''}`;
};

export async function freeAvailability(date: string, courtId: number) {
  const [court, hours, prices] = await Promise.all([
    prisma.court.findFirst({ where: { id: courtId, active: true } }),
    prisma.businessHour.findUnique({ where: { dayOfWeek: dayOfWeek(date) } }),
    prisma.price.findMany({ where: { active: true, durationMinutes: { gte: config.booking.minBookableMinutes } }, orderBy: { durationMinutes: 'asc' } })
  ]);
  if (!court) throw new HttpError(404, 'Cancha no encontrada');
  if (!hours?.active || !prices.length) return [];

  const schedules = businessIntervals(date, hours.openTime, hours.closeTime, hours.breakStartTime, hours.breakEndTime);
  const rangeOpen = schedules[0].open;
  const rangeClose = schedules[schedules.length - 1].close;
  const bookings = await prisma.booking.findMany({
    where: { courtId, ...occupyingBookingFilter(), startTime: { lt: rangeClose.toJSDate() }, endTime: { gt: rangeOpen.toJSDate() } },
    select: { startTime: true, endTime: true },
    orderBy: { startTime: 'asc' }
  });

  return schedules.flatMap(({ open, close }) => {
    const merged = bookings
      .filter(b => b.startTime < close.toJSDate() && b.endTime > open.toJSDate())
      .map(b => ({
        start: DateTime.max(open, DateTime.fromJSDate(b.startTime, { zone: config.timezone })),
        end: DateTime.min(close, DateTime.fromJSDate(b.endTime, { zone: config.timezone }))
      }))
      .reduce<{ start: DateTime; end: DateTime }[]>((items, current) => {
        const last = items.at(-1);
        if (last && current.start <= last.end) {
          if (current.end > last.end) last.end = current.end;
        } else items.push(current);
        return items;
      }, []);

    const gaps: { start: DateTime; end: DateTime }[] = [];
    let cursor = open;
    for (const interval of merged) {
      if (interval.start > cursor) gaps.push({ start: cursor, end: interval.start });
      if (interval.end > cursor) cursor = interval.end;
    }
    if (cursor < close) gaps.push({ start: cursor, end: close });

    return gaps.map(gap => {
      const totalFreeMinutes = Math.round(gap.end.diff(gap.start, 'minutes').minutes);
      const availableDurations = prices.filter(price => {
        const remainder = totalFreeMinutes - price.durationMinutes;
        return remainder === 0 || remainder >= config.booking.minBookableMinutes;
      }).map(price => ({
        durationMinutes: price.durationMinutes, label: durationLabel(price.durationMinutes),
        startTime: gap.start.toFormat('HH:mm'),
        endTime: gap.start.plus({ minutes: price.durationMinutes }).toFormat('HH:mm'),
        priceTotal: Number(price.price)
      }));
      return {
        freeStart: gap.start.toFormat('HH:mm'), freeEnd: gap.end.toFormat('HH:mm'),
        totalFreeMinutes, availableDurations
      };
    }).filter(gap => gap.availableDurations.length > 0);
  });
}

export async function updateBooking(id: number, data: Partial<BookingInput>) {
  const old = await prisma.booking.findUnique({ where: { id } });
  if (!old) throw new HttpError(404, 'Turno no encontrado');
  const input: BookingInput = {
    courtId: data.courtId ?? old.courtId, userId: data.userId ?? old.userId,
    clientName: data.clientName ?? old.clientName, clientPhone: data.clientPhone ?? old.clientPhone,
    date: data.date ?? DateTime.fromJSDate(old.startTime, { zone: config.timezone }).toISODate()!,
    startTime: data.startTime ?? DateTime.fromJSDate(old.startTime, { zone: config.timezone }).toFormat('HH:mm'),
    durationMinutes: data.durationMinutes ?? old.durationMinutes,
    playersCount: data.playersCount ?? old.playersCount, notes: data.notes ?? old.notes ?? undefined,
    status: data.status ?? old.status, origin: data.origin ?? old.origin,
    priceTotal: data.priceTotal ?? Number(old.priceTotal)
  };
  return prisma.$transaction(async tx => {
    const { start, end, price } = await validate(tx, input, id);
    return tx.booking.update({
      where: { id },
      data: {
        courtId: input.courtId, userId: input.userId, clientName: input.clientName,
        clientPhone: input.clientPhone, startTime: start.toJSDate(), endTime: end.toJSDate(),
        durationMinutes: input.durationMinutes, playersCount: input.playersCount, notes: input.notes,
        status: input.status, origin: input.origin, priceTotal: input.priceTotal ?? price.price,
        holdExpiresAt: input.status === 'PENDING' ? old.holdExpiresAt ?? pendingBookingExpiresAt() : null
      }
    });
  }, bookingTransactionOptions);
}

const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PLAYED', 'NO_SHOW', 'CANCELLED'],
  PLAYED: [],
  CANCELLED: ['CONFIRMED', 'BLOCKED'],
  NO_SHOW: [],
  BLOCKED: ['CANCELLED']
};

export function canTransitionBookingStatus(from: BookingStatus, to: BookingStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

export async function transitionBookingStatus(id: number, status: BookingStatus) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw new HttpError(404, 'Turno no encontrado');
  if (booking.status === 'PENDING' && status === 'CONFIRMED'
    && (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date())) {
    await expirePendingBookings({ bookingId: id });
    throw new HttpError(409, 'La retención de este turno ya venció y el horario fue liberado.');
  }
  if (!canTransitionBookingStatus(booking.status, status)) {
    throw new HttpError(409, `No se puede cambiar un turno ${booking.status} a ${status}.`);
  }
  if (booking.status === status) return booking;
  if (booking.status === 'CANCELLED' && ['CONFIRMED', 'BLOCKED'].includes(status)) {
    return updateBooking(id, { status });
  }
  return prisma.booking.update({
    where: { id },
    data: {
      status,
      holdExpiresAt: status === 'CONFIRMED' ? null : booking.holdExpiresAt,
      cancelledAt: status === 'CANCELLED' ? new Date() : null,
      cancellationReason: status === 'CANCELLED' ? booking.cancellationReason : null
    }
  });
}
