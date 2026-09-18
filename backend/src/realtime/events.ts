import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { config } from '../config.js';

export type RealtimeAudience = 'PUBLIC' | 'USER' | 'ADMIN';

export type RealtimeEventType =
  | 'AVAILABILITY_CHANGED'
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_STATUS_CHANGED'
  | 'BOOKING_PAYMENT_CHANGED'
  | 'SCHEDULE_BLOCKED'
  | 'SCHEDULE_UNBLOCKED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_VERIFICATION_CHANGED'
  | 'PASSWORD_RESET_CHANGED'
  | 'CONFIGURATION_CHANGED'
  | 'RECURRING_BOOKING_CHANGED'
  | 'CASH_MOVEMENT_CREATED'
  | 'LEAGUE_CHANGED';

export type RealtimeResource = {
  bookingId?: number;
  courtId?: number;
  date?: string;
  previousCourtId?: number;
  previousDate?: string;
  status?: string;
  leagueId?: number;
  leagueMatchId?: number;
  resource?: 'COURTS' | 'PRICES' | 'BUSINESS_HOURS' | 'BOOKING_POLICY' | 'USERS' | 'PASSWORD_RESETS' | 'RECURRING_BOOKINGS' | 'CASH' | 'LEAGUE';
  refreshAt?: string;
};

export type RealtimeEvent = {
  id: string;
  type: RealtimeEventType;
  occurredAt: string;
  resource: RealtimeResource;
};

export type RoutedRealtimeEvent = RealtimeEvent & {
  audience: RealtimeAudience;
  targetUserId?: number;
};

type EventInput = Omit<RoutedRealtimeEvent, 'id' | 'occurredAt'>;
type Listener = (event: RoutedRealtimeEvent) => void;
type BookingChange = {
  id: number;
  courtId: number;
  userId?: number | null;
  startTime: Date;
  status: string;
  holdExpiresAt?: Date | null;
};

const emitter = new EventEmitter();
export function subscribeRealtimeEvents(listener: Listener) {
  emitter.on('event', listener);
  return () => emitter.off('event', listener);
}

export async function publishRealtimeEvent(input: EventInput) {
  const event: RoutedRealtimeEvent = {
    ...input,
    id: randomUUID(),
    occurredAt: new Date().toISOString()
  };
  emitter.emit('event', event);
  return event;
}

function localDate(value: Date) {
  return DateTime.fromJSDate(value, { zone: config.timezone }).toISODate()!;
}

function bookingResource(booking: BookingChange, previous?: BookingChange): RealtimeResource {
  return {
    bookingId: booking.id,
    courtId: booking.courtId,
    date: localDate(booking.startTime),
    previousCourtId: previous && previous.courtId !== booking.courtId ? previous.courtId : undefined,
    previousDate: previous && localDate(previous.startTime) !== localDate(booking.startTime) ? localDate(previous.startTime) : undefined,
    status: booking.status,
    refreshAt: booking.status === 'PENDING' && booking.holdExpiresAt ? booking.holdExpiresAt.toISOString() : undefined
  };
}

export async function publishBookingChange(type: Extract<RealtimeEventType,
  'BOOKING_CREATED' | 'BOOKING_UPDATED' | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED' | 'BOOKING_STATUS_CHANGED' | 'BOOKING_PAYMENT_CHANGED' | 'SCHEDULE_BLOCKED' | 'SCHEDULE_UNBLOCKED'>,
booking: BookingChange, previous?: BookingChange) {
  const resource = bookingResource(booking, previous);
  const events: Promise<RealtimeEvent>[] = [
    publishRealtimeEvent({ audience: 'ADMIN', type, resource })
  ];
  if (type !== 'BOOKING_PAYMENT_CHANGED') {
    events.push(publishRealtimeEvent({ audience: 'PUBLIC', type: 'AVAILABILITY_CHANGED', resource }));
  }
  const userIds = new Set([booking.userId, previous?.userId].filter((userId): userId is number => Boolean(userId)));
  for (const userId of userIds) {
    events.push(publishRealtimeEvent({ audience: 'USER', targetUserId: userId, type, resource }));
  }
  await Promise.all(events);
  if (config.webPush.enabled && (type === 'BOOKING_CREATED' || type === 'BOOKING_CANCELLED')) {
    try {
      const { notifyBookingChange } = await import('../services/push-notification.service.js');
      await notifyBookingChange(type, booking.id);
    } catch (error) {
      console.error('[web-push] el evento se guardó pero no pudo generar el aviso', {
        bookingId: booking.id,
        type,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export async function publishUserChange(type: 'USER_CREATED' | 'USER_UPDATED' | 'USER_VERIFICATION_CHANGED', userId: number) {
  await Promise.all([
    publishRealtimeEvent({ audience: 'ADMIN', type, resource: { resource: 'USERS' } }),
    publishRealtimeEvent({ audience: 'USER', targetUserId: userId, type, resource: { resource: 'USERS' } })
  ]);
}

export async function publishConfigurationChange(resource: Extract<RealtimeResource['resource'], 'COURTS' | 'PRICES' | 'BUSINESS_HOURS' | 'BOOKING_POLICY'>) {
  await Promise.all([
    publishRealtimeEvent({ audience: 'PUBLIC', type: 'CONFIGURATION_CHANGED', resource: { resource } }),
    publishRealtimeEvent({ audience: 'ADMIN', type: 'CONFIGURATION_CHANGED', resource: { resource } })
  ]);
}

export async function publishAdminChange(type: Extract<RealtimeEventType, 'PASSWORD_RESET_CHANGED' | 'RECURRING_BOOKING_CHANGED' | 'CASH_MOVEMENT_CREATED'>, resource: RealtimeResource['resource']) {
  await publishRealtimeEvent({ audience: 'ADMIN', type, resource: { resource } });
}

export async function publishLeagueChange(leagueId: number, leagueMatchId?: number) {
  const resource: RealtimeResource = { resource: 'LEAGUE', leagueId, leagueMatchId };
  await Promise.all([
    publishRealtimeEvent({ audience: 'PUBLIC', type: 'LEAGUE_CHANGED', resource }),
    publishRealtimeEvent({ audience: 'ADMIN', type: 'LEAGUE_CHANGED', resource })
  ]);
}
