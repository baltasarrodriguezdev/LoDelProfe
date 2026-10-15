import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DateTime } from 'luxon';
import { config } from '../config.js';
import { prisma } from '../prisma/client.js';
import { localArgentinaPhone, normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';
import { HttpError } from '../utils/http-error.js';
import {
  cancelCustomerBooking,
  createBookingInTransaction,
  customerBookingStatus,
  defaultPlayersCount,
  holdForBookingStatus
} from './booking.service.js';
import { writeAudit } from './audit.service.js';

const ACTIVE_BOOKING_LIMIT = 2;
const DAILY_CREATION_LIMIT = 4;
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const botTransactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted } as const;

type BotPhone = { e164: string; local: string; candidates: string[]; hash: string };
type BotUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findFirst>>>;

export type BotCreateInput = {
  phone: string;
  name?: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  playersCount: number;
  idempotencyKey: string;
};

function parsePhone(input: string): BotPhone {
  const e164 = normalizeArgentinaPhone(input);
  if (!e164) throw new HttpError(400, 'El teléfono no es válido.', 'INVALID_PHONE');
  const local = localArgentinaPhone(e164);
  return { e164, local, candidates: storedPhoneCandidates(e164), hash: sha256(local) };
}

function customerWhere(phone: BotPhone, userId?: number | null): Prisma.BookingWhereInput {
  return {
    OR: [
      ...(userId ? [{ userId }] : []),
      { clientPhone: { in: phone.candidates } }
    ]
  };
}

function activeBookingWhere(phone: BotPhone, userId: number | null | undefined, now: Date): Prisma.BookingWhereInput {
  return {
    startTime: { gt: now },
    AND: [
      customerWhere(phone, userId),
      {
        OR: [
          { status: { in: ['CONFIRMED', 'PLAYED', 'NO_SHOW'] } },
          { status: 'PENDING', holdExpiresAt: { gt: now } }
        ]
      }
    ]
  };
}

async function findUser(phone: BotPhone) {
  return prisma.user.findFirst({ where: { phone: { in: phone.candidates } }, orderBy: { id: 'asc' } });
}

function responseBooking(booking: {
  id: number;
  status: string;
  startTime: Date;
  durationMinutes: number;
  priceTotal: Prisma.Decimal | number;
  holdExpiresAt?: Date | null;
}) {
  const localStart = DateTime.fromJSDate(booking.startTime, { zone: config.timezone });
  return {
    id: booking.id,
    status: booking.status,
    date: localStart.toISODate()!,
    startTime: localStart.toFormat('HH:mm'),
    durationMinutes: booking.durationMinutes,
    priceTotal: Number(booking.priceTotal),
    pendingApproval: booking.status === 'PENDING',
    holdExpiresAt: booking.status === 'PENDING' && booking.holdExpiresAt
      ? booking.holdExpiresAt.toISOString()
      : null
  };
}

function requestFingerprint(input: Omit<BotCreateInput, 'idempotencyKey' | 'phone' | 'name'>, phone: BotPhone, clientName: string) {
  return sha256(JSON.stringify({
    phone: phone.local,
    clientName,
    date: input.date,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    playersCount: input.playersCount
  }));
}

export async function getBotCustomer(inputPhone: string) {
  const phone = parsePhone(inputPhone);
  const user = await findUser(phone);
  return { exists: Boolean(user), firstName: user?.firstName ?? null };
}

export async function listBotBookings(inputPhone: string) {
  const phone = parsePhone(inputPhone);
  const user = await findUser(phone);
  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: activeBookingWhere(phone, user?.id, now),
    orderBy: { startTime: 'asc' }
  });
  return { bookings: bookings.map(responseBooking) };
}

