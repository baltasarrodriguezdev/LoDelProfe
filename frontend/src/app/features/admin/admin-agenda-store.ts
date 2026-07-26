import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Api, Auth } from '../../core/api';
import { AsyncStatus } from '../../shared/async-state';

export type AdminBooking = {
  id: number;
  clientName: string;
  clientPhone: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  playersCount: number;
  priceTotal: number;
  status: string;
  origin?: string;
  paymentStatus: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  creator?: { firstName: string; lastName: string; role: string } | null;
  user?: { firstName: string; lastName: string; phone: string; phoneVerified: boolean } | null;
};

type AgendaKey = { date: string; days: number };
type AvailabilityKey = { date: string; duration: number; courtId: number };

@Injectable({ providedIn: 'root' })
export class AdminAgendaStore {
  private api = inject(Api);
  private auth = inject(Auth);
  private bookingsRequestId = 0;
  private availabilityRequestId = 0;
  private loadedAgendaKey: AgendaKey | null = null;
  private loadedAvailabilityKey: AvailabilityKey | null = null;
  private loadedUserId: number | null = null;
  private loadedSessionRevision: number | null = null;
  private agendaInFlight: { key: string; promise: Promise<void> } | null = null;
  private availabilityInFlight: { key: string; promise: Promise<void> } | null = null;
  private agendaAbort: AbortController | null = null;
  private availabilityAbort: AbortController | null = null;

  readonly bookings = signal<AdminBooking[]>([]);
  readonly agendaStatus = signal<AsyncStatus>('idle');
  readonly agendaError = signal('');
  readonly availability = signal<any>({ slots: [] });
  readonly availabilityStatus = signal<AsyncStatus>('idle');
  readonly availabilityError = signal('');

  readonly activeBookings = computed(() => this.bookings().filter(item => !['CANCELLED', 'BLOCKED'].includes(item.status)));
  readonly visibleSlots = computed(() => this.normalizedSlots().filter((slot: any) => slot.available === true || slot.reason === 'OCCUPIED'));
  readonly normalizedSlots = computed(() => {
    const value = this.availability();
    return Array.isArray(value) ? value : value?.slots ?? value?.data?.slots ?? [];
  });

  ensureAgendaLoaded(key: AgendaKey, force = false) {
    this.resetForUserChange();
    if (!force && this.sameAgendaKey(this.loadedAgendaKey, key) && this.agendaStatus() === 'success') return Promise.resolve();
    const cacheKey = this.agendaCacheKey(key);
    if (!force && this.agendaInFlight?.key === cacheKey) return this.agendaInFlight.promise;
    const promise = this.loadAgenda(key).finally(() => {
      if (this.agendaInFlight?.promise === promise) this.agendaInFlight = null;
    });
    this.agendaInFlight = { key: cacheKey, promise };
    return promise;
  }

