import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api, Auth } from '../../core/api';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { MyBookingsStore } from '../client/my-bookings-store';
import { AdminAgendaStore, AdminBooking } from './admin-agenda-store';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialogComponent],
  template: `
    <section class='admin-shell'>
      <aside class='admin-nav'>
        <span class='eyebrow'>PANEL DEL CLUB</span>
        <h2>Administración</h2>
        <small class='admin-nav-label'>USO DIARIO</small>
        <a routerLink='/admin'>Hoy</a>
        <a routerLink='/admin/agenda-diaria'>Agenda diaria</a>
        <a routerLink='/admin/agenda-semanal'>Agenda semanal</a>
        <a routerLink='/admin/turno'>Agregar turno</a>
        <a routerLink='/admin/turno' [queryParams]='{mode: &quot;block&quot;}'>Bloquear horario</a>
        <small class='admin-nav-label advanced'>MARKETING</small>
        <a routerLink='/admin/marketing/historias-instagram'>Historias Instagram</a>
        @if (auth.user()?.role === 'SUPERADMIN') {
          <small class='admin-nav-label advanced'>CONFIGURACIÓN</small>
          <a routerLink='/admin/precios'>Precios</a>
          <a routerLink='/admin/horarios'>Horarios</a>
          <a routerLink='/admin/politicas'>Políticas</a>
          <a routerLink='/admin/turnos-fijos'>Turnos fijos</a>
          <a routerLink='/admin/clientes'>Clientes</a>
          <a routerLink='/admin/caja'>Caja</a>
          <a routerLink='/admin/estadisticas'>Estadísticas</a>
        }
      </aside>
      <div class='admin-content'>
        <div class='admin-title'>
          <div><span class='eyebrow'>GESTIÓN</span><h1>{{ weekly ? 'Agenda semanal' : 'Agenda diaria' }}</h1></div>
          <span class='today'>{{ today | date:'EEEE d MMMM' }}</span>
        </div>
        @if (notice()) { <p class='notice' [class.error-notice]='noticeError()'>{{ notice() }}</p> }
        <div class='toolbar'>
          <input type='date' [(ngModel)]='selectedDate' (change)='loadAgenda(true)'>
          <a class='btn primary' routerLink='/admin/turno'>+ Agregar turno</a>
        </div>
        @if (agendaStatus() === 'loading') {
          <div class='empty'>Cargando agenda...</div>
        } @else if (agendaStatus() === 'error') {
          <div class='empty'><strong>No se pudo cargar la agenda.</strong><span>{{ agendaError() }}</span></div>
        } @else if (agendaStatus() === 'success') {
          <div class='timeline'>
            @for (booking of bookings(); track booking.id) {
              <article [class.blocked]='isBlocked(booking)' [class.cancelled]='isCancelled(booking)'>
                <div class='agenda-time'>
                  <time>{{ booking.startTime | date:'HH:mm' }}</time>
                  <small>a {{ booking.endTime | date:'HH:mm' }}</small>
                  @if (weekly) { <small>{{ booking.startTime | date:'EEE d/MM' }}</small> }
                </div>
                <div>
                  <span class='tag'>{{ statusLabel(booking.status) }}</span>
                  <span class='booking-origin'>{{ originLabel(booking.origin) }}</span>
                  <h3>{{ booking.clientName }}</h3>
                  <p>{{ booking.clientPhone }} · {{ booking.durationMinutes }} min · {{ booking.playersCount }} jugadores</p>
                </div>
                <strong>{{ booking.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong>
                <select [ngModel]='booking.status' [disabled]='bookingMutationId() !== null || statusOptions(booking).length <= 1' (ngModelChange)='changeStatus(booking, $event)'>
                  @for (option of statusOptions(booking); track option.value) {
                    <option [value]='option.value'>{{ option.label }}</option>
                  }
                </select>
                @if (isCancelled(booking) && auth.user()?.role === 'SUPERADMIN') {
                  <button type='button' class='link danger-text history-delete' [disabled]='bookingMutationId() !== null' (click)='askDelete(booking)'>Eliminar</button>
                }
              </article>
            } @empty {
              <div class='empty'>No hay turnos en este período.</div>
            }
          </div>
        }
      </div>
    </section>
    @if (bookingToDelete(); as booking) {
      <app-confirm-dialog
        title='Eliminar turno cancelado'
        [message]='deleteMessage(booking)'
        secondaryMessage='Esta acción quita el turno del historial visible.'
        confirmText='Sí, eliminar'
        cancelText='Volver'
        loadingText='Eliminando...'
        variant='danger'
        [loading]='deletingBookingId() === booking.id'
        [error]='deleteError()'
        (cancel)='closeDeleteDialog()'
        (confirm)='confirmDelete()'
      />
    }
  `
})
export class AdminAgendaPage implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  private agendaStore = inject(AdminAgendaStore);
  private myBookingsStore = inject(MyBookingsStore);
  readonly auth = inject(Auth);

  readonly bookings = this.agendaStore.bookings;
  readonly agendaStatus = this.agendaStore.agendaStatus;
  readonly agendaError = this.agendaStore.agendaError;
  readonly bookingMutationId = signal<number | null>(null);
  readonly deletingBookingId = signal<number | null>(null);
  readonly bookingToDelete = signal<AdminBooking | null>(null);
  readonly deleteError = signal('');
  readonly notice = signal('');
  readonly noticeError = signal(false);

  selectedDate = this.dateInput(new Date());
  today = new Date();
  get weekly() { return this.router.url.includes('semanal'); }

  ngOnInit() { this.loadAgenda(); }

  loadAgenda(force = false) {
    void this.agendaStore.ensureAgendaLoaded({ date: this.selectedDate, days: this.weekly ? 7 : 1 }, force);
  }

  isBlocked(booking: AdminBooking) { return booking.status === 'BLOCKED'; }
  isCancelled(booking: AdminBooking) { return booking.status === 'CANCELLED'; }

  statusLabel(status: string) {
    return ({ PENDING: 'Pendiente', CONFIRMED: 'Confirmado', PLAYED: 'Jugado', CANCELLED: 'Cancelado', NO_SHOW: 'No asistió', BLOCKED: 'Bloqueado' } as Record<string, string>)[status] ?? status;
  }

  statusOptions(booking: AdminBooking) {
    const transitions: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PLAYED', 'NO_SHOW', 'CANCELLED'],
      CANCELLED: ['CONFIRMED', 'BLOCKED'],
      BLOCKED: ['CANCELLED'],
      PLAYED: [],
      NO_SHOW: []
    };
    return [booking.status, ...(transitions[booking.status] ?? [])].map(value => ({
      value,
      label: value === 'CANCELLED' && booking.status === 'BLOCKED' ? 'Liberar horario' : this.statusLabel(value)
    }));
  }

  originLabel(origin?: string) {
    return ({ WEB: 'Web', WHATSAPP: 'WhatsApp', MANUAL: 'Manual' } as Record<string, string>)[origin ?? 'WEB'] ?? 'Web';
  }

  changeStatus(booking: AdminBooking, status: string) {
    if (!booking.id || status === booking.status || this.bookingMutationId() !== null) return;
    const previous = booking.status;
    this.bookingMutationId.set(booking.id);
    this.notice.set('');
    this.api.patch(`/admin/bookings/${booking.id}/status`, { status }).pipe(
      finalize(() => this.bookingMutationId.set(null))
    ).subscribe({
      next: () => {
        this.agendaStore.updateBookingStatus(booking.id, status);
        this.myBookingsStore.invalidate();
        this.noticeError.set(false);
        this.notice.set(status === 'CANCELLED'
          ? (previous === 'BLOCKED' ? 'Horario liberado correctamente.' : 'Turno cancelado correctamente.')
          : 'Estado actualizado correctamente.');
      },
      error: error => {
        this.noticeError.set(true);
        this.notice.set(error.error?.message ?? 'No se pudo actualizar el turno.');
      }
    });
  }

  askDelete(booking: AdminBooking) {
    if (!booking.id || booking.status !== 'CANCELLED') return;
    this.bookingToDelete.set(booking);
    this.deleteError.set('');
  }

  deleteMessage(booking: AdminBooking) {
    return `¿Querés eliminar definitivamente el turno cancelado de ${booking.clientName}?`;
  }

  closeDeleteDialog() {
    if (this.deletingBookingId() !== null) return;
    this.bookingToDelete.set(null);
    this.deleteError.set('');
  }

  confirmDelete() {
    const booking = this.bookingToDelete();
    if (!booking?.id || this.deletingBookingId() !== null) return;
    this.deletingBookingId.set(booking.id);
    this.deleteError.set('');
    this.api.delete<any>(`/admin/bookings/${booking.id}/permanent`).pipe(
      finalize(() => this.deletingBookingId.set(null))
    ).subscribe({
      next: response => {
        this.agendaStore.removeBooking(booking.id);
        this.myBookingsStore.invalidate();
        this.bookingToDelete.set(null);
        this.noticeError.set(false);
        this.notice.set(response?.message ?? 'Turno eliminado del historial.');
      },
      error: error => {
        console.error('[admin-agenda] delete booking error', error);
        this.deleteError.set(error.error?.message ?? 'No se pudo eliminar el turno.');
      }
    });
  }

  private dateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
