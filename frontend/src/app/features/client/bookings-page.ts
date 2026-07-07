import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-head">
      <span class="eyebrow">MI CUENTA</span>
      <h1>{{ history ? 'Historial de turnos' : 'Próximos partidos' }}</h1>
      <div class="tabs"><a routerLink="/mis-turnos">Próximos</a><a routerLink="/historial">Historial</a></div>
    </section>

    <section class="cards-list">
      @for (booking of bookings; track booking.id) {
        <article class="booking-card">
          <div class="date-block"><b>{{ booking.startTime | date:'dd' }}</b><span>{{ booking.startTime | date:'MMM' }}</span></div>
          <div><span class="tag">{{ booking.status }}</span><h2>{{ booking.startTime | date:'HH:mm' }} · {{ booking.durationMinutes }} min</h2><p>{{ booking.playersCount }} jugadores</p></div>
          <strong>{{ booking.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong>
          @if (!history) { <button type="button" class="btn danger" (click)="openCancelModal(booking)">Cancelar</button> }
        </article>
      } @empty {
        <div class="empty">Todavía no hay turnos para mostrar.</div>
      }
      @if (notice) { <p class="notice">{{ notice }}</p> }
    </section>

    @if (selectedBooking) {
      <div class="modal-backdrop" (click)="closeCancelModal()">
        <section class="booking-modal cancel-booking-modal" role="alertdialog" aria-modal="true"
          aria-labelledby="cancel-title" (click)="$event.stopPropagation()">
          @if (!cancelled) {
            <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeCancelModal()">×</button>
            <span class="cancel-icon">!</span>
            <span class="eyebrow danger-eyebrow">CANCELAR RESERVA</span>
            <h2 id="cancel-title">¿Seguro que querés cancelar?</h2>
            <p>El horario volverá a quedar disponible para otros jugadores.</p>

            <div class="cancel-summary">
              <div><span>Día y hora</span><strong>{{ selectedBooking.startTime | date:'EEEE d MMMM · HH:mm' }}</strong></div>
              <div><span>Duración</span><strong>{{ selectedBooking.durationMinutes }} minutos</strong></div>
              <div><span>Importe</span><strong>{{ selectedBooking.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
            </div>

            @if (error) { <p class="notice error-notice">{{ error }}</p> }
            <div class="cancel-actions">
              <button type="button" class="btn keep-booking" [disabled]="cancelling" (click)="closeCancelModal()">No, mantener turno</button>
              <button type="button" class="btn destructive" [disabled]="cancelling" (click)="confirmCancellation()">{{ cancelling ? 'Cancelando...' : 'Sí, cancelar turno' }}</button>
            </div>
          } @else {
            <div class="booking-success cancellation-success">
              <span class="success-check">✓</span>
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
  history = this.router.url.includes('historial');
  bookings: any[] = [];
  selectedBooking: any = null;
  cancelling = false;
  cancelled = false;
  error = '';
  notice = '';

  ngOnInit() { this.load(); }
  load() { this.api.get<any[]>(this.history ? '/bookings/my/history' : '/bookings/my').subscribe(bookings => this.bookings = bookings); }
  openCancelModal(booking: any) { this.selectedBooking = booking; this.cancelled = false; this.error = ''; }
  closeCancelModal() { if (this.cancelling) return; this.selectedBooking = null; this.cancelled = false; this.error = ''; }
  confirmCancellation() {
    if (!this.selectedBooking || this.cancelling) return;
    this.cancelling = true; this.error = '';
    const id = this.selectedBooking.id;
    this.api.patch(`/bookings/${id}/cancel`, {}).subscribe({
      next: () => { this.bookings = this.bookings.filter(booking => booking.id !== id); this.cancelled = true; this.cancelling = false; this.notice = 'El turno fue cancelado correctamente.'; },
      error: error => { this.error = error.error?.message ?? 'No se pudo cancelar el turno.'; this.cancelling = false; }
    });
  }
}
