import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { config } from '../config.js';
import { prisma } from '../prisma/client.js';
import { localArgentinaPhone, normalizeArgentinaPhone } from '../utils/argentina-phone.js';
import { HttpError } from '../utils/http-error.js';
import { cancelCustomerBooking, createBookingInTransaction, defaultPlayersCount } from './booking.service.js';
import { writeAudit } from './audit.service.js';
import { resolveLinkedWhatsappUser } from './whatsapp-link.service.js';

const ACTIVE_BOOKING_LIMIT = 2;
const DAILY_CREATION_LIMIT = 4;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const botTransactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted } as const;

export type BotCreateInput = {
  senderPhone: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  playersCount: number;
  idempotencyKey: string;
};

function responseBooking(booking: {
  id: number; status: string; startTime: Date; durationMinutes: number;
  priceTotal: Prisma.Decimal | number; holdExpiresAt?: Date | null;
}) {
  const localStart = DateTime.fromJSDate(booking.startTime, { zone: config.timezone });
  return {
    id: booking.id,
    status: booking.status,
    date: localStart.toISODate()!,
    startTime: localStart.toFormat('HH:mm'),
    durationMinutes: booking.durationMinutes,
    priceTotal: Number(booking.priceTotal),
    pendingApproval: false,
    holdExpiresAt: null
  };
}

function requestFingerprint(input: Omit<BotCreateInput, 'idempotencyKey' | 'senderPhone'>, userId: number) {
  return sha256(JSON.stringify({ userId, ...input }));
}

export async function getBotCustomer(senderPhone: string) {
  const normalized = normalizeArgentinaPhone(senderPhone);
  if (!normalized) throw new HttpError(400, 'El remitente de WhatsApp no es válido.', 'INVALID_PHONE');
  const link = await prisma.whatsappLink.findUnique({ where: { phoneE164: normalized }, include: { user: true } });
  if (!link || link.revokedAt) {
    return { exists: false, linked: false, emailVerified: false, firstName: null, action: 'COMPLETE_REGISTRATION' };
  }
  return {
    exists: true,
    linked: true,
    emailVerified: Boolean(link.user.emailVerifiedAt),
    firstName: link.user.firstName,
    action: link.user.emailVerifiedAt ? null : 'VERIFY_EMAIL'
  };
}

export async function listBotBookings(senderPhone: string) {
  const { user } = await resolveLinkedWhatsappUser(senderPhone);
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      userId: user.id,
      startTime: { gt: now },
      OR: [
        { status: { in: ['CONFIRMED', 'PLAYED', 'NO_SHOW'] } },
        { status: 'PENDING', holdExpiresAt: { gt: now } }
      ]
    },
    orderBy: { startTime: 'asc' }
  });
  return { bookings: bookings.map(responseBooking) };
}

