import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { finalize, forkJoin } from 'rxjs';
import { AsyncStatus } from '../../shared/async-state';
import { AdminAgendaStore } from './admin-agenda-store';
import { MyBookingsStore } from '../client/my-bookings-store';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="admin-form-page">
      <a class="back-link" routerLink="/admin">← Volver al panel</a>
      <div class="admin-form-heading">
        <span class="eyebrow">AGENDA</span>
        <h1>{{ bookingId ? 'Editar turno.' : mode === 'BLOCK' ? 'Bloquear horario.' : 'Nuevo turno.' }}</h1>
        <p>{{ bookingId ? 'Actualizá los datos del turno y guardá los cambios.' : mode === 'BLOCK' ? 'Reservá un bloque para mantenimiento, cierre o evento privado.' : 'Cargá una reserva web, de WhatsApp o tomada manualmente.' }}</p>
      </div>

      @if (!created) {
        @if (!bookingId) {
          <div class="booking-mode-switch" role="group" aria-label="Tipo de carga">
            <button type="button" [class.active]="mode === 'BOOKING'" (click)="setMode('BOOKING')">Crear turno</button>
            <button type="button" [class.active]="mode === 'BLOCK'" (click)="setMode('BLOCK')">Bloquear horario</button>
          </div>
        }

        <form class="panel manual-booking-form" (ngSubmit)="save()">
          @if (mode === 'BOOKING') {
            <div class="form-section-title"><span>01</span><div><h2>Cliente</h2><p>Datos básicos para identificar y contactar a la persona.</p></div></div>
            <div class="booking-mode-switch client-mode-switch" role="group" aria-label="Tipo de cliente">
              <button type="button" [class.active]="form.clientMode === 'EXISTING'" (click)="setClientMode('EXISTING')">Cliente existente</button>
              <button type="button" [class.active]="form.clientMode === 'MANUAL'" (click)="setClientMode('MANUAL')">Carga manual</button>
            </div>
            @if (form.clientMode === 'EXISTING') {
              <div class="client-picker-field">
                <label>Buscar cliente<input type="search" placeholder="Nombre, apellido o telefono" [(ngModel)]="clientSearch" name="clientSearch"></label>
                <div class="client-picker-list">
                  @for (client of filteredClients; track client.id) {
                    <button type="button" [class.selected]="form.userId === client.id" (click)="selectClient(client)">
                      <b>{{ client.firstName }} {{ client.lastName }}</b><span>{{ client.phone }}</span>
                    </button>
                  } @empty {
                    <p>{{ resourcesStatus === 'loading' ? 'Cargando clientes...' : 'No hay clientes para esa búsqueda.' }}</p>
                  }
                </div>
              </div>
            }
            <div class="form-grid">
              <label>Nombre<input required minlength="2" [disabled]="form.clientMode === 'EXISTING'" [(ngModel)]="form.firstName" name="firstName"></label>
              <label>Apellido<input required minlength="2" [disabled]="form.clientMode === 'EXISTING'" [(ngModel)]="form.lastName" name="lastName"></label>
              <label>Telefono<input required minlength="6" [disabled]="form.clientMode === 'EXISTING'" inputmode="tel" [(ngModel)]="form.clientPhone" name="clientPhone"></label>
              <label>Origen<select [(ngModel)]="form.origin" name="origin"><option value="WHATSAPP">WhatsApp</option><option value="MANUAL">Manual</option><option value="WEB">Web</option></select></label>
            </div>
          }

          <div class="form-section-title"><span>{{ mode === 'BOOKING' ? '02' : '01' }}</span><div><h2>{{ mode === 'BLOCK' ? 'Bloqueo' : 'Turno' }}</h2><p>La disponibilidad se valida nuevamente antes de guardar.</p></div></div>
          <div class="form-grid three">
            <label>Fecha<input required type="date" [(ngModel)]="form.date" name="date"></label>
            <label>Hora de inicio<input required type="time" step="1800" [(ngModel)]="form.startTime" name="startTime"></label>
            <label>Duración<select [(ngModel)]="form.durationMinutes" name="durationMinutes" (ngModelChange)="syncPrice()"><option [ngValue]="60">60 minutos</option><option [ngValue]="90">90 minutos</option><option [ngValue]="120">120 minutos</option></select></label>
            @if (mode === 'BOOKING') {
              <label>Precio<input required type="number" min="1" [(ngModel)]="form.priceTotal" name="priceTotal"></label>
              <label>Jugadores<input required type="number" min="1" max="12" [(ngModel)]="form.playersCount" name="playersCount"></label>
            }
            <label class="wide">Observación <small>(opcional)</small><textarea maxlength="1000" [(ngModel)]="form.notes" name="notes" [placeholder]="mode === 'BLOCK' ? 'Ej. mantenimiento de la cancha' : 'Información útil para el turno'"></textarea></label>
          </div>

          @if (mode === 'BOOKING') {
            <div class="manual-total"><span>Precio del turno</span><strong>{{ form.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
          }
          @if (warning) { <div class="notice"><strong>Atención</strong><p>{{ warning }}</p><div class="actions"><button type="button" class="btn ghost" (click)="warning = ''">Elegir otro horario</button><button type="button" class="btn primary" [disabled]="saving" (click)="save(true)">Guardar igualmente</button></div></div> }
          @if (error) { <p class="notice error-notice">{{ error }}</p> }
          <button class="btn primary full" [disabled]="saving">{{ saving ? 'Guardando...' : bookingId ? 'Guardar cambios' : mode === 'BLOCK' ? 'Bloquear horario' : 'Guardar turno' }}</button>
        </form>
      } @else {
        <div class="panel manual-success">
          <span class="success-check">✓</span>
          <span class="eyebrow">{{ mode === 'BLOCK' ? 'HORARIO BLOQUEADO' : bookingId ? 'TURNO MODIFICADO' : 'TURNO CREADO' }}</span>
          <h2>La agenda está actualizada.</h2>
          <p>{{ successMessage }}</p>
          <div class="actions"><a class="btn primary" routerLink="/admin">Volver al panel</a><button class="btn ghost" (click)="reset()">Crear otro</button></div>
        </div>
      }
    </section>
  `,
  styles: [`
    .client-mode-switch{margin:12px 0 16px;max-width:430px}
    .client-picker-field{display:grid;gap:10px;margin:0 0 18px}
    .client-picker-field label{display:grid;gap:7px;font-size:.72rem;font-weight:800;text-transform:uppercase;color:var(--muted)}
    .client-picker-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
    .client-picker-list button{min-height:54px;padding:10px 12px;border:1px solid rgba(34,53,38,.14);border-radius:9px;background:#fffdf5;color:var(--color-green-dark);display:grid;gap:3px;text-align:left;cursor:pointer}
    .client-picker-list button.selected{border-color:var(--color-green-main);background:#edf2e7;box-shadow:0 0 0 2px rgba(83,111,67,.14)}
    .client-picker-list b{font-family:var(--font-display);font-size:.96rem;font-weight:600}
    .client-picker-list span,.client-picker-list p{margin:0;color:#6f7a70;font-size:.75rem}
  `]
})
export class AdminBookingFormPage implements OnInit {
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private agendaStore = inject(AdminAgendaStore);
  private myBookingsStore = inject(MyBookingsStore);

  mode: 'BOOKING' | 'BLOCK' = 'BOOKING';
  bookingId: number | null = null;
  form: any = {
    courtId: 1, firstName: '', lastName: '', clientPhone: '', origin: 'WHATSAPP',
    date: '', startTime: '18:00', durationMinutes: 90, priceTotal: 0,
    playersCount: 4, notes: '', status: 'CONFIRMED', clientMode: 'EXISTING', userId: null
  };
  prices: any[] = [];
  clients: any[] = [];
  clientSearch = '';
  saving = false;
  created = false;
  error = '';
  warning = '';
  resourcesStatus: AsyncStatus = 'idle';

  get successMessage() {
    if (this.mode === 'BLOCK') return 'El horario quedó bloqueado correctamente.';
    return this.bookingId ? 'El turno fue modificado correctamente.' : 'El turno manual fue creado correctamente.';
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.form.date = params.get('date') ?? this.dateInput(new Date());
    this.form.startTime = params.get('startTime') ?? '18:00';
    this.form.durationMinutes = Number(params.get('durationMinutes') ?? 90);
    this.mode = params.get('mode') === 'block' ? 'BLOCK' : 'BOOKING';
    this.bookingId = Number(params.get('id')) || null;
    this.resourcesStatus = 'loading';
    forkJoin({
      prices: this.api.get<unknown>('/prices', undefined, { noCache: true }),
      clients: this.api.get<unknown>('/admin/users', undefined, { noCache: true })
    }).subscribe({
      next: ({ prices, clients }) => {
        this.prices = this.normalizeList(prices, 'prices');
        this.clients = this.normalizeList(clients, 'users').filter(client => client.role === 'CLIENT' && client.active);
        this.resourcesStatus = 'success';
        this.syncPrice();
        if (this.bookingId) this.loadBooking(this.bookingId);
      },
      error: response => {
        this.resourcesStatus = 'error';
        this.error = response.error?.message ?? 'No se pudieron cargar los datos del formulario.';
      }
    });
  }

  get filteredClients() {
    const term = this.clientSearch.trim().toLowerCase();
    return this.clients.filter(client => {
      if (!term) return true;
      return `${client.firstName} ${client.lastName} ${client.phone}`.toLowerCase().includes(term);
    }).slice(0, 8);
  }

  setMode(mode: 'BOOKING' | 'BLOCK') {
    this.mode = mode;
    this.created = false;
    this.error = '';
    this.warning = '';
  }

  syncPrice() {
    const price = this.prices.find(item => item.durationMinutes === this.form.durationMinutes);
    if (price) this.form.priceTotal = price.price;
  }

  setClientMode(mode: 'EXISTING' | 'MANUAL') {
    this.form.clientMode = mode;
    this.form.userId = null;
    this.clientSearch = '';
    if (mode === 'MANUAL') {
      this.form.firstName = '';
      this.form.lastName = '';
      this.form.clientPhone = '';
    }
  }

  selectClient(client: any) {
    this.form.userId = client.id;
    this.form.firstName = client.firstName;
    this.form.lastName = client.lastName;
    this.form.clientPhone = client.phone;
    this.clientSearch = `${client.firstName} ${client.lastName}`;
  }

  save(adminOverride = false) {
    if (this.saving) return;
    this.error = '';
    if (!adminOverride) this.warning = '';
    if (this.mode === 'BOOKING' && this.form.clientMode === 'EXISTING' && !this.form.userId) {
      this.error = 'Eleg� un cliente existente o cambi� a carga manual.';
      return;
    }
    if (!this.form.date || !this.form.startTime || !this.form.durationMinutes) {
      this.error = 'Complet� fecha, hora y duraci�n.';
      return;
    }
    this.saving = true;

    const bookingData = {
      courtId: 1,
      userId: this.form.clientMode === 'EXISTING' ? this.form.userId : null,
      clientName: `${this.form.firstName.trim()} ${this.form.lastName.trim()}`,
      clientPhone: this.form.clientPhone.trim(),
      date: this.form.date,
      startTime: this.form.startTime,
      durationMinutes: this.form.durationMinutes,
      playersCount: this.form.playersCount,
      notes: this.form.notes.trim() || undefined,
      status: 'CONFIRMED',
      origin: this.form.origin,
      priceTotal: Number(this.form.priceTotal),
      adminOverride
    };

    const request = this.bookingId
      ? this.api.patch(`/admin/bookings/${this.bookingId}`, bookingData)
      : this.mode === 'BLOCK'
        ? this.api.post('/admin/blocks', {
            date: this.form.date,
            startTime: this.form.startTime,
            durationMinutes: this.form.durationMinutes,
            notes: this.form.notes.trim() || undefined
          })
        : this.api.post('/admin/bookings', bookingData);

    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: () => {
        this.created = true;
        this.warning = '';
        this.agendaStore.invalidate();
        this.myBookingsStore.invalidate();
      },
      error: response => {
        if (response.error?.code === 'DEAD_GAP') this.warning = response.error.message;
        else this.error = response.error?.message ?? (this.mode === 'BLOCK' ? 'No se pudo bloquear el horario.' : 'No se pudo guardar el turno.');
      }
    });
  }

  reset() {
    this.created = false;
    this.bookingId = null;
    this.form.firstName = '';
    this.form.lastName = '';
    this.form.clientPhone = '';
    this.form.userId = null;
    this.form.clientMode = 'EXISTING';
    this.clientSearch = '';
    this.form.notes = '';
    this.warning = '';
    this.error = '';
  }

  private loadBooking(id: number) {
    this.api.get<any>(`/admin/bookings/${id}`).subscribe({
      next: booking => {
        if (!booking) { this.error = 'No encontramos ese turno.'; return; }
        const parts = String(booking.clientName ?? '').trim().split(/\s+/);
        this.form.userId = booking.userId ?? null;
        this.form.clientMode = booking.userId ? 'EXISTING' : 'MANUAL';
        this.form.firstName = parts.shift() ?? '';
        this.form.lastName = parts.join(' ');
        this.form.clientPhone = booking.clientPhone ?? '';
        if (booking.user) this.clientSearch = `${booking.user.firstName} ${booking.user.lastName}`;
        this.form.date = this.dateInput(new Date(booking.startTime));
        this.form.startTime = new Intl.DateTimeFormat('es-AR', {
          hour: '2-digit', minute: '2-digit', hour12: false,
          timeZone: 'America/Argentina/Buenos_Aires'
        }).format(new Date(booking.startTime));
        this.form.durationMinutes = booking.durationMinutes;
        this.form.playersCount = booking.playersCount;
        this.form.priceTotal = Number(booking.priceTotal);
        this.form.origin = booking.origin ?? 'MANUAL';
        this.form.notes = booking.notes ?? '';
      },
      error: response => this.error = response.error?.message ?? 'No se pudo cargar el turno.'
    });
  }

  private normalizeList(response: unknown, key: string): any[] {
    const value = response as any;
    const normalized = Array.isArray(response) ? response : value?.[key] ?? value?.data?.[key] ?? [];
    return Array.isArray(normalized) ? normalized : [];
  }

  private dateInput(date: Date) {
    const values = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires'
    }).formatToParts(date);
    const part = (type: string) => values.find(item => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
}
