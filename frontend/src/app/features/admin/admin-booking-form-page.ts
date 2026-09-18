import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { debounceTime, finalize, forkJoin, merge } from 'rxjs';
import { RealtimeEvent, RealtimeService } from '../../core/realtime';
import { AsyncStatus } from '../../shared/async-state';
import { AdminAgendaStore } from './admin-agenda-store';
import { MyBookingsStore } from '../client/my-bookings-store';

type AvailabilitySlot = {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: 'PAST' | 'OCCUPIED' | 'DEAD_GAP' | string | null;
  message?: string | null;
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="admin-form-page">
      <div class="admin-form-container">
        <a class="back-link" routerLink="/admin">← Volver al panel</a>
        <div class="admin-form-heading">
          <span class="eyebrow">AGENDA</span>
          <h1>{{ bookingId ? 'Editar turno.' : mode === 'BLOCK' ? 'Bloquear horario.' : 'Nuevo turno.' }}</h1>
          <p>{{ bookingId ? 'Actualizá los datos del turno y guardá los cambios.' : mode === 'BLOCK' ? 'Reservá un bloque para mantenimiento, cierre o evento privado.' : 'Cargá una reserva web, de WhatsApp o tomada manualmente.' }}</p>
        </div>

      @if (!created) {
        @if (!bookingId) {
          <div class="booking-mode-switch page-mode-switch" role="group" aria-label="Tipo de carga">
            <button type="button" [class.active]="mode === 'BOOKING'" [attr.aria-pressed]="mode === 'BOOKING'" (click)="setMode('BOOKING')">Crear turno</button>
            <button type="button" [class.active]="mode === 'BLOCK'" [attr.aria-pressed]="mode === 'BLOCK'" (click)="setMode('BLOCK')">Bloquear horario</button>
          </div>
        }

        <form class="panel manual-booking-form" (ngSubmit)="save()">
          @if (mode === 'BOOKING') {
            <div class="form-section-title"><span>01</span><div><h2>Cliente</h2><p>Datos básicos para identificar y contactar a la persona.</p></div></div>
            <div class="booking-mode-switch client-mode-switch" role="group" aria-label="Tipo de cliente">
              <button type="button" [class.active]="form.clientMode === 'EXISTING'" [attr.aria-pressed]="form.clientMode === 'EXISTING'" (click)="setClientMode('EXISTING')">Cliente existente</button>
              <button type="button" [class.active]="form.clientMode === 'MANUAL'" [attr.aria-pressed]="form.clientMode === 'MANUAL'" (click)="setClientMode('MANUAL')">Carga manual</button>
            </div>
            @if (form.clientMode === 'EXISTING') {
              <div class="client-picker-field">
                <label>Buscar cliente<input type="search" autocomplete="off" placeholder="Nombre, apellido o teléfono…" [(ngModel)]="clientSearch" name="clientSearch"></label>
                <div class="client-picker-list">
                  @for (client of filteredClients; track client.id) {
                    <button type="button" [class.selected]="form.userId === client.id" [attr.aria-pressed]="form.userId === client.id" (click)="selectClient(client)">
                      <b>{{ client.firstName }} {{ client.lastName }}</b><span>{{ client.phone }}</span>
                    </button>
                  } @empty {
                    <p>{{ resourcesStatus() === 'loading' ? 'Cargando clientes...' : 'No hay clientes para esa búsqueda.' }}</p>
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
            <label class="schedule-field">Fecha<input required type="date" [(ngModel)]="form.date" name="date" (ngModelChange)="onScheduleChange()"></label>
            <label class="schedule-field slot-field">Hora de inicio
              <select required [(ngModel)]="form.startTime" name="startTime" [disabled]="availabilityStatus() === 'loading' || selectableSlots.length === 0">
                @for (slot of selectableSlots; track slot.startTime) {
                  <option [value]="slot.startTime">{{ slot.startTime }} — {{ slot.endTime }}</option>
                }
              </select>
              @if (availabilityStatus() === 'loading') {
                <small>Buscando horarios disponibles…</small>
              } @else if (availabilityStatus() === 'error') {
                <small class="slot-error">{{ availabilityError }}</small>
              } @else if (selectableSlots.length === 0) {
                <small>No hay horarios disponibles para esta fecha y duración.</small>
              } @else {
                <small>{{ selectableSlots.length }} {{ selectableSlots.length === 1 ? 'horario disponible' : 'horarios disponibles' }}</small>
              }
            </label>
            <label class="schedule-field">Duración<select [(ngModel)]="form.durationMinutes" name="durationMinutes" (ngModelChange)="onDurationChange()"><option [ngValue]="60">60 minutos</option><option [ngValue]="90">90 minutos</option><option [ngValue]="120">120 minutos</option></select></label>
            @if (mode === 'BOOKING') {
              <label class="financial-field">Precio<input required type="number" min="1" [(ngModel)]="form.priceTotal" name="priceTotal"></label>
              <label class="financial-field">Jugadores<input required type="number" min="1" max="12" [(ngModel)]="form.playersCount" name="playersCount"></label>
            }
            <label class="wide notes-field">Observación <small>(opcional)</small><textarea maxlength="1000" [(ngModel)]="form.notes" name="notes" [placeholder]="mode === 'BLOCK' ? 'Ej. mantenimiento de la cancha…' : 'Información útil para el turno…'"></textarea></label>
          </div>

          @if (mode === 'BOOKING') {
            <div class="manual-total"><span>Precio del turno</span><strong>{{ form.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
          }
          @if (error) { <p class="notice error-notice">{{ error }}</p> }
          <button type="submit" class="btn primary full" [disabled]="saving() || availabilityStatus() === 'loading' || selectableSlots.length === 0">{{ saving() ? 'Guardando…' : bookingId ? 'Guardar cambios' : mode === 'BLOCK' ? 'Bloquear horario' : 'Guardar turno' }}</button>
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
      </div>
    </section>
  `,
})
export class AdminBookingFormPage implements OnInit, OnDestroy {
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private agendaStore = inject(AdminAgendaStore);
  private myBookingsStore = inject(MyBookingsStore);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  mode: 'BOOKING' | 'BLOCK' = 'BOOKING';
  bookingId: number | null = null;
  form: any = {
    courtId: 0, firstName: '', lastName: '', clientPhone: '', origin: 'WHATSAPP',
    date: '', startTime: '18:00', durationMinutes: 90, priceTotal: 0,
    playersCount: 4, notes: '', status: 'CONFIRMED', clientMode: 'EXISTING', userId: null
  };
  prices: any[] = [];
  clients: any[] = [];
  slots: AvailabilitySlot[] = [];
  clientSearch = '';
  readonly saving = signal(false);
  created = false;
  error = '';
  availabilityError = '';
  readonly resourcesStatus = signal<AsyncStatus>('idle');
  readonly availabilityStatus = signal<AsyncStatus>('idle');
  private availabilityRequestId = 0;
  private availabilityAbort: AbortController | null = null;

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
    this.resourcesStatus.set('loading');
    forkJoin({
      prices: this.api.get<unknown>('/prices', undefined, { noCache: true }),
      clients: this.api.get<unknown>('/admin/users', undefined, { noCache: true }),
      courts: this.api.get<unknown>('/courts', undefined, { noCache: true })
    }).subscribe({
      next: ({ prices, clients, courts }) => {
        this.prices = this.normalizeList(prices, 'prices');
        this.clients = this.normalizeList(clients, 'users').filter(client => client.role === 'CLIENT' && client.active);
        this.form.courtId = Number(this.normalizeList(courts, 'courts')[0]?.id ?? 0);
        if (!this.form.courtId) {
          this.resourcesStatus.set('error');
          this.error = 'No hay una cancha activa configurada.';
          return;
        }
        this.resourcesStatus.set('success');
        this.syncPrice();
        if (this.bookingId) this.loadBooking(this.bookingId);
        else this.loadAvailability();
      },
      error: response => {
        this.resourcesStatus.set('error');
        this.error = response.error?.message ?? 'No se pudieron cargar los datos del formulario.';
      }
    });
    merge(
      this.realtime.listen([
        'AVAILABILITY_CHANGED', 'BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED', 'BOOKING_STATUS_CHANGED', 'SCHEDULE_BLOCKED', 'SCHEDULE_UNBLOCKED',
        'CONFIGURATION_CHANGED', 'USER_CREATED', 'USER_UPDATED', 'USER_VERIFICATION_CHANGED'
      ]),
      this.realtime.resync$
    ).pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef)).subscribe(change => {
      if (this.saving()) return;
      if (typeof change !== 'object' || ['CONFIGURATION_CHANGED', 'USER_CREATED', 'USER_UPDATED', 'USER_VERIFICATION_CHANGED'].includes((change as RealtimeEvent).type)) {
        this.refreshReferenceData();
      } else if (this.bookingId && (change as RealtimeEvent).resource.bookingId === this.bookingId) {
        this.loadBooking(this.bookingId);
      } else {
        this.loadAvailability();
      }
    });
  }

  ngOnDestroy() {
    ++this.availabilityRequestId;
    this.availabilityAbort?.abort();
    this.availabilityAbort = null;
  }

  get filteredClients() {
    const term = this.clientSearch.trim().toLowerCase();
    return this.clients.filter(client => {
      if (!term) return true;
      return `${client.firstName} ${client.lastName} ${client.phone}`.toLowerCase().includes(term);
    }).slice(0, 8);
  }

  get selectableSlots() {
    return this.slots.filter(slot =>
      slot.available || (this.mode === 'BLOCK' && slot.reason === 'DEAD_GAP')
    );
  }

  setMode(mode: 'BOOKING' | 'BLOCK') {
    this.mode = mode;
    this.created = false;
    this.error = '';
    this.selectValidStartTime();
  }

  syncPrice() {
    const price = this.prices.find(item => item.durationMinutes === this.form.durationMinutes);
    if (price) this.form.priceTotal = price.price;
  }

  onDurationChange() {
    this.syncPrice();
    this.onScheduleChange();
  }

  onScheduleChange() {
    this.error = '';
    this.loadAvailability();
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

  save() {
    if (this.saving()) return;
    this.error = '';
    if (this.mode === 'BOOKING' && this.form.clientMode === 'EXISTING' && !this.form.userId) {
      this.error = 'Elegí un cliente existente o cambiá a carga manual.';
      return;
    }
    if (!this.form.date || !this.form.startTime || !this.form.durationMinutes) {
      this.error = 'Completá fecha, hora y duración.';
      return;
    }
    if (this.availabilityStatus() !== 'success' || !this.selectableSlots.some(slot => slot.startTime === this.form.startTime)) {
      this.error = 'Elegí uno de los horarios disponibles.';
      return;
    }
    this.saving.set(true);

    const bookingData = {
      courtId: this.form.courtId,
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
      priceTotal: Number(this.form.priceTotal)
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

    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.created = true;
        this.agendaStore.invalidate();
        this.myBookingsStore.invalidate();
      },
      error: response => {
        this.error = response.error?.message ?? (this.mode === 'BLOCK' ? 'No se pudo bloquear el horario.' : 'No se pudo guardar el turno.');
        this.loadAvailability();
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
    this.error = '';
    this.loadAvailability();
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
        this.form.courtId = Number(booking.courtId ?? this.form.courtId);
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
        this.loadAvailability();
      },
      error: response => this.error = response.error?.message ?? 'No se pudo cargar el turno.'
    });
  }

  private refreshReferenceData() {
    forkJoin({
      prices: this.api.get<unknown>('/prices', undefined, { noCache: true }),
      clients: this.api.get<unknown>('/admin/users', undefined, { noCache: true }),
      courts: this.api.get<unknown>('/courts', undefined, { noCache: true })
    }).subscribe({
      next: ({ prices, clients, courts }) => {
        this.prices = this.normalizeList(prices, 'prices');
        this.clients = this.normalizeList(clients, 'users').filter(client => client.role === 'CLIENT' && client.active);
        const activeCourtId = Number(this.normalizeList(courts, 'courts')[0]?.id ?? 0);
        if (!this.form.courtId || !this.normalizeList(courts, 'courts').some(court => Number(court.id) === Number(this.form.courtId))) {
          this.form.courtId = activeCourtId;
        }
        this.syncPrice();
        this.loadAvailability();
      }
    });
  }

  private loadAvailability() {
    const requestId = ++this.availabilityRequestId;
    this.availabilityAbort?.abort();
    if (!this.form.date || !this.form.durationMinutes) {
      this.availabilityAbort = null;
      this.slots = [];
      this.form.startTime = '';
      this.availabilityStatus.set('idle');
      return;
    }

    const abortController = new AbortController();
    this.availabilityAbort = abortController;
    this.availabilityError = '';
    this.availabilityStatus.set('loading');
    const params: Record<string, string | number> = {
      date: this.form.date,
      duration: this.form.durationMinutes,
      courtId: this.form.courtId
    };
    if (this.bookingId) params['ignoreBookingId'] = this.bookingId;

    this.api.get<any>('/admin/availability', params, {
      noCache: true,
      abortSignal: abortController.signal
    }).pipe(
      finalize(() => {
        if (requestId === this.availabilityRequestId) this.availabilityAbort = null;
      })
    ).subscribe({
      next: response => {
        if (requestId !== this.availabilityRequestId) return;
        const value = Array.isArray(response) ? response : response?.slots ?? response?.data?.slots ?? [];
        this.slots = Array.isArray(value) ? value : [];
        this.availabilityStatus.set('success');
        this.selectValidStartTime();
      },
      error: response => {
        if (requestId !== this.availabilityRequestId || abortController.signal.aborted) return;
        this.slots = [];
        this.form.startTime = '';
        this.availabilityError = response.error?.message ?? 'No se pudieron cargar los horarios disponibles.';
        this.availabilityStatus.set('error');
      }
    });
  }

  private selectValidStartTime() {
    const slots = this.selectableSlots;
    if (!slots.some(slot => slot.startTime === this.form.startTime)) {
      this.form.startTime = slots[0]?.startTime ?? '';
    }
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