export async function createBotBooking(input: BotCreateInput) {
  const { phoneE164, user: initialUser } = await resolveLinkedWhatsappUser(input.senderPhone);
  const keyHash = sha256(input.idempotencyKey);
  const requestHash = requestFingerprint(input, initialUser.id);
  const phoneHash = sha256(phoneE164);

  try {
    const booking = await prisma.$transaction(async tx => {
      const request = await tx.botBookingRequest.create({ data: { keyHash, requestHash } });
      const user = await tx.user.findUnique({ where: { id: initialUser.id } });
      if (!user?.active) throw new HttpError(403, 'La cuenta no está activa.', 'CUSTOMER_INACTIVE');
      if (user.isBlocked) throw new HttpError(403, 'La cuenta está bloqueada.', 'CUSTOMER_BLOCKED');
      if (!user.emailVerifiedAt) throw new HttpError(403, 'Necesitás confirmar tu email antes de usar el bot.', 'EMAIL_NOT_VERIFIED');

      const lockClient = tx as Prisma.TransactionClient & {
        $executeRaw?: Prisma.TransactionClient['$executeRaw'];
        $queryRaw?: Prisma.TransactionClient['$queryRaw'];
      };
      if (lockClient.$executeRaw && lockClient.$queryRaw) {
        await lockClient.$executeRaw(Prisma.sql`
          INSERT INTO bot_phone_locks (phoneHash, createdAt)
          VALUES (${phoneHash}, CURRENT_TIMESTAMP(3))
          ON DUPLICATE KEY UPDATE phoneHash = VALUES(phoneHash)
        `);
        await lockClient.$queryRaw(Prisma.sql`SELECT phoneHash FROM bot_phone_locks WHERE phoneHash = ${phoneHash} FOR UPDATE`);
      } else {
        await tx.botPhoneLock.upsert({ where: { phoneHash }, update: {}, create: { phoneHash } });
      }

      const now = new Date();
      const localNow = DateTime.fromJSDate(now, { zone: config.timezone });
      const dayStart = localNow.startOf('day').toJSDate();
      const dayEnd = localNow.plus({ days: 1 }).startOf('day').toJSDate();
      const [activeCount, dailyCount] = await Promise.all([
        tx.booking.count({
          where: {
            userId: user.id,
            startTime: { gt: now },
            OR: [
              { status: { in: ['CONFIRMED', 'PLAYED', 'NO_SHOW'] } },
              { status: 'PENDING', holdExpiresAt: { gt: now } }
            ]
          }
        }),
        tx.botBookingRequest.count({
          where: { createdAt: { gte: dayStart, lt: dayEnd }, booking: { is: { userId: user.id } } }
        })
      ]);
      if (activeCount >= ACTIVE_BOOKING_LIMIT) {
        throw new HttpError(409, `Ya alcanzaste el límite de ${ACTIVE_BOOKING_LIMIT} reservas futuras activas.`, 'PHONE_ACTIVE_BOOKING_LIMIT');
      }
      if (dailyCount >= DAILY_CREATION_LIMIT) {
        throw new HttpError(429, `Ya alcanzaste el límite de ${DAILY_CREATION_LIMIT} reservas creadas hoy.`, 'PHONE_DAILY_BOOKING_LIMIT');
      }

      const court = await tx.court.findFirst({ where: { active: true }, orderBy: { id: 'asc' } });
      if (!court) throw new HttpError(404, 'No hay una cancha activa configurada.', 'COURT_NOT_FOUND');
      const created = await createBookingInTransaction(tx, {
        courtId: court.id,
        userId: user.id,
        clientName: `${user.firstName} ${user.lastName}`.trim(),
        clientPhone: localArgentinaPhone(phoneE164),
        date: input.date,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        playersCount: input.playersCount,
        status: 'CONFIRMED',
        holdExpiresAt: null,
        origin: 'WHATSAPP'
      }, null);
      await tx.botBookingRequest.update({ where: { id: request.id }, data: { bookingId: created.id } });
      await writeAudit({ actorId: null, action: 'BOOKING_BOT_CREATED', entityType: 'BOOKING', entityId: created.id, details: { origin: 'WHATSAPP', userId: user.id } }, tx);
      return created;
    }, botTransactionOptions);
    return { booking, idempotentReplay: false };
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const existing = await prisma.botBookingRequest.findUnique({ where: { keyHash }, include: { booking: true } });
    if (!existing || existing.requestHash !== requestHash) {
      throw new HttpError(409, 'La clave de idempotencia ya fue utilizada con otros datos.', 'IDEMPOTENCY_KEY_REUSED');
    }
    if (!existing.booking) throw new HttpError(409, 'La solicitud todavía se está procesando.', 'IDEMPOTENCY_IN_PROGRESS');
    return { booking: existing.booking, idempotentReplay: true };
  }
}

export async function cancelBotBooking(id: number, senderPhone: string) {
  const { user } = await resolveLinkedWhatsappUser(senderPhone);
  const result = await cancelCustomerBooking({ id, userId: user.id });
  await writeAudit({ actorId: null, action: 'BOOKING_BOT_CANCELLED', entityType: 'BOOKING', entityId: id, details: { origin: 'WHATSAPP', userId: user.id } });
  return result;
}

export const botBookingResponse = responseBooking;
export { defaultPlayersCount };