  async loadAgenda(key: AgendaKey) {
    if (!key.date || !key.days) {
      this.bookings.set([]);
      this.agendaStatus.set('idle');
      return;
    }
    const requestId = ++this.bookingsRequestId;
    const requestUserId = this.auth.user()?.id ?? null;
    const requestSessionRevision = this.auth.sessionRevision();
    this.agendaAbort?.abort();
    const abortController = new AbortController();
    this.agendaAbort = abortController;
    this.agendaStatus.set('loading');
    this.agendaError.set('');
    const from = new Date(`${key.date}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + key.days);
    try {
      const response = await firstValueFrom(this.api.get<unknown>('/admin/bookings', { from: from.toISOString(), to: to.toISOString() }, { noCache: true, abortSignal: abortController.signal }));
      if (requestId !== this.bookingsRequestId) return;
      if (!this.sameSession(requestUserId, requestSessionRevision)) {
        this.agendaStatus.set('idle');
        return;
      }
      const normalizedBookings = this.normalizeBookings(response);
      this.bookings.set(normalizedBookings);
      this.loadedAgendaKey = { ...key };
      this.loadedUserId = requestUserId;
      this.loadedSessionRevision = requestSessionRevision;
      this.agendaStatus.set('success');
    } catch (error) {
      if (requestId !== this.bookingsRequestId) return;
      console.error('[admin-agenda] bookings error', error);
      this.agendaError.set(this.errorMessage(error, 'No se pudo cargar la agenda.'));
      this.agendaStatus.set('error');
    } finally {
      if (requestId === this.bookingsRequestId) this.agendaAbort = null;
    }
  }

  ensureAvailabilityLoaded(key: AvailabilityKey, force = false) {
    this.resetForUserChange();
    if (!force && this.sameAvailabilityKey(this.loadedAvailabilityKey, key) && this.availabilityStatus() === 'success') return Promise.resolve();
    const cacheKey = this.availabilityCacheKey(key);
    if (!force && this.availabilityInFlight?.key === cacheKey) return this.availabilityInFlight.promise;
    const promise = this.loadAvailability(key).finally(() => {
      if (this.availabilityInFlight?.promise === promise) this.availabilityInFlight = null;
    });
    this.availabilityInFlight = { key: cacheKey, promise };
    return promise;
  }

  async loadAvailability(key: AvailabilityKey) {
    if (!key.date || !key.duration || !key.courtId) {
      this.availability.set({ slots: [] });
      this.availabilityStatus.set('idle');
      return;
    }
    const requestId = ++this.availabilityRequestId;
    const requestUserId = this.auth.user()?.id ?? null;
    const requestSessionRevision = this.auth.sessionRevision();
    this.availabilityAbort?.abort();
    const abortController = new AbortController();
    this.availabilityAbort = abortController;
    this.availabilityStatus.set('loading');
    this.availabilityError.set('');
    try {
      const response = await firstValueFrom(this.api.get<unknown>('/availability', { date: key.date, duration: key.duration, courtId: key.courtId }, { noCache: true, abortSignal: abortController.signal }));
      if (requestId !== this.availabilityRequestId) return;
      if (!this.sameSession(requestUserId, requestSessionRevision)) {
        this.availabilityStatus.set('idle');
        return;
      }
      const normalizedSlots = this.normalizeSlots(response);
      this.availability.set(Array.isArray(response) ? { slots: normalizedSlots } : { ...(response as any), slots: normalizedSlots });
      this.loadedAvailabilityKey = { ...key };
      this.loadedUserId = requestUserId;
      this.loadedSessionRevision = requestSessionRevision;
      this.availabilityStatus.set('success');
    } catch (error) {
      if (requestId !== this.availabilityRequestId) return;
      console.error('[admin-agenda] availability error', error);
      this.availability.set({ slots: [] });
      this.availabilityError.set(this.errorMessage(error, 'No se pudo cargar la disponibilidad.'));
      this.availabilityStatus.set('error');
    } finally {
      if (requestId === this.availabilityRequestId) this.availabilityAbort = null;
    }
  }

  invalidate() {
    ++this.bookingsRequestId;
    ++this.availabilityRequestId;
    this.agendaAbort?.abort();
    this.availabilityAbort?.abort();
    this.agendaAbort = null;
    this.availabilityAbort = null;
    this.agendaInFlight = null;
    this.availabilityInFlight = null;
    this.loadedAgendaKey = null;
    this.loadedAvailabilityKey = null;
    if (this.agendaStatus() === 'loading') this.agendaStatus.set('idle');
    if (this.availabilityStatus() === 'loading') this.availabilityStatus.set('idle');
  }

  clear() {
    this.agendaAbort?.abort();
    this.availabilityAbort?.abort();
    ++this.bookingsRequestId;
    ++this.availabilityRequestId;
    this.bookings.set([]);
    this.availability.set({ slots: [] });
    this.agendaStatus.set('idle');
    this.availabilityStatus.set('idle');
    this.agendaError.set('');
    this.availabilityError.set('');
    this.loadedAgendaKey = null;
    this.loadedAvailabilityKey = null;
    this.agendaInFlight = null;
    this.availabilityInFlight = null;
    this.loadedUserId = this.auth.user()?.id ?? null;
    this.loadedSessionRevision = this.auth.sessionRevision();
  }

  replaceBooking(booking: AdminBooking) {
    this.bookings.set(this.bookings().map(item => item.id === booking.id ? { ...item, ...booking } : item));
    this.loadedAvailabilityKey = null;
  }

  updateBookingStatus(id: number, status: string) {
    this.bookings.set(this.bookings().map(item => item.id === id ? { ...item, status } : item));
    this.loadedAvailabilityKey = null;
  }

  removeBooking(id: number) {
    this.bookings.set(this.bookings().filter(item => item.id !== id));
    this.loadedAvailabilityKey = null;
  }

  private normalizeBookings(response: unknown) {
    const value = response as any;
    const normalized = Array.isArray(response) ? response : value?.bookings ?? value?.data?.bookings ?? [];
    return Array.isArray(normalized) ? normalized as AdminBooking[] : [];
  }

  private normalizeSlots(response: unknown) {
    const value = response as any;
    const normalized = Array.isArray(response) ? response : value?.slots ?? value?.data?.slots ?? [];
    return Array.isArray(normalized) ? normalized : [];
  }

  private sameAgendaKey(a: AgendaKey | null, b: AgendaKey) {
    return !!a && a.date === b.date && a.days === b.days;
  }

  private sameAvailabilityKey(a: AvailabilityKey | null, b: AvailabilityKey) {
    return !!a && a.date === b.date && a.duration === b.duration && a.courtId === b.courtId;
  }

  private agendaCacheKey(key: AgendaKey) {
    return [this.auth.user()?.id ?? '', this.auth.sessionRevision(), key.date, key.days].join(':');
  }

  private availabilityCacheKey(key: AvailabilityKey) {
    return [this.auth.user()?.id ?? '', this.auth.sessionRevision(), key.date, key.duration, key.courtId].join(':');
  }

  private resetForUserChange() {
    const userId = this.auth.user()?.id ?? null;
    const sessionRevision = this.auth.sessionRevision();
    if (
      (this.loadedUserId !== null && this.loadedUserId !== userId)
      || (this.loadedSessionRevision !== null && this.loadedSessionRevision !== sessionRevision)
    ) this.clear();
  }

  private sameSession(userId: number | null, sessionRevision: number) {
    return (this.auth.user()?.id ?? null) === userId
      && this.auth.sessionRevision() === sessionRevision;
  }

  private errorMessage(error: unknown, fallback: string) {
    const value = error as any;
    if (typeof value?.error?.message === 'string') return value.error.message;
    if (typeof value?.message === 'string') return value.message;
    return fallback;
  }
}
