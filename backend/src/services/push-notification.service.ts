import { createHash } from 'node:crypto';
import { Role } from '@prisma/client';
import webPush, { type PushSubscription as WebPushSubscription } from 'web-push';
import { DateTime } from 'luxon';
import { config } from '../config.js';
import { prisma } from '../prisma/client.js';

export type PushSubscriptionInput = WebPushSubscription;

export type AdminNotification = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

let configured = false;

function configureWebPush() {
  if (!config.webPush.enabled || configured) return config.webPush.enabled;
  webPush.setVapidDetails(config.webPush.subject, config.webPush.publicKey, config.webPush.privateKey);
  configured = true;
  return true;
}

function endpointHash(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex');
}

function localDateTime(value: Date) {
  return DateTime.fromJSDate(value, { zone: config.timezone });
}

export function buildBookingNotification(
  type: 'BOOKING_CREATED' | 'BOOKING_CANCELLED',
  booking: {
    id: number;
    clientName: string;
    startTime: Date;
    endTime: Date;
    status: string;
    cancellationReason?: string | null;
  }
): AdminNotification {
  const start = localDateTime(booking.startTime);
  const end = localDateTime(booking.endTime);
  const slot = `${start.toFormat('dd/MM')} · ${start.toFormat('HH:mm')} a ${end.toFormat('HH:mm')}`;
  const created = type === 'BOOKING_CREATED';
  const reason = booking.cancellationReason ? ` · ${booking.cancellationReason}` : '';
  return {
    title: created ? 'Nuevo turno reservado' : 'Turno cancelado',
    body: created
      ? `${booking.clientName} · ${slot} · ${booking.status === 'PENDING' ? 'Pendiente' : 'Confirmado'}`
      : `${booking.clientName} · ${slot} · Horario liberado${reason}`,
    tag: `booking-${booking.id}-${type.toLowerCase()}`,
    url: `/admin?date=${start.toISODate()}&booking=${booking.id}`
  };
}

export function buildPendingUserNotification(user: { id: number; firstName: string; lastName: string }): AdminNotification {
  return {
    title: 'Nuevo usuario pendiente',
    body: `${user.firstName} ${user.lastName} solicitó acceso. Tocá para revisarlo.`,
    tag: `pending-user-${user.id}`,
    url: '/admin/seguridad'
  };
}

export function pushPublicKey() {
  return config.webPush.enabled ? config.webPush.publicKey : null;
}

export async function savePushSubscription(userId: number, subscription: PushSubscriptionInput, userAgent?: string) {
  const hash = endpointHash(subscription.endpoint);
  return prisma.pushSubscription.upsert({
    where: { endpointHash: hash },
    create: {
      userId,
      endpoint: subscription.endpoint,
      endpointHash: hash,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 512) || null
    },
    update: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 512) || null,
      failureCount: 0
    },
    select: { id: true, createdAt: true, updatedAt: true }
  });
}

export async function removePushSubscription(userId: number, endpoint: string) {
  return prisma.pushSubscription.deleteMany({
    where: { userId, endpointHash: endpointHash(endpoint) }
  });
}

function webPushPayload(notification: AdminNotification) {
  return JSON.stringify({
    notification: {
      title: notification.title,
      body: notification.body,
      icon: '/assets/logos/lo-del-profe-stacked.png',
      badge: '/assets/logos/lo-del-profe-stacked.png',
      tag: notification.tag,
      renotify: true,
      silent: false,
      vibrate: [220, 100, 220],
      data: {
        url: notification.url,
        onActionClick: {
          default: { operation: 'navigateLastFocusedOrOpen', url: notification.url }
        }
      }
    }
  });
}

async function sendToAdminDevices(notification: AdminNotification) {
  if (!configureWebPush()) return;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: {
        role: { in: [Role.ADMIN, Role.SUPERADMIN] },
        active: true,
        isBlocked: false
      }
    }
  });
  if (!subscriptions.length) return;

  const payload = webPushPayload(notification);
  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      }, payload, { TTL: 300, urgency: 'high' });
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { failureCount: 0, lastSuccessAt: new Date() }
      });
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode ?? 0);
      if ([404, 410].includes(statusCode)) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        return;
      }
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { failureCount: { increment: 1 } }
      }).catch(() => undefined);
      console.error('[web-push] no se pudo entregar la notificación', {
        subscriptionId: subscription.id,
        statusCode: statusCode || undefined
      });
    }
  }));
}

export async function notifyBookingChange(type: 'BOOKING_CREATED' | 'BOOKING_CANCELLED', bookingId: number) {
  if (!config.webPush.enabled) return;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      clientName: true,
      startTime: true,
      endTime: true,
      status: true,
      cancellationReason: true
    }
  });
  if (!booking) return;
  await sendToAdminDevices(buildBookingNotification(type, booking));
}

export async function notifyPendingUser(userId: number) {
  if (!config.webPush.enabled) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, role: true, phoneVerified: true }
  });
  if (!user || user.role !== Role.CLIENT || user.phoneVerified) return;
  await sendToAdminDevices(buildPendingUserNotification(user));
}
