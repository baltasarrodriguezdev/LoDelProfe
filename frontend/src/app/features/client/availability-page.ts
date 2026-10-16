import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, finalize, firstValueFrom, forkJoin, merge } from 'rxjs';
import { Api, Auth } from '../../core/api';
import { RealtimeEvent, RealtimeService } from '../../core/realtime';
import { AsyncStatus } from '../../shared/async-state';
import { AdminAgendaStore } from '../admin/admin-agenda-store';
import { MyBookingsStore } from './my-bookings-store';

type Price = { id: number; durationMinutes: number; price: number; active: boolean };
type Slot = { startTime: string; endTime: string; available: boolean; reason?: string | null; message?: string | null };
type Availability = { date: string; durationMinutes: number; price: number | null; reason?: string; message?: string; nextChangeAt?: string | null; slots: Slot[] };
type PendingBooking = { date: string; startTime: string; endTime: string; duration: number; price: number | null; players: number };
type ModalState = 'confirm' | 'reservationConfirmed';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-head availability-head">
      <span class="eyebrow">RESERVAS</span>
      <h1>Encontrá tu próximo partido.</h1>
      <p>Elegí la duración y te mostramos directamente los mejores horarios disponibles.</p>
    </section>

    <section class="turn-grid-layout">
      <aside class="panel turn-filters">
        <div class="filter-step"><span>01</span><label>Fecha<input type="date" [min]="today" [(ngModel)]="date" (change)="search()"></label></div>
        <div class="filter-step duration-step">
          <span>02</span>
          <div>
            <label>Duración del turno</label>
            <div class="duration-options" role="group" aria-label="Duración del turno">
              @for (price of prices; track price.id) {
                <button
                  type="button"
                  [class.selected]="duration === price.durationMinutes"
                  [attr.aria-pressed]="duration === price.durationMinutes"
                  (click)="selectDuration(price.durationMinutes)"
                >
                  <b class="duration-label">{{ durationLabel(price.durationMinutes) }}</b>
                  <small class="duration-price">{{ price.price | currency:'ARS':'symbol':'1.0-0' }}</small>
                </button>
              }
            </div>
          </div>
        </div>
      </aside>

      <div class="turn-results" aria-live="polite">
        <div class="result-title turn-results-title"><div><span class="eyebrow">HORARIOS DEL DÍA</span><h2>Elegí cuándo jugar</h2><p>{{ formattedDate }} · {{ durationLabel(duration) }}</p></div>@if (result?.price) { <strong>{{ result!.price | currency:'ARS':'symbol':'1.0-0' }}</strong> }</div>
        @if (pricesStatus() === 'loading' || availabilityStatus() === 'loading') {
          <div class="empty turn-empty">Buscando horarios...</div>
        } @else if (availableSlots().length > 0) {
          <div class="start-time-grid">
            @for (slot of availableSlots(); track slot.startTime) {
              <button type="button" [class.selected]="selectedSlot === slot" [attr.aria-pressed]="selectedSlot === slot" (click)="openConfirmation(slot)"><span>INICIO</span><b>{{ slot.startTime }}</b><small>hasta {{ slot.endTime }}</small></button>
            }
          </div>
        } @else if (availabilityLoadFailed) {
          <div class="empty turn-empty"><strong>No pudimos cargar los horarios.</strong><span>{{ message }}</span></div>
        } @else {
          <div class="empty turn-empty"><strong>{{ emptyTitle }}</strong><span>{{ emptyHint }}</span></div>
        }
        @if (message && !availabilityLoadFailed) { <p class="notice" [class.error-notice]="messageIsError">{{ message }}</p> }
      </div>
    </section>

    @if (selectedSlot) {
      <div class="modal-backdrop" (click)="closeModal()">
        <section class="booking-modal reservation-confirm-modal unified-booking-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" (click)="$event.stopPropagation()">
          <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeModal()">×</button>

          @if (modalState === 'confirm') {
            <div class="booking-modal-header">
              <span class="eyebrow">ÚLTIMO PASO</span>
              <h2 id="confirm-title">{{ modalTitle }}</h2>
              <p>{{ modalText }}</p>
            </div>

            <div class="booking-summary">
              <div><span>Día</span><strong>{{ formattedDate }}</strong></div>
              <div><span>Horario</span><strong>{{ selectedSlot.startTime }} — {{ selectedSlot.endTime }}</strong></div>
              <div><span>Duración</span><strong>{{ durationLabel(duration) }}</strong></div>
              @if (auth.user()) { <div><span>Jugadores</span><strong>{{ players }}</strong></div> }
              <div><span>Precio total</span><strong>{{ selectedPrice | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
            </div>

            @if (!auth.user()) {
              <div class="guest-auth-actions unified-auth-actions">
                <button type="button" class="btn primary" (click)="continueWithAuth('/ingresar')">Ingresar y continuar</button>
                <button type="button" class="btn guest-register" (click)="continueWithAuth('/registro')">Crear cuenta y continuar</button>
              </div>
              <button type="button" class="link cancel-modal" (click)="closeModal()">Elegir otro horario</button>
            } @else {
              <div class="modal-fields">
                <label>Cantidad de jugadores<input type="number" min="1" max="12" [(ngModel)]="players"></label>
                <label>Nota para la cancha <small>(opcional)</small><textarea maxlength="1000" [(ngModel)]="notes" placeholder="Ej. llegamos cinco minutos antes"></textarea></label>
              </div>
              @if (modalError) { <p class="notice error-notice modal-alert">{{ modalError }}</p> }
              <div class="booking-modal-footer">
                <button type="button" class="link cancel-modal" [disabled]="submitting()" (click)="closeModal()">Elegir otro horario</button>
                @if (isEmailVerified()) {
                  <button type="button" class="btn primary confirm-booking" [disabled]="submitting()" (click)="confirmBooking()">{{ submitting() ? 'Reservando...' : 'Confirmar reserva' }}</button>
                } @else {
                  <button type="button" class="btn primary confirm-booking" (click)="goToEmailVerification()">Confirmar mi email</button>
                }
              </div>
            }
          } @else if (modalState === 'reservationConfirmed') {
            <div class="booking-success unified-success">
              <span class="success-check">✓</span>
              <span class="eyebrow">RESERVA CONFIRMADA</span>
              <h2 id="confirm-title">¡Turno reservado!</h2>
              <p>Tu reserva quedó confirmada correctamente. Podés verla desde Mis turnos.</p>
              <div class="success-actions">
                <a class="btn primary" routerLink="/mis-turnos">Ver mis turnos</a>
                <a class="btn ghost" routerLink="/">Volver al inicio</a>
              </div>
            </div>
          }
        </section>
      </div>
    }
  `
})
export class AvailabilityPage implements OnInit, OnDestroy {
  private api = inject(Api);
  public auth = inject(Auth);
  private router = inject(Router);
  private myBookingsStore = inject(MyBookingsStore);
  private adminAgendaStore = inject(AdminAgendaStore);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  private readonly pendingKey = 'pendingBooking';

  prices: Price[] = [];
  result: Availability | null = null;
  courtId = 0;
  duration = 90;
  players = 4;
  notes = '';
  today = this.dateInput(new Date());
  date = this.today;
  selectedSlot: Slot | null = null;
  modalState: ModalState = 'confirm';
  readonly pricesStatus = signal<AsyncStatus>('idle');
  readonly availabilityStatus = signal<AsyncStatus>('idle');
  readonly slots = signal<Slot[]>([]);
  readonly availableSlots = computed(() =>
    this.slots().filter(slot => slot.available === true)
  );
  readonly submitting = signal(false);
  message = '';
  messageIsError = true;
  modalError = '';
  private pendingBooking: PendingBooking | null = null;
  private availabilityRequestId = 0;
  private pricesRequestId = 0;
  private pricesAbort: AbortController | null = null;
  private availabilityAbort: AbortController | null = null;
  private availabilityRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  get availabilityLoadFailed() {
    return this.pricesStatus() === 'error' || this.availabilityStatus() === 'error';
  }
  get selectedPrice() { return this.pendingBooking?.price ?? this.result?.price ?? null; }
  get modalTitle() {
    if (!this.auth.user()) return 'Reservá tu turno';
    if (!this.isEmailVerified()) return 'Confirmá tu email para reservar';
    return 'Confirmá tu turno';
  }

  get modalText() {
    if (!this.auth.user()) return 'Para reservar desde la web, ingresá o creá tu cuenta.';
    if (!this.isEmailVerified()) return 'No retenemos horarios durante la verificación. Confirmá tu email y volvé a elegir el turno disponible.';
    return 'Revisá los datos antes de guardar la reserva.';
  }

  get emptyTitle() {
    if (this.result?.reason === 'CLOSED') return 'La cancha está cerrada ese día.';
    if (this.result?.reason === 'NO_PRICE') return 'No hay precio activo para esta duración.';
    if (this.result?.reason === 'NO_BUSINESS_HOURS') return 'Faltan configurar horarios para ese día.';
    return 'No hay turnos disponibles para este día.';
  }

  get emptyHint() { return this.result?.message ?? 'Probá con otra fecha o duración.'; }

  get formattedDate() {
    const value = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${this.date}T12:00:00Z`));
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  ngOnInit() {
    this.restorePendingBooking();
    this.loadPrices();
    merge(this.realtime.listen(['AVAILABILITY_CHANGED', 'CONFIGURATION_CHANGED']).pipe(debounceTime(120)), this.realtime.poll$()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(change => {
      if (typeof change === 'string') {
        if (this.auth.user() && !this.isEmailVerified()) void this.auth.refreshSession(true);
        // A nextChangeAt refresh may have just completed on this same tick.
        if (Date.now() - this.lastAvailabilityCompleted >= 1000) void this.loadAvailability();
        return;
      }
      if (typeof change === 'object') {
        const event = change as RealtimeEvent;
        if (event.type === 'AVAILABILITY_CHANGED' && !this.realtime.affectsAvailability(event, this.date, this.courtId)) return;
        if (event.type !== 'CONFIGURATION_CHANGED') {
          void this.loadAvailability();
          return;
        }
      }
      this.loadPrices();
    });
  }

  ngOnDestroy() {
    ++this.pricesRequestId;
    ++this.availabilityRequestId;
    this.pricesAbort?.abort();
    this.availabilityAbort?.abort();
    this.pricesAbort = null;
    this.availabilityAbort = null;
    this.clearAvailabilityRefresh();
  }

  isEmailVerified() { return this.auth.user()?.emailVerified === true; }

  selectDuration(duration: number) {
    this.duration = duration;
    this.pendingBooking = null;
    this.search();
  }

  search() {
    if (!this.date || !this.courtId || !this.duration) {
      this.slots.set([]);
      this.availabilityStatus.set('idle');
      return;
    }
    this.message = '';
    this.availabilityStatus.set('idle');
    this.result = null;
    this.slots.set([]);
    this.selectedSlot = null;
    void this.loadAvailability();
  }

  openConfirmation(slot: Slot, pending?: PendingBooking) {
    this.selectedSlot = slot;
    this.pendingBooking = pending ?? null;
    this.modalState = 'confirm';
    this.modalError = '';
    this.players = pending?.players ?? 4;
    this.notes = '';
  }

  closeModal() {
    if (this.submitting()) return;
    const refresh = this.modalState !== 'confirm';
    this.selectedSlot = null;
    this.modalState = 'confirm';
    this.modalError = '';
    if (refresh) this.search();
  }

  continueWithAuth(path: '/ingresar' | '/registro') {
    if (!this.selectedSlot) return;
    const pending: PendingBooking = {
      date: this.date,
      startTime: this.selectedSlot.startTime,
      endTime: this.selectedSlot.endTime,
      duration: this.duration,
      price: this.result?.price ?? null,
      players: this.players
    };
    sessionStorage.setItem(this.pendingKey, JSON.stringify(pending));
    this.router.navigate([path], { queryParams: { returnUrl: '/reservar?resume=1' } });
  }

  goToEmailVerification() {
    if (!this.selectedSlot) return;
    this.continueWithAuth('/ingresar');
    this.router.navigate(['/revisar-email'], { queryParams: { email: this.auth.user()?.email ?? '' } });
  }

  confirmBooking() {
    if (!this.auth.user() || !this.selectedSlot || this.submitting()) return;
    if (!Number.isInteger(this.players) || this.players < 1 || this.players > 12) {
      this.modalError = 'La cantidad de jugadores debe estar entre 1 y 12.';
      return;
    }
    this.submitting.set(true);
    this.modalError = '';
    this.api.post('/bookings', this.bookingPayload()).pipe(
      finalize(() => {
        this.submitting.set(false);
      })
    ).subscribe({
      next: response => {
        this.myBookingsStore.upsertBooking(response);
        this.adminAgendaStore.invalidate();
        this.modalState = 'reservationConfirmed';
        sessionStorage.removeItem(this.pendingKey);
      },
      error: error => {
        console.error('[reservas] booking error', error);
        this.modalError = this.friendlyBookingError(error.error?.message ?? error.message);
      }
    });
  }

  durationLabel(minutes: number) {
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    return `${hours ? `${hours}h` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest}m` : ''}`;
  }

  private bookingPayload() {
    return {
      courtId: this.courtId,
      date: this.date,
      startTime: this.selectedSlot!.startTime,
      durationMinutes: this.duration,
      playersCount: this.players,
      notes: this.notes.trim() || undefined
    };
  }

  private loadPrices() {
    const requestId = ++this.pricesRequestId;
    this.pricesAbort?.abort();
    const abortController = new AbortController();
    this.pricesAbort = abortController;
    this.pricesStatus.set('loading');
    forkJoin({
      prices: this.api.get<unknown>('/prices', undefined, { noCache: true, abortSignal: abortController.signal }),
      courts: this.api.get<unknown>('/courts', undefined, { noCache: true, abortSignal: abortController.signal })
    }).pipe(
      finalize(() => {
        if (requestId === this.pricesRequestId) this.pricesAbort = null;
      })
    ).subscribe({
      next: ({ prices: json, courts }) => {
        if (requestId !== this.pricesRequestId) return;
        const activeCourt = Array.isArray(courts) ? courts[0] as any : null;
        this.courtId = Number(activeCourt?.id ?? 0);
        if (!this.courtId) {
          this.message = 'No hay una cancha activa configurada.';
          this.messageIsError = true;
          this.pricesStatus.set('error');
          return;
        }
        const activePrices = Array.isArray(json)
          ? json.filter((item: Partial<Price>) => item.active === true)
          : [];

        this.prices = activePrices
          .map((price: Partial<Price>) => ({
            id: Number(price.id),
            durationMinutes: Number(price.durationMinutes),
            price: Number(price.price),
            active: price.active === true
          }))
          .filter((price: Price) => Number.isFinite(price.durationMinutes) && Number.isFinite(price.price));

        if (!this.prices.length) {
          this.message = 'No hay precios activos configurados.';
          this.messageIsError = true;
          this.pricesStatus.set('error');
          return;
        }
        this.pricesStatus.set('success');
        if (!this.duration || !this.prices.some(price => price.durationMinutes === this.duration)) this.duration = this.prices[0].durationMinutes;
        this.search();
      },
      error: error => {
        if (requestId !== this.pricesRequestId || this.isAbortError(error, abortController.signal)) return;
        console.error('[reservas] prices error', error);
        this.message = this.errorMessage(error, 'No pudimos cargar las duraciones disponibles.');
        this.messageIsError = true;
        this.pricesStatus.set('error');
      }
    });
  }

  private lastAvailabilityCompleted = 0;
  private availabilityRequestKey = '';
  private async loadAvailability() {
    const key = JSON.stringify([this.date, this.duration, this.courtId]);
    if (this.availabilityAbort && key === this.availabilityRequestKey) return;
    this.availabilityRequestKey = key;
    const requestId = ++this.availabilityRequestId;
    this.availabilityAbort?.abort();
    if (!this.date || !this.duration) {
      this.availabilityAbort = null;
      this.slots.set([]);
      this.availabilityStatus.set('idle');
      return;
    }

    const abortController = new AbortController();
    this.availabilityAbort = abortController;
    this.availabilityStatus.set('loading');
    try {
      const json = await firstValueFrom(this.api.get<unknown>('/availability', {
        date: this.date, duration: this.duration, courtId: this.courtId
      }, { noCache: true, abortSignal: abortController.signal }));
      if (requestId !== this.availabilityRequestId) return;
      const normalizedSlots = Array.isArray(json)
        ? json
        : (json as any)?.slots ?? (json as any)?.data?.slots ?? [];
      this.slots.set(normalizedSlots);
      this.result = {
        date: (json as any)?.date ?? this.date,
        durationMinutes: Number((json as any)?.durationMinutes ?? this.duration),
        price: (json as any)?.price ?? null,
        reason: (json as any)?.reason,
        message: (json as any)?.message,
        nextChangeAt: (json as any)?.nextChangeAt,
        slots: normalizedSlots
      };
      this.scheduleAvailabilityRefresh(this.result.nextChangeAt);
      this.lastAvailabilityCompleted = Date.now();
      this.availabilityStatus.set('success');
      this.resumePendingConfirmation();
    } catch (error) {
      if (requestId !== this.availabilityRequestId || this.isAbortError(error, abortController.signal)) return;
      console.error('[reservas] availability error', error);
      this.slots.set([]);
      this.message = this.errorMessage(error, 'No pudimos consultar los horarios.');
      this.messageIsError = true;
      this.availabilityStatus.set('error');
    } finally {
      if (requestId === this.availabilityRequestId) {
        this.availabilityAbort = null;
      }
    }
  }
  private scheduleAvailabilityRefresh(value?: string | null) {
    this.clearAvailabilityRefresh();
    if (!value) return;
    const delay = Date.parse(value) - Date.now() + 250;
    if (!Number.isFinite(delay) || delay <= 0) return;
    this.availabilityRefreshTimer = setTimeout(() => {
      this.availabilityRefreshTimer = null;
      if (document.visibilityState === 'visible' && navigator.onLine) void this.loadAvailability();
    }, Math.min(delay, 2_147_000_000));
  }
  private clearAvailabilityRefresh() {
    if (this.availabilityRefreshTimer) clearTimeout(this.availabilityRefreshTimer);
    this.availabilityRefreshTimer = null;
  }
  private isAbortError(error: unknown, signal: AbortSignal) {
    const value = error as { name?: string };
    return signal.aborted || value?.name === 'AbortError';
  }
  private errorMessage(error: unknown, fallback: string) {
    const value = error as any;
    if (typeof value?.error?.message === 'string') return value.error.message;
    if (typeof value?.message === 'string') return value.message;
    return fallback;
  }
  private friendlyBookingError(message?: string) {
    if (!message) return 'No pudimos confirmar la reserva.';
    const normalized = message.toLowerCase();
    if (normalized.includes('pendiente')) return message;
    if (normalized.includes('disponible') || normalized.includes('otro turno')) return 'Ese horario ya no está disponible.';
    if (normalized.includes('jugador')) return 'Revisá la cantidad de jugadores.';
    return 'No pudimos confirmar la reserva.';
  }

  private dateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private restorePendingBooking() {
    if (!this.auth.user()) return;
    try {
      const value = sessionStorage.getItem(this.pendingKey);
      if (!value) return;
      const pending = JSON.parse(value) as Partial<PendingBooking>;
      if (!pending.date || !pending.duration || !pending.startTime || !pending.endTime) {
        sessionStorage.removeItem(this.pendingKey);
        return;
      }
      this.pendingBooking = {
        date: pending.date,
        startTime: pending.startTime,
        endTime: pending.endTime,
        duration: pending.duration,
        price: pending.price ?? null,
        players: pending.players ?? 4
      };
      this.date = this.pendingBooking.date;
      this.duration = this.pendingBooking.duration;
      this.players = this.pendingBooking.players;
    } catch {
      sessionStorage.removeItem(this.pendingKey);
    }
  }

  private resumePendingConfirmation() {
    if (!this.pendingBooking || !this.auth.user()) return;
    const pending = this.pendingBooking;
    const slot = this.availableSlots().find(item => item.startTime === pending.startTime && item.endTime === pending.endTime);
    sessionStorage.removeItem(this.pendingKey);
    this.router.navigate(['/reservar'], { replaceUrl: true });
    if (slot) {
      this.openConfirmation(slot, pending);
    } else {
      this.pendingBooking = null;
      this.message = 'Ese horario ya no está disponible. Elegí otro turno.';
    }
  }
}
