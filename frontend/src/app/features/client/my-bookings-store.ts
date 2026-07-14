import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api, Auth } from '../../core/api';
import { AsyncStatus } from '../../shared/async-state';

export type ClientBooking = {
  id: number;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  playersCount: number;
  priceTotal: number;
  status: string;
};

@Injectable({ providedIn: 'root' })
export class MyBookingsStore {
  private api = inject(Api);
  private auth = inject(Auth);
  private bookingsRequestId = 0;
  private loaded = false;
  private loadedUserId: number | null = null;
  private inFlight: Promise<void> | null = null;

  readonly bookings = signal<ClientBooking[]>([]);
  readonly loadingBookings = signal(false);
  readonly bookingsError = signal('');
  readonly bookingsStatus = signal<AsyncStatus>('idle');

  readonly upcomingBookings = computed(() =>
    this.bookings().filter(booking => this.isUpcoming(booking))
  );

  readonly historyBookings = computed(() =>
    this.bookings().filter(booking => !this.isUpcoming(booking))
  );

  loadBookings(force = false) {
    const userId = this.auth.user()?.id ?? null;
    if (this.loaded && this.loadedUserId === userId && !force) return Promise.resolve();
    if (this.loadedUserId !== userId) {
      this.bookings.set([]);
      this.loaded = false;
    }
    if (this.inFlight && !force) return this.inFlight;

    const requestId = ++this.bookingsRequestId;
    const urls = ['/bookings/my', '/bookings/my/history'];
    console.log('[mis-turnos] inicio loadBookings');
    console.log('[mis-turnos] requestId', requestId);
    console.log('[mis-turnos] URL solicitada', urls);

    this.loadingBookings.set(true);
    this.bookingsStatus.set('loading');
    this.bookingsError.set('');

    this.inFlight = (async () => {
      try {
        const responses = await Promise.allSettled(
          urls.map(url => firstValueFrom(this.api.get<unknown>(url, undefined, { noCache: true })))
        );
        if (requestId !== this.bookingsRequestId) return;

        const normalizedBookings = responses.flatMap((response, index) => {
          if (response.status === 'fulfilled') {
            console.log('[mis-turnos] bookings response', response.value);
            return this.normalizeBookings(response.value);
          }
          console.error('[mis-turnos] bookings partial error', urls[index], response.reason);
          return [];
        });
        const dedupedBookings = this.dedupeBookings(normalizedBookings);
        console.log('[mis-turnos] respuesta normalizada', dedupedBookings);

        this.bookings.set(dedupedBookings);
        this.loaded = responses.some(response => response.status === 'fulfilled');
        this.loadedUserId = userId;
        if (this.loaded) this.bookingsStatus.set('success');
        else {
          this.bookingsError.set('No pudimos consultar tus turnos.');
          this.bookingsStatus.set('error');
        }
      } catch (error) {
        if (requestId !== this.bookingsRequestId) return;
        console.error('[mis-turnos] bookings error', error);
        this.bookings.set([]);
        this.bookingsError.set(this.errorMessage(error, 'No pudimos consultar tus turnos.'));
        this.bookingsStatus.set('error');
      } finally {
        if (requestId === this.bookingsRequestId) {
          this.loadingBookings.set(false);
          this.inFlight = null;
          console.log('[mis-turnos] loading false');
        }
      }
    })();

    return this.inFlight;
  }

  invalidate() {
    this.loaded = false;
    this.loadedUserId = null;
  }

  removeBooking(id: number) {
    this.bookings.set(this.bookings().filter(booking => booking.id !== id));
  }

  upsertBooking(value: unknown) {
    const booking = this.extractBooking(value);
    if (!booking) return;
    this.bookings.set(this.dedupeBookings([booking, ...this.bookings()]));
    this.loaded = false;
  }

  private extractBooking(value: unknown) {
    const candidate = (value as any)?.reservation ?? value;
    if (!candidate || typeof candidate !== 'object') return null;
    if ((candidate as ClientBooking).id == null || !(candidate as ClientBooking).startTime) return null;
    return candidate as ClientBooking;
  }

  private normalizeBookings(json: unknown) {
    const value = json as any;
    const normalizedBookings = Array.isArray(json)
      ? json
      : value?.bookings ?? value?.data?.bookings ?? [];
    return Array.isArray(normalizedBookings) ? normalizedBookings as ClientBooking[] : [];
  }

  private dedupeBookings(bookings: ClientBooking[]) {
    const byId = new Map<number, ClientBooking>();
    for (const booking of bookings) {
      if (booking?.id == null) continue;
      byId.set(Number(booking.id), booking);
    }
    return [...byId.values()].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  private isUpcoming(booking: ClientBooking) {
    if (['CANCELLED', 'PLAYED', 'NO_SHOW'].includes(booking.status)) return false;
    return new Date(booking.startTime).getTime() >= Date.now();
  }

  private errorMessage(error: unknown, fallback: string) {
    const value = error as any;
    if (typeof value?.error?.message === 'string') return value.error.message;
    if (typeof value?.message === 'string') return value.message;
    return fallback;
  }
}
