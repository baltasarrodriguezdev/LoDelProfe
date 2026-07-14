import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api } from '../../core/api';
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
              <span class="tag">{{ statusLabel(booking.status) }}</span>
              <h2>{{ booking.startTime | date:'HH:mm' }} &middot; {{ booking.durationMinutes }} min</h2>
              <p>{{ booking.playersCount }} jugadores</p>
            </div>
            <strong>{{ booking.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong>
            @if (!history()) { <button type="button" class="btn danger" (click)="openCancelModal(booking)">Cancelar</button> }
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
            <span class="eyebrow danger-eyebrow">CANCELAR RESERVA</span>
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
              <button type="button" class="btn destructive" [disabled]="cancelling()" (click)="confirmCancellation()">{{ cancelling() ? 'Cancelando...' : 'Sí, cancelar turno' }}</button>
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
export class BookingsPage implements OnInit {
  private api = inject(Api);
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

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) this.history.set(this.router.url.includes('historial'));
    });
  }

  ngOnInit() { void this.loadBookings(); }

  statusLabel(status: string) {
    return ({ PENDING: 'Pendiente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', PLAYED: 'Completado', NO_SHOW: 'No asistió', BLOCKED: 'Bloqueado' } as Record<string, string>)[status] ?? status;
  }

  loadBookings() { return this.bookingsStore.loadBookings(); }

  openCancelModal(booking: ClientBooking) { this.selectedBooking.set(booking); this.cancelled.set(false); this.error.set(''); }
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
}