export async function createBotBooking(input: BotCreateInput) {
  const phone = parsePhone(input.phone);
  const initialUser = await findUser(phone);
  const suppliedName = input.name?.trim() ?? '';
  if (!initialUser && !suppliedName) {
    throw new HttpError(400, 'El nombre es obligatorio para clientes sin cuenta.', 'NAME_REQUIRED');
  }
  const clientName = initialUser ? `${initialUser.firstName} ${initialUser.lastName}`.trim() : suppliedName;
  const keyHash = sha256(input.idempotencyKey);
  const requestHash = requestFingerprint(input, phone, clientName);

  try {
    const booking = await prisma.$transaction(async tx => {
      const request = await tx.botBookingRequest.create({ data: { keyHash, requestHash } });
      const user: BotUser | null = initialUser
        ? await tx.user.findUnique({ where: { id: initialUser.id } })
        : null;
      if (user?.isBlocked) throw new HttpError(403, 'La cuenta no puede realizar reservas.', 'CUSTOMER_BLOCKED');
      if (user && !user.active) throw new HttpError(403, 'La cuenta no está activa.', 'CUSTOMER_INACTIVE');

      const lockClient = tx as Prisma.TransactionClient & {
        $executeRaw?: Prisma.TransactionClient['$executeRaw'];
        $queryRaw?: Prisma.TransactionClient['$queryRaw'];
      };
      if (lockClient.$executeRaw && lockClient.$queryRaw) {
        await lockClient.$executeRaw(Prisma.sql`
          INSERT INTO bot_phone_locks (phoneHash, createdAt)
          VALUES (${phone.hash}, CURRENT_TIMESTAMP(3))
          ON DUPLICATE KEY UPDATE phoneHash = VALUES(phoneHash)
        `);
        await lockClient.$queryRaw(Prisma.sql`
          SELECT phoneHash FROM bot_phone_locks WHERE phoneHash = ${phone.hash} FOR UPDATE
        `);
      } else {
        await tx.botPhoneLock.upsert({
          where: { phoneHash: phone.hash },
          update: {},
          create: { phoneHash: phone.hash }
        });
      }

      const now = new Date();
      const localNow = DateTime.fromJSDate(now, { zone: config.timezone });
      const dayStart = localNow.startOf('day').toJSDate();
      const dayEnd = localNow.plus({ days: 1 }).startOf('day').toJSDate();
      const [activeCount, dailyCount] = await Promise.all([
        tx.booking.count({ where: activeBookingWhere(phone, user?.id, now) }),
        tx.botBookingRequest.count({
          where: {
            createdAt: { gte: dayStart, lt: dayEnd },
            booking: { is: { clientPhone: { in: phone.candidates } } }
          }
        })
      ]);
      if (activeCount >= ACTIVE_BOOKING_LIMIT) {
        throw new HttpError(
          409,
          `Ya alcanzaste el límite de ${ACTIVE_BOOKING_LIMIT} reservas futuras activas.`,
          'PHONE_ACTIVE_BOOKING_LIMIT'
        );
      }
      if (dailyCount >= DAILY_CREATION_LIMIT) {
        throw new HttpError(
          429,
          `Ya alcanzaste el límite de ${DAILY_CREATION_LIMIT} reservas creadas hoy.`,
          'PHONE_DAILY_BOOKING_LIMIT'
        );
      }

      const court = await tx.court.findFirst({ where: { active: true }, orderBy: { id: 'asc' } });
      if (!court) throw new HttpError(404, 'No hay una cancha activa configurada.', 'COURT_NOT_FOUND');

      if (user && !user.phoneVerified) {
        const activePending = await tx.booking.findFirst({
          where: {
            userId: user.id,
            status: 'PENDING',
            holdExpiresAt: { gt: now },
            startTime: { gt: now }
          }
        });
        if (activePending) {
          throw new HttpError(
            409,
            'Ya tenés una solicitud pendiente de confirmación.',
            'PENDING_BOOKING_EXISTS'
          );
        }
      }

      const status = customerBookingStatus(user, true);
      const created = await createBookingInTransaction(tx, {
        courtId: court.id,
        userId: user?.id ?? null,
        clientName,
        clientPhone: phone.local,
        date: input.date,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        playersCount: input.playersCount,
        status,
        holdExpiresAt: holdForBookingStatus(status, now),
        origin: 'WHATSAPP'
      }, null);
      await tx.botBookingRequest.update({ where: { id: request.id }, data: { bookingId: created.id } });
      await writeAudit({
        actorId: null,
        action: 'BOOKING_BOT_CREATED',
        entityType: 'BOOKING',
        entityId: created.id,
        details: { origin: 'WHATSAPP' }
      }, tx);
      return created;
    }, botTransactionOptions);
    return { booking, idempotentReplay: false };
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const existing = await prisma.botBookingRequest.findUnique({
      where: { keyHash },
      include: { booking: true }
    });
    if (!existing || existing.requestHash !== requestHash) {
      throw new HttpError(409, 'La clave de idempotencia ya fue utilizada con otros datos.', 'IDEMPOTENCY_KEY_REUSED');
    }
    if (!existing.booking) {
      throw new HttpError(409, 'La solicitud todavía se está procesando.', 'IDEMPOTENCY_IN_PROGRESS');
    }
    return { booking: existing.booking, idempotentReplay: true };
  }
}

export async function cancelBotBooking(id: number, inputPhone: string) {
  const phone = parsePhone(inputPhone);
  const user = await findUser(phone);
  const result = await cancelCustomerBooking({ id, AND: [customerWhere(phone, user?.id)] });
  await writeAudit({
    actorId: null,
    action: 'BOOKING_BOT_CANCELLED',
    entityType: 'BOOKING',
    entityId: id,
    details: { origin: 'WHATSAPP' }
  });
  return result;
}

export const botBookingResponse = responseBooking;
export { defaultPlayersCount };
