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
  private loadedSessionRevision: number | null = null;
  private inFlight: Promise<void> | null = null;
  private requestAbort: AbortController | null = null;

  readonly bookings = signal<ClientBooking[]>([]);
  readonly bookingsError = signal('');
  readonly bookingsStatus = signal<AsyncStatus>('idle');
  readonly loadingBookings = computed(() => this.bookingsStatus() === 'loading');

  readonly upcomingBookings = computed(() =>
    this.bookings().filter(booking => this.isUpcoming(booking))
  );

  readonly historyBookings = computed(() =>
    this.bookings().filter(booking => !this.isUpcoming(booking))
  );

  loadBookings(force = false) {
    const userId = this.auth.user()?.id ?? null;
    const sessionRevision = this.auth.sessionRevision();
    if (this.loaded && this.loadedUserId === userId && this.loadedSessionRevision === sessionRevision && !force) return Promise.resolve();
    if (this.loadedUserId !== userId || (this.loadedSessionRevision !== null && this.loadedSessionRevision !== sessionRevision)) {
      this.bookings.set([]);
      this.loaded = false;
    }
    if (this.inFlight && !force) return this.inFlight;

    const requestId = ++this.bookingsRequestId;
    this.requestAbort?.abort();
    const abortController = new AbortController();
    this.requestAbort = abortController;
    const urls = ['/bookings/my', '/bookings/my/history'];

    this.bookingsStatus.set('loading');
    this.bookingsError.set('');

    this.inFlight = (async () => {
      try {
        const responses = await Promise.allSettled(
          urls.map(url => firstValueFrom(this.api.get<unknown>(url, undefined, { noCache: true, abortSignal: abortController.signal })))
        );
        if (requestId !== this.bookingsRequestId) return;

        const normalizedBookings = responses.flatMap((response, index) => {
          if (response.status === 'fulfilled') {
            return this.normalizeBookings(response.value);
          }
          console.error('[mis-turnos] bookings partial error', urls[index], response.reason);
          return [];
        });
        const dedupedBookings = this.dedupeBookings(normalizedBookings);

        this.bookings.set(dedupedBookings);
        this.loaded = responses.some(response => response.status === 'fulfilled');
        this.loadedUserId = userId;
        this.loadedSessionRevision = sessionRevision;
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
          this.inFlight = null;
          this.requestAbort = null;
        }
      }
    })();

    return this.inFlight;
  }

  invalidate() {
    ++this.bookingsRequestId;
    this.requestAbort?.abort();
    this.requestAbort = null;
    this.inFlight = null;
    this.loaded = false;
    this.loadedUserId = null;
    this.loadedSessionRevision = null;
  }

  removeBooking(id: number) {
    this.bookings.set(this.bookings().filter(booking => booking.id !== id));
  }

  updateBookingStatus(id: number, status: string) {
    this.bookings.set(this.bookings().map(booking => booking.id === id ? { ...booking, status } : booking));
    this.invalidate();
  }

  upsertBooking(value: unknown) {
    const booking = this.extractBooking(value);
    if (!booking) return;
    this.bookings.set(this.dedupeBookings([booking, ...this.bookings()]));
    this.invalidate();
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
