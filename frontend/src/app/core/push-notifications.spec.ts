import { BehaviorSubject, of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PushNotificationsService } from './push-notifications';

function subscription() {
  return {
    endpoint: 'https://push.example.test/device-123',
    toJSON: () => ({
      endpoint: 'https://push.example.test/device-123',
      expirationTime: null,
      keys: { p256dh: 'device-public-key', auth: 'device-auth-key' }
    }),
    unsubscribe: vi.fn(async () => true)
  } as unknown as PushSubscription;
}

function notificationPermission(value: NotificationPermission) {
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    value: { permission: value }
  });
}

describe('PushNotificationsService', () => {
  it('activa el dispositivo y guarda la suscripción en el backend', async () => {
    notificationPermission('default');
    const current = new BehaviorSubject<PushSubscription | null>(null);
    const created = subscription();
    const swPush = {
      isEnabled: true,
      subscription: current,
      notificationClicks: new Subject(),
      requestSubscription: vi.fn(async () => created)
    };
    const api = {
      get: vi.fn(() => of({ publicKey: 'server-public-key' })),
      post: vi.fn(() => of({ id: 1 })),
      deleteWithBody: vi.fn(() => of(null))
    };
    const service = new PushNotificationsService(swPush as any, api as any);
    await vi.waitFor(() => expect(service.status()).toBe('available'));

    await service.activate();

    expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'server-public-key' });
    expect(api.post).toHaveBeenCalledWith('/admin/push/subscriptions', created.toJSON());
    expect(service.status()).toBe('active');
  });

  it('reconoce y resincroniza una suscripción existente', async () => {
    notificationPermission('granted');
    const existing = subscription();
    const api = {
      get: vi.fn(),
      post: vi.fn(() => of({ id: 1 })),
      deleteWithBody: vi.fn(() => of(null))
    };
    const service = new PushNotificationsService({
      isEnabled: true,
      subscription: of(existing),
      notificationClicks: new Subject()
    } as any, api as any);

    await vi.waitFor(() => expect(service.status()).toBe('active'));
    expect(api.post).toHaveBeenCalledWith('/admin/push/subscriptions', existing.toJSON());
  });

  it('no intenta solicitar permiso cuando el navegador lo bloqueó', async () => {
    notificationPermission('denied');
    const requestSubscription = vi.fn();
    const service = new PushNotificationsService({
      isEnabled: true,
      subscription: of(null),
      notificationClicks: new Subject(),
      requestSubscription
    } as any, { get: vi.fn(), post: vi.fn() } as any);

    await vi.waitFor(() => expect(service.status()).toBe('blocked'));
    await service.activate();
    expect(requestSubscription).not.toHaveBeenCalled();
  });
});
