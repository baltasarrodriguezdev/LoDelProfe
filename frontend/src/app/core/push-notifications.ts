import { Injectable, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { Api } from './api';

export type PushNotificationStatus =
  | 'checking'
  | 'available'
  | 'subscribing'
  | 'active'
  | 'unsubscribing'
  | 'blocked'
  | 'unsupported'
  | 'unconfigured'
  | 'error';

@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  readonly status = signal<PushNotificationStatus>('checking');
  readonly error = signal('');

  constructor(private readonly swPush: SwPush, private readonly api: Api) {
    this.swPush.notificationClicks.subscribe(event => {
      const url = String(event.notification.data?.['url'] ?? '');
      if (url.startsWith('/admin')) window.location.assign(url);
    });
    void this.initialize();
  }

  async activate() {
    if (!this.swPush.isEnabled) {
      this.status.set('unsupported');
      return;
    }
    if (this.permission() === 'denied') {
      this.status.set('blocked');
      return;
    }

    this.status.set('subscribing');
    this.error.set('');
    try {
      const { publicKey } = await firstValueFrom(this.api.get<{ publicKey: string }>('/admin/push/public-key', undefined, { noCache: true }));
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      await this.save(subscription);
      this.status.set('active');
    } catch (error: any) {
      const message = error?.error?.message ?? error?.message ?? 'No se pudieron activar las notificaciones.';
      if (this.permission() === 'denied') this.status.set('blocked');
      else if (error?.status === 503) this.status.set('unconfigured');
      else this.status.set('error');
      this.error.set(message);
    }
  }

  async deactivate() {
    this.status.set('unsubscribing');
    this.error.set('');
    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      if (subscription) {
        await firstValueFrom(this.api.deleteWithBody('/admin/push/subscriptions', { endpoint: subscription.endpoint }));
        await subscription.unsubscribe();
      }
      this.status.set('available');
    } catch (error: any) {
      this.status.set('error');
      this.error.set(error?.error?.message ?? error?.message ?? 'No se pudieron desactivar las notificaciones.');
    }
  }

  private async initialize() {
    if (!this.swPush.isEnabled || !('Notification' in window)) {
      this.status.set('unsupported');
      return;
    }
    if (this.permission() === 'denied') {
      this.status.set('blocked');
      return;
    }
    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      if (!subscription) {
        this.status.set('available');
        return;
      }
      await this.save(subscription);
      this.status.set('active');
    } catch (error: any) {
      if (error?.status === 503) this.status.set('unconfigured');
      else this.status.set('error');
      this.error.set(error?.error?.message ?? error?.message ?? 'No se pudo comprobar la suscripción del dispositivo.');
    }
  }

  private async save(subscription: PushSubscription) {
    const serialized = subscription.toJSON();
    if (!serialized.endpoint || !serialized.keys?.['p256dh'] || !serialized.keys?.['auth']) {
      throw new Error('El navegador devolvió una suscripción incompleta.');
    }
    await firstValueFrom(this.api.post('/admin/push/subscriptions', serialized));
  }

  private permission(): NotificationPermission {
    return Notification.permission;
  }
}
