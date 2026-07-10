import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, Auth } from '../../core/api';

type Booking = {
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
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="dashboard-page operations-dashboard">
      <header class="dashboard-heading operations-heading">
        <div>
          <span class="eyebrow">ADMINISTRACIÃ“N</span>
          <h1>Panel del club</h1>
          <p>Turnos de hoy y operaciones rÃ¡pidas.</p>
          <strong class="operations-date">{{ formattedDate }}</strong>
        </div>
        <div class="dashboard-actions operations-actions">
          <a class="btn primary" routerLink="/admin/turno">+ Agregar turno</a>
          <a class="btn ghost" routerLink="/admin/turno" [queryParams]="{ mode: 'block' }">Bloquear horario</a>
          <a class="btn ghost" routerLink="/admin/agenda-semanal">Ver semana</a>
        </div>
      </header>

      <nav class="admin-shortcuts operations-nav" aria-label="Operaciones diarias">
        <a routerLink="/admin">Hoy</a>
        <a routerLink="/admin/agenda-diaria">Agenda</a>
        <a routerLink="/admin/turno">Agregar turno</a>
        <a routerLink="/admin/turno" [queryParams]="{ mode: 'block' }">Bloquear horario</a>
      </nav>

      @if (auth.isAdmin() && auth.user()?.role === 'SUPERADMIN') {
        <details class="advanced-menu">
          <summary>ConfiguraciÃ³n y herramientas avanzadas</summary>
          <nav>
            <a routerLink="/admin/precios">Precios</a>
            <a routerLink="/admin/horarios">Horarios</a>
            <a routerLink="/admin/turnos-fijos">Turnos fijos</a>
            <a routerLink="/admin/clientes">Clientes</a>
            <a routerLink="/admin/caja">Caja</a>
            <a routerLink="/admin/estadisticas">EstadÃ­sticas</a>
          </nav>
        </details>
      }

      @if (notice) { <p class="notice" [class.error-notice]="noticeError">{{ notice }}</p> }

      <section class="operations-agenda">
        <div class="section-heading"><div><span class="eyebrow">VALIDACIONES</span><h2>Usuarios pendientes de verificar</h2></div></div>
        <div class="operations-bookings">
          @for (user of pendingUsers; track user.id) {
            <article class="operations-booking">
              <div class="operations-booking__main"><h3>{{ user.firstName }} {{ user.lastName }}</h3><p>{{ user.phone }} · {{ user.createdAt | date:'dd/MM/yyyy HH:mm' }} · {{ user._count?.bookings ?? 0 }} reservas pendientes</p></div>
              <div class="operations-booking__actions"><button type="button" class="small-action" (click)="verifyUser(user)">Marcar como verificado</button><button type="button" class="small-action danger-action" (click)="blockUser(user)">Bloquear</button></div>
            </article>
          } @empty { <div class="empty">No hay usuarios pendientes.</div> }
        </div>
      </section>

      <section class="operations-summary" aria-label="Resumen de hoy">
        <article><span>Turnos de hoy</span><strong>{{ activeBookings.length }}</strong></article>
        <article><span>Total estimado</span><strong>{{ estimatedTotal | currency:'ARS':'symbol':'1.0-0' }}</strong></article>
        <article><span>Cobrado</span><strong>{{ paidTotal | currency:'ARS':'symbol':'1.0-0' }}</strong></article>
        <article><span>Pendiente</span><strong>{{ pendingTotal | currency:'ARS':'symbol':'1.0-0' }}</strong></article>
      </section>

      <section class="operations-agenda">
        <div class="section-heading">
          <div><span class="eyebrow">HOY EN LA CANCHA</span><h2>PrÃ³ximos turnos de hoy</h2></div>
          <label class="operations-date-picker">Cambiar fecha<input type="date" [(ngModel)]="selectedDate" (change)="loadAll()"></label>
        </div>

        @if (loading) {
          <div class="empty">Cargando agenda...</div>
        } @else {
          <div class="operations-bookings">
            @for (booking of bookings; track booking.id) {
              <article class="operations-booking" [class.cancelled]="booking.status === 'CANCELLED'" [class.blocked]="booking.status === 'BLOCKED'">
                <time><b>{{ booking.startTime | date:'HH:mm' }}</b><small>a {{ booking.endTime | date:'HH:mm' }}</small></time>
                <div class="operations-booking__main">
                  <div class="operations-booking__labels">
                    <span [class]="'status-pill status-' + booking.status.toLowerCase()">{{ statusLabel(booking.status) }}</span>
                    <span class="origin-pill">{{ originLabel(booking.origin) }}</span>
                    <span [class.paid]="booking.paymentStatus === 'PAID'" class="payment-pill">{{ paymentLabel(booking.paymentStatus) }}</span>
                  </div>
                  <h3>{{ booking.status === 'BLOCKED' ? 'Horario bloqueado' : booking.clientName }}</h3>
                  <p>
                    @if (booking.status !== 'BLOCKED') { <span>{{ booking.clientPhone }} Â· </span> }
                    {{ booking.durationMinutes }} min
                    @if (booking.status !== 'BLOCKED') { <span> Â· {{ booking.playersCount }} jugadores Â· {{ booking.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</span> }
                  </p>

                </div>
                <div class="operations-booking__actions">                  <button type="button" class="small-action detail-action" (click)="openDetail(booking)">Ver detalle</button>

                  @if (booking.status !== 'BLOCKED' && booking.clientPhone) {
                    <a class="small-action whatsapp-action" [href]="whatsappUrl(booking.clientPhone)" target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  }
                  @if (booking.status === 'PENDING_CONFIRMATION') {
                    <button type="button" class="small-action" (click)="confirmPending(booking)">Confirmar turno</button>
                    <button type="button" class="small-action" (click)="confirmAndVerify(booking)">Confirmar y verificar</button>
                  }
                  @if (booking.status !== 'CANCELLED' && booking.status !== 'BLOCKED') {
                    <a class="small-action" routerLink="/admin/turno" [queryParams]="{ id: booking.id }">Editar</a>
                    <button type="button" class="small-action danger-action" (click)="changeStatus(booking, 'CANCELLED')">Cancelar</button>
                  }
                  @if (booking.status === 'BLOCKED') {
                    <button type="button" class="small-action" (click)="changeStatus(booking, 'CANCELLED')">Liberar horario</button>
                  }
                  @if (booking.status === 'CANCELLED') {
                    <button type="button" class="small-action" (click)="changeStatus(booking, booking.clientName === 'Bloqueo' ? 'BLOCKED' : 'CONFIRMED')">Reactivar</button>
                    <button type="button" class="small-action danger-action" (click)="deleteCancelled(booking)">Eliminar del historial</button>
                  }
                  @if (!['CANCELLED','BLOCKED'].includes(booking.status) && booking.paymentStatus === 'PENDING') {
                    <button type="button" class="small-action" (click)="markPartial(booking)">Marcar seÃ±a</button>
                  }
                  @if (!['CANCELLED','BLOCKED'].includes(booking.status) && booking.paymentStatus !== 'PAID') {
                    <button type="button" class="small-action pay-action" (click)="markPaid(booking)">Marcar pagado</button>
                  }
                </div>
              </article>
            } @empty {
              <div class="empty">No hay turnos cargados para esta fecha.</div>
            }
          </div>
        }
      </section>

      <section class="availability-admin panel operations-availability">
        <div class="section-heading">
          <div><span class="eyebrow">DISPONIBILIDAD</span><h2>Horarios del dÃ­a</h2></div>
          <div class="availability-controls">
            <select [(ngModel)]="availabilityDuration" (change)="loadAvailability()">
              <option [ngValue]="60">60 min</option><option [ngValue]="90">90 min</option><option [ngValue]="120">120 min</option>
            </select>
          </div>
        </div>
        <p class="section-help">TocÃ¡ un horario disponible para cargar un turno. Los horarios pasados y los que no encajan con la duraciÃ³n elegida se muestran por separado.</p>
        <div class="admin-slots operations-slots">
          @for (slot of visibleSlots; track slot.startTime) {
            <button type="button" [class.occupied]="!slot.available" [class.blocked]="slotState(slot) === 'Bloqueado'" [class.past]="slot.reason === 'PAST'" [class.duration-gap]="slot.reason === 'DEAD_GAP'" (click)="openSlot(slot)">
              <b>{{ slot.startTime }}</b><span>{{ slotState(slot) }}</span>
            </button>
          } @empty { <div class="empty">No hay horarios para esta fecha.</div> }
        </div>
      </section>
    </section>

    @if (selectedBooking) {
      <div class="modal-backdrop" (click)="closeDetail()">
        <section class="booking-modal admin-detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" (click)="$event.stopPropagation()">
          <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeDetail()">Ã—</button>
          <span class="eyebrow">DETALLE DEL TURNO</span>
          <h2 id="detail-title">{{ selectedBooking.status === 'BLOCKED' ? 'Horario bloqueado' : selectedBooking.clientName }}</h2>
          @if (detailLoading) { <p>Cargando informaciÃ³n...</p> }

          <div class="detail-status-row">
            <span [class]="'status-pill status-' + selectedBooking.status.toLowerCase()">Estado: {{ statusLabel(selectedBooking.status) }}</span>
            <span class="origin-pill">Origen: {{ originLabel(selectedBooking.origin) }}</span>
            <span [class.paid]="selectedBooking.paymentStatus === 'PAID'" class="payment-pill">Pago: {{ paymentLabel(selectedBooking.paymentStatus) }}</span>
          </div>

          <div class="booking-detail-grid">
            @if (selectedBooking.status !== 'BLOCKED') {
              <section><h3>Cliente</h3><dl><div><dt>Nombre</dt><dd>{{ clientFirstName(selectedBooking.clientName) }}</dd></div><div><dt>Apellido</dt><dd>{{ clientLastName(selectedBooking.clientName) }}</dd></div><div><dt>TelÃ©fono</dt><dd>{{ selectedBooking.clientPhone }}</dd></div></dl></section>
            }
            <section><h3>Turno</h3><dl><div><dt>Fecha</dt><dd>{{ selectedBooking.startTime | date:'EEEE d MMMM' }}</dd></div><div><dt>Horario</dt><dd>{{ selectedBooking.startTime | date:'HH:mm' }} a {{ selectedBooking.endTime | date:'HH:mm' }}</dd></div><div><dt>DuraciÃ³n</dt><dd>{{ selectedBooking.durationMinutes }} minutos</dd></div>@if (selectedBooking.status !== 'BLOCKED') {<div><dt>Jugadores</dt><dd>{{ selectedBooking.playersCount }}</dd></div><div><dt>Precio</dt><dd>{{ selectedBooking.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</dd></div>}</dl></section>
            <section><h3>Estado</h3><dl><div><dt>Estado del turno</dt><dd>{{ statusLabel(selectedBooking.status) }}</dd></div><div><dt>Estado del pago</dt><dd>{{ paymentLabel(selectedBooking.paymentStatus) }}</dd></div><div><dt>Origen</dt><dd>{{ originLabel(selectedBooking.origin) }}</dd></div></dl></section>
            <section><h3>InformaciÃ³n adicional</h3><dl><div><dt>ObservaciÃ³n</dt><dd>{{ selectedBooking.notes || 'Sin observaciones' }}</dd></div><div><dt>Creado</dt><dd>{{ selectedBooking.createdAt ? (selectedBooking.createdAt | date:'dd/MM/yyyy HH:mm') : 'â€”' }}</dd></div><div><dt>Ãšltima modificaciÃ³n</dt><dd>{{ selectedBooking.updatedAt ? (selectedBooking.updatedAt | date:'dd/MM/yyyy HH:mm') : 'â€”' }}</dd></div><div><dt>Cargado por</dt><dd>{{ selectedBooking.creator ? selectedBooking.creator.firstName + ' ' + selectedBooking.creator.lastName : 'Usuario #' + selectedBooking.createdBy }}</dd></div></dl></section>
          </div>

          <div class="detail-actions">
            @if (selectedBooking.status !== 'BLOCKED' && selectedBooking.clientPhone) {<a class="btn ghost" [href]="whatsappUrl(selectedBooking.clientPhone)" target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            @if (!['CANCELLED','BLOCKED'].includes(selectedBooking.status)) {<a class="btn ghost" routerLink="/admin/turno" [queryParams]="{id:selectedBooking.id}">Editar</a><button type="button" class="btn danger" (click)="changeStatus(selectedBooking,'CANCELLED')">Cancelar</button>}
            @if (selectedBooking.status === 'BLOCKED') {<button type="button" class="btn ghost" (click)="changeStatus(selectedBooking,'CANCELLED')">Liberar horario</button>}
            @if (!['CANCELLED','BLOCKED'].includes(selectedBooking.status) && selectedBooking.paymentStatus === 'PENDING') {<button type="button" class="btn ghost" (click)="markPartial(selectedBooking)">Marcar seÃ±a</button>}
            @if (!['CANCELLED','BLOCKED'].includes(selectedBooking.status) && selectedBooking.paymentStatus !== 'PAID') {<button type="button" class="btn primary" (click)="markPaid(selectedBooking)">Marcar pagado</button>}
          </div>
        </section>
      </div>
    }

  `
})
export class AdminDashboardPage implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  public auth = inject(Auth);

  selectedDate = this.dateInput(new Date());
  availabilityDuration = 90;
  bookings: Booking[] = [];
  availability: any;
  pendingUsers: any[] = [];
  loading = false;
  notice = '';
  noticeError = false;
  selectedBooking: Booking | null = null;
  detailLoading = false;

  get formattedDate() {
    const value = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
    }).format(new Date(`${this.selectedDate}T12:00:00Z`));
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  get visibleSlots() { return (this.availability?.slots ?? []).filter((slot: any) => slot.available || slot.reason === 'OCCUPIED'); }
  get activeBookings() { return this.bookings.filter(item => !['CANCELLED', 'BLOCKED'].includes(item.status)); }
  get estimatedTotal() { return this.activeBookings.reduce((total, item) => total + Number(item.priceTotal), 0); }
  get paidTotal() { return this.activeBookings.filter(item => item.paymentStatus === 'PAID').reduce((total, item) => total + Number(item.priceTotal), 0); }
  get pendingTotal() { return Math.max(0, this.estimatedTotal - this.paidTotal); }

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.loadBookings();
    this.loadAvailability();
  }

  loadBookings() {
    this.loading = true;
    const from = new Date(`${this.selectedDate}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    this.api.get<Booking[]>('/admin/bookings', { from: from.toISOString(), to: to.toISOString() }).subscribe({
      next: bookings => { this.bookings = bookings; this.loading = false; },
      error: error => { this.showNotice(error.error?.message ?? 'No se pudo cargar la agenda.', true); this.loading = false; }
    });
  }

  loadPendingUsers() {
    this.api.get<any[]>('/admin/users/pending-verification').subscribe({
      next: users => this.pendingUsers = users,
      error: error => this.showNotice(error.error?.message ?? 'No se pudieron cargar usuarios pendientes.', true)
    });
  }

  loadAvailability() {
    this.api.get<any>('/availability', {
      date: this.selectedDate, duration: this.availabilityDuration, courtId: 1
    }).subscribe({
      next: data => this.availability = data,
      error: error => this.showNotice(error.error?.message ?? 'No se pudo cargar la disponibilidad.', true)
    });
  }

  openDetail(booking: Booking) {
    this.selectedBooking = booking;
    this.detailLoading = true;
    this.api.get<Booking>(`/admin/bookings/${booking.id}`).subscribe({
      next: detail => { Object.assign(booking, detail); this.detailLoading = false; },
      error: error => { this.detailLoading = false; this.showNotice(error.error?.message ?? 'No se pudo cargar el detalle.', true); }
    });
  }

  closeDetail() { this.selectedBooking = null; }
  clientFirstName(name: string) { return name.trim().split(/\s+/)[0] ?? ''; }
  clientLastName(name: string) { return name.trim().split(/\s+/).slice(1).join(' ') || 'â€”'; }
  changeStatus(booking: Booking, status: string) {
    this.api.patch<any>(`/admin/bookings/${booking.id}/status`, { status }).subscribe({
      next: () => {
        booking.status = status;
        this.showNotice(status === 'CANCELLED'
          ? (booking.clientName === 'Bloqueo' ? 'Horario liberado correctamente.' : 'Turno cancelado correctamente.')
          : 'Turno reactivado correctamente.');
        this.loadAvailability();
      },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo actualizar el turno.', true)
    });
  }

  verifyUser(user: any) {
    this.api.patch<any>('/admin/users/' + user.id + '/verify', {}).subscribe({
      next: () => { this.pendingUsers = this.pendingUsers.filter((item: any) => item.id !== user.id); this.showNotice('Usuario verificado.'); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo verificar el usuario.', true)
    });
  }
  blockUser(user: any) {
    this.api.patch<any>('/admin/users/' + user.id, { isBlocked: true }).subscribe({
      next: () => { this.pendingUsers = this.pendingUsers.filter((item: any) => item.id !== user.id); this.showNotice('Usuario bloqueado.'); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo bloquear el usuario.', true)
    });
  }
  confirmPending(booking: Booking) {
    this.api.patch<any>('/admin/reservations/' + booking.id + '/confirm', {}).subscribe({
      next: () => { booking.status = 'CONFIRMED'; this.showNotice('Turno confirmado.'); this.loadAvailability(); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo confirmar el turno.', true)
    });
  }
  confirmAndVerify(booking: Booking) {
    this.api.patch<any>('/admin/reservations/' + booking.id + '/confirm-and-verify-user', {}).subscribe({
      next: () => { booking.status = 'CONFIRMED'; this.showNotice('Turno confirmado y usuario verificado.'); this.loadPendingUsers(); this.loadAvailability(); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo confirmar y verificar.', true)
    });
  }

  deleteCancelled(booking: Booking) {
    if (booking.status !== 'CANCELLED') return;
    if (!window.confirm(`Â¿Eliminar definitivamente el turno cancelado de ${booking.clientName}?`)) return;
    this.api.delete<any>(`/admin/bookings/${booking.id}/permanent`).subscribe({
      next: response => {
        this.bookings = this.bookings.filter(item => item.id !== booking.id);
        this.showNotice(response?.message ?? 'Turno eliminado del historial.');
      },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo eliminar el turno.', true)
    });
  }
  markPartial(booking: Booking) {
    this.api.patch<any>(`/admin/bookings/${booking.id}/payment`, {
      paymentStatus: 'PARTIAL', paymentMethod: 'EFECTIVO', createCashMovement: false
    }).subscribe({
      next: () => { booking.paymentStatus = 'PARTIAL'; this.showNotice('SeÃ±a registrada correctamente.'); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo registrar la seÃ±a.', true)
    });
  }
  markPaid(booking: Booking) {
    this.api.patch<any>(`/admin/bookings/${booking.id}/payment`, {
      paymentStatus: 'PAID', paymentMethod: 'EFECTIVO', createCashMovement: true
    }).subscribe({
      next: () => { booking.paymentStatus = 'PAID'; this.showNotice('Pago registrado correctamente.'); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo registrar el pago.', true)
    });
  }

  openSlot(slot: any) {
    if (slot.available) {
      this.router.navigate(['/admin/turno'], {
        queryParams: { date: this.selectedDate, startTime: slot.startTime, durationMinutes: this.availabilityDuration }
      });
      return;
    }
    const booking = this.bookingAt(slot.startTime);
    if (booking?.status === 'BLOCKED') {
      this.showNotice('Este horario estÃ¡ bloqueado. PodÃ©s liberarlo desde la agenda.');
      return;
    }
    if (booking) this.router.navigate(['/admin/turno'], { queryParams: { id: booking.id } });
  }

  slotState(slot: any) {
    if (slot.available) return 'Disponible';
    if (slot.reason === 'PAST') return 'Ya pasÃ³';
    const booking = this.bookingAt(slot.startTime);
    if (booking?.status === 'BLOCKED') return 'Bloqueado';
    if (booking) return 'Ocupado';
    if (slot.reason === 'DEAD_GAP') return 'No encaja';
    return 'No disponible';
  }

  whatsappUrl(phone: string) {
    const digits = phone.replace(/\D/g, '');
    const international = digits.startsWith('54') ? digits : `549${digits}`;
    return `https://wa.me/${international}`;
  }

  statusLabel(status: string) {
    return ({
      PENDING_CONFIRMATION: 'Pendiente WhatsApp', CONFIRMED: 'Confirmado', PLAYED: 'Jugado',
      CANCELLED: 'Cancelado', NO_SHOW: 'No asistiÃ³', BLOCKED: 'Bloqueado'
    } as Record<string, string>)[status] ?? status;
  }

  originLabel(origin?: string) {
    return ({ WEB: 'Web', WHATSAPP: 'WhatsApp', MANUAL: 'Manual' } as Record<string, string>)[origin ?? 'WEB'] ?? 'Web';
  }

  paymentLabel(status: string) {
    return ({ PENDING: 'Pago pendiente', PAID: 'Pagado', PARTIAL: 'SeÃ±a pagada' } as Record<string, string>)[status] ?? 'Pago pendiente';
  }

  private bookingAt(time: string) {
    return this.bookings.find(item => this.bookingTime(item.startTime) === time && item.status !== 'CANCELLED');
  }

  private bookingTime(value: string) {
    return new Intl.DateTimeFormat('es-AR', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires'
    }).format(new Date(value));
  }

  private showNotice(message: string, error = false) {
    this.notice = message;
    this.noticeError = error;
  }

  private dateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
