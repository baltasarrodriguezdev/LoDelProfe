import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api, Auth } from '../../core/api';
import { VENUE } from '../../shared/venue';
import { buildPhoneVerificationWhatsappUrl } from '../../shared/whatsapp-booking';
import { AdminAgendaStore } from '../admin/admin-agenda-store';
import { ClientBooking, MyBookingsStore } from './my-bookings-store';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-head">
      <span class="eyebrow">MI CUENTA</span>
      <h1>{{ history() ? 'Historial de turnos' : 'Próximos partidos' }}</h1>
      <div class="tabs"><a routerLink="/mis-turnos">Próximos</a><a routerLink="/historial">Historial</a></div>
      @if (!history()) { <p>Podés cancelar online hasta {{ cancellationCutoffMinutes }} minutos antes del turno.</p> }
    </section>

    <section class="cards-list">
      @if (bookingsStatus() === 'loading') {
        <div class="empty">Cargando tus turnos...</div>
      } @else if (loadError()) {
        <div class="empty"><strong>No pudimos cargar tus turnos.</strong><span>{{ loadError() }}</span></div>
      } @else {
        @for (booking of bookings(); track booking.id) {
          <article class="booking-card">
            <div class="date-block"><b>{{ booking.startTime | date:'dd' }}</b><span>{{ booking.startTime | date:'MMM' }}</span></div>
            <div>
              <span class="tag" [class.expired-tag]="isExpiredCancellation(booking)">{{ statusLabel(booking) }}</span>
              <h2>{{ booking.startTime | date:'HH:mm' }} &middot; {{ booking.durationMinutes }} min</h2>
              <p>{{ booking.playersCount }} jugadores</p>
              @if (isActiveHold(booking)) {
                <div class="client-hold-status" role="timer" aria-live="polite">
                  <span>Esperando validación por WhatsApp</span>
                  <strong>{{ holdRemainingLabel(booking) }}</strong>
                  <small>El horario se libera a las {{ holdEndsAtLabel(booking) }}</small>
                </div>
              }
            </div>
            <strong>{{ booking.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong>
            @if (!history()) {
              <div class="booking-card-actions">
                @if (isActiveHold(booking)) {
                  <a class="btn primary" [href]="verificationWhatsappUrl(booking)" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
                }
                <button type="button" class="btn danger" [disabled]="!canCancel(booking)" [title]="canCancel(booking) ? 'Cancelar turno' : 'Fuera del plazo de cancelación online'" (click)="openCancelModal(booking)">{{ booking.status === 'PENDING' ? 'Cancelar solicitud' : 'Cancelar' }}</button>
              </div>
            }
          </article>
        } @empty {
          <div class="empty">Todavía no hay turnos para mostrar.</div>
        }
      }
      @if (notice()) { <p class="notice">{{ notice() }}</p> }
    </section>

    @if (selectedBooking(); as bookingToCancel) {
      <div class="modal-backdrop" (click)="closeCancelModal()">
        <section class="booking-modal cancel-booking-modal" role="alertdialog" aria-modal="true"
          aria-labelledby="cancel-title" (click)="$event.stopPropagation()">
          @if (!cancelled()) {
            <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeCancelModal()">&times;</button>
            <span class="cancel-icon">!</span>
            <span class="eyebrow danger-eyebrow">{{ bookingToCancel.status === 'PENDING' ? 'LIBERAR HORARIO' : 'CANCELAR RESERVA' }}</span>
            <h2 id="cancel-title">¿Seguro que querés cancelar?</h2>
            <p>El horario volverá a quedar disponible para otros jugadores.</p>

            <div class="cancel-summary">
              <div><span>Día y hora</span><strong>{{ bookingToCancel.startTime | date:'EEEE d MMMM · HH:mm' }}</strong></div>
              <div><span>Duración</span><strong>{{ bookingToCancel.durationMinutes }} minutos</strong></div>
              <div><span>Importe</span><strong>{{ bookingToCancel.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
            </div>

            @if (error()) { <p class="notice error-notice">{{ error() }}</p> }
            <div class="cancel-actions">
              <button type="button" class="btn keep-booking" [disabled]="cancelling()" (click)="closeCancelModal()">No, mantener turno</button>
              <button type="button" class="btn destructive" [disabled]="cancelling()" (click)="confirmCancellation()">{{ cancelling() ? 'Cancelando...' : bookingToCancel.status === 'PENDING' ? 'Sí, liberar horario' : 'Sí, cancelar turno' }}</button>
            </div>
          } @else {
            <div class="booking-success cancellation-success">
              <span class="success-check">&#10003;</span>
              <span class="eyebrow">TURNO CANCELADO</span>
              <h2>La reserva fue cancelada.</h2>
              <p>El horario ya volvió a quedar disponible.</p>
              <button type="button" class="btn primary full" (click)="closeCancelModal()">Entendido</button>
            </div>
          }
        </section>
      </div>
    }
  `
})
export class BookingsPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private auth = inject(Auth);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private bookingsStore = inject(MyBookingsStore);
  private adminAgendaStore = inject(AdminAgendaStore);

  readonly history = signal(this.router.url.includes('historial'));
  readonly bookingsStatus = this.bookingsStore.bookingsStatus;
  readonly loadError = this.bookingsStore.bookingsError;
  readonly bookings = computed(() =>
    this.history() ? this.bookingsStore.historyBookings() : this.bookingsStore.upcomingBookings()
  );
  readonly selectedBooking = signal<ClientBooking | null>(null);
  readonly cancelling = signal(false);
  readonly cancelled = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly now = signal(Date.now());
  cancellationCutoffMinutes = 120;
  private holdTimer: ReturnType<typeof setInterval> | null = null;
  private refreshedExpiredHolds = new Set<number>();

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) this.history.set(this.router.url.includes('historial'));
    });
  }

  ngOnInit() {
    void this.loadBookings();
    this.holdTimer = setInterval(() => this.tickHolds(), 1000);
    this.api.get<any>('/booking-policy', undefined, { noCache: true }).subscribe({
      next: value => this.cancellationCutoffMinutes = Number(value?.cancellationCutoffMinutes ?? 120)
    });
  }

  ngOnDestroy() {
    if (this.holdTimer) clearInterval(this.holdTimer);
    this.holdTimer = null;
  }

  statusLabel(booking: ClientBooking) {
    if (this.isExpiredCancellation(booking) || this.isExpiredHold(booking)) return 'Solicitud vencida';
    return ({ PENDING: 'Retención temporal', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', PLAYED: 'Completado', NO_SHOW: 'No asistió', BLOCKED: 'Bloqueado' } as Record<string, string>)[booking.status] ?? booking.status;
  }

  loadBookings() { return this.bookingsStore.loadBookings(); }

  canCancel(booking: ClientBooking) {
    if (booking.status === 'PENDING') return this.isActiveHold(booking);
    return new Date(booking.startTime).getTime() - Date.now() >= this.cancellationCutoffMinutes * 60_000;
  }

  isActiveHold(booking: ClientBooking) {
    return booking.status === 'PENDING' && Boolean(booking.holdExpiresAt) && Date.parse(booking.holdExpiresAt!) > this.now();
  }

  isExpiredHold(booking: ClientBooking) {
    return booking.status === 'PENDING' && (!booking.holdExpiresAt || Date.parse(booking.holdExpiresAt) <= this.now());
  }

  isExpiredCancellation(booking: ClientBooking) {
    return booking.status === 'CANCELLED' && booking.cancellationReason?.includes('Solicitud vencida') === true;
  }

  holdRemainingLabel(booking: ClientBooking) {
    const expiresAt = Date.parse(booking.holdExpiresAt ?? '');
    const seconds = Number.isFinite(expiresAt)
      ? Math.max(0, Math.ceil((expiresAt - this.now()) / 1000))
      : 0;
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  holdEndsAtLabel(booking: ClientBooking) {
    return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(booking.holdExpiresAt!));
  }

  verificationWhatsappUrl(booking: ClientBooking) {
    const user = this.auth.user();
    const start = new Date(booking.startTime);
    const end = booking.endTime ? new Date(booking.endTime) : new Date(start.getTime() + booking.durationMinutes * 60_000);
    return buildPhoneVerificationWhatsappUrl(VENUE.whatsapp, {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      formattedDate: new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(start),
      startTime: new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(start),
      endTime: new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(end),
      durationLabel: `${booking.durationMinutes} min`,
      playersCount: booking.playersCount,
      formattedPrice: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(booking.priceTotal),
      registeredPhone: user?.phone ?? '',
      verificationCode: user?.verificationCode ?? undefined
    });
  }
  openCancelModal(booking: ClientBooking) {
    if (!this.canCancel(booking)) return;
    this.selectedBooking.set(booking);
    this.cancelled.set(false);
    this.error.set('');
  }
  closeCancelModal() { if (this.cancelling()) return; this.selectedBooking.set(null); this.cancelled.set(false); this.error.set(''); }

  confirmCancellation() {
    const booking = this.selectedBooking();
    if (!booking || this.cancelling()) return;
    this.cancelling.set(true);
    this.error.set('');
    const id = booking.id;
    this.api.patch(`/bookings/${id}/cancel`, {}).pipe(
      finalize(() => {
        this.cancelling.set(false);
      })
    ).subscribe({
      next: () => {
        this.bookingsStore.updateBookingStatus(id, 'CANCELLED');
        this.adminAgendaStore.invalidate();
        this.cancelled.set(true);
        this.notice.set('El turno fue cancelado correctamente.');
      },
      error: error => {
        console.error('[mis-turnos] cancel error', error);
        this.error.set(this.errorMessage(error, 'No se pudo cancelar el turno.'));
      }
    });
  }

  private errorMessage(error: unknown, fallback: string) {
    const value = error as any;
    if (typeof value?.error?.message === 'string') return value.error.message;
    if (typeof value?.message === 'string') return value.message;
    return fallback;
  }

  private tickHolds() {
    this.now.set(Date.now());
    const expired = this.bookingsStore.bookings().filter(booking => this.isExpiredHold(booking) && !this.refreshedExpiredHolds.has(booking.id));
    if (!expired.length) return;
    expired.forEach(booking => this.refreshedExpiredHolds.add(booking.id));
    void this.bookingsStore.loadBookings(true);
    this.adminAgendaStore.invalidate();
  }
}
