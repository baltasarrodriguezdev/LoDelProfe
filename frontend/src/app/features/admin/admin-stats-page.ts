import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { RealtimeEvent, RealtimeService } from '../../core/realtime';
import { AsyncStatus } from '../../shared/async-state';
import { debounceTime, finalize, merge } from 'rxjs';

interface DashboardData {
  summary: { totalBookings: number; activeBookings: number; occupancyRate: number; cancelledCount: number; cancellationRate: number; noShowCount: number; blockedHours: number; newClients: number };
  finance: { income: number; expense: number; balance: number; pendingPaymentCount: number; pendingAmount: number; partialPaymentCount: number };
  byDay: Array<{ date: string; bookings: number; income: number }>;
  byStatus: Array<{ status: string; count: number }>;
  popularHours: Array<{ hour: string; count: number }>;
  durations: Array<{ durationMinutes: number; count: number }>;
}

const WIDTH_PERCENT_CLASSES = [
  'w-0', 'w-[5%]', 'w-[10%]', 'w-[15%]', 'w-[20%]', 'w-[25%]', 'w-[30%]',
  'w-[35%]', 'w-[40%]', 'w-[45%]', 'w-1/2', 'w-[55%]', 'w-[60%]', 'w-[65%]',
  'w-[70%]', 'w-3/4', 'w-[80%]', 'w-[85%]', 'w-[90%]', 'w-[95%]', 'w-full'
] as const;

const HEIGHT_PERCENT_CLASSES = [
  'h-0', 'h-[5%]', 'h-[10%]', 'h-[15%]', 'h-[20%]', 'h-[25%]', 'h-[30%]',
  'h-[35%]', 'h-[40%]', 'h-[45%]', 'h-1/2', 'h-[55%]', 'h-[60%]', 'h-[65%]',
  'h-[70%]', 'h-3/4', 'h-[80%]', 'h-[85%]', 'h-[90%]', 'h-[95%]', 'h-full'
] as const;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="dashboard-page">
      <header class="dashboard-heading">
        <div><span class="eyebrow">PANEL DEL CLUB</span><h1>Todo bajo control.</h1><p>Turnos, disponibilidad y números del negocio en un solo lugar.</p></div>
        <div class="dashboard-actions"><a class="btn primary" routerLink="/admin/turno">+ Nuevo turno</a><a class="btn ghost" routerLink="/admin/turno" [queryParams]="{ mode: 'block' }">Bloquear horario</a><a class="btn ghost" routerLink="/admin/caja">Registrar movimiento</a></div>
      </header>

      <nav class="admin-shortcuts">
        <a routerLink="/admin/agenda-diaria">Agenda</a><a routerLink="/admin/turnos-fijos">Turnos fijos</a><a routerLink="/admin/clientes">Clientes</a><a routerLink="/admin/precios">Precios</a><a routerLink="/admin/horarios">Horarios</a><a routerLink="/admin/politicas">Políticas</a><a routerLink="/admin/caja">Caja</a>
      </nav>

      <section class="period-panel">
        <div class="period-pills"><button [class.active]="period === 'today'" (click)="setPeriod('today')">Hoy</button><button [class.active]="period === '7'" (click)="setPeriod('7')">7 días</button><button [class.active]="period === '30'" (click)="setPeriod('30')">30 días</button><button [class.active]="period === 'custom'" (click)="period = 'custom'">Personalizado</button></div>
        @if (period === 'custom') { <div class="custom-dates"><label>Desde<input type="date" [(ngModel)]="from"></label><label>Hasta<input type="date" [(ngModel)]="to"></label><button class="btn primary" (click)="loadDashboard()">Aplicar</button></div> }
        <span class="period-caption">{{ from | date:'d MMM':'UTC' }} — {{ to | date:'d MMM yyyy':'UTC' }}</span>
      </section>

      @if (loading()) { <div class="empty dashboard-loading">Calculando estadísticas...</div> }
      @else if (dashboard && availabilityStatus() === 'success' && agendaStatus() === 'success') {
        <section class="dashboard-metrics">
          <article class="metric-card featured"><span>Ocupación</span><b>{{ dashboard.summary.occupancyRate }}%</b><small>del tiempo vendible</small><i class="metric-progress"><i [class]="widthPercentClass(dashboard.summary.occupancyRate)"></i></i></article>
          <article class="metric-card"><span>Turnos</span><b>{{ dashboard.summary.totalBookings }}</b><small>{{ dashboard.summary.activeBookings }} activos</small></article>
          <article class="metric-card"><span>Ingresos</span><b>{{ dashboard.finance.income | currency:'ARS':'symbol':'1.0-0' }}</b><small>movimientos registrados</small></article>
          <article class="metric-card" [class.negative]="dashboard.finance.pendingPaymentCount"><span>Por cobrar</span><b>{{ dashboard.finance.pendingAmount | currency:'ARS':'symbol':'1.0-0' }}</b><small>{{ dashboard.finance.pendingPaymentCount }} pagos pendientes</small></article>
          <article class="metric-card"><span>Cancelados</span><b>{{ dashboard.summary.cancelledCount }}</b><small>{{ dashboard.summary.cancellationRate }}% del total</small></article>
          <article class="metric-card"><span>Clientes nuevos</span><b>{{ dashboard.summary.newClients }}</b><small>{{ dashboard.summary.noShowCount }} no asistieron</small></article>
        </section>

        @if (dashboard.finance.pendingPaymentCount || dashboard.finance.partialPaymentCount) {
          <section class="attention-strip"><span class="attention-dot"></span><strong>Requiere atención</strong><p>{{ dashboard.finance.pendingPaymentCount }} pagos pendientes · {{ dashboard.finance.partialPaymentCount }} pagos parciales</p></section>
        }

        <section class="availability-admin panel">
          <div class="section-heading"><div><span class="eyebrow">OPERACIÓN DIARIA</span><h2>Disponibilidad</h2></div><div class="availability-controls"><input type="date" [(ngModel)]="availabilityDate" (change)="loadAvailability()"><select [(ngModel)]="availabilityDuration" (change)="loadAvailability()"><option [ngValue]="60">60 min</option><option [ngValue]="90">90 min</option><option [ngValue]="120">120 min</option></select></div></div>
          <p class="section-help">Tocá un horario libre para crear un turno manual con los datos precargados.</p>
          <div class="admin-slots">
            @for (slot of availability?.slots; track slot.startTime) {
              <button [disabled]="!slot.available" [class.occupied]="!slot.available" (click)="openManualBooking(slot)"><b>{{ slot.startTime }}</b><span>{{ slot.available ? 'Disponible' : 'Ocupado' }}</span></button>
            } @empty { <div class="empty">No hay bloques para esta fecha.</div> }
          </div>
        </section>

        <section class="dashboard-grid">
          <article class="panel chart-card daily-chart"><div class="section-heading"><div><span class="eyebrow">TENDENCIA</span><h2>Turnos por día</h2></div><strong>{{ dashboard.summary.activeBookings }} turnos</strong></div>
            <div class="vertical-chart">@for (day of dashboard.byDay; track day.date) { <div class="chart-column"><span class="chart-value">{{ day.bookings }}</span><i [class]="heightPercentClass(dayHeight(day.bookings))"></i><small>{{ day.date | date:'dd/MM':'UTC' }}</small></div> }</div>
          </article>
          <article class="panel chart-card"><span class="eyebrow">ESTADOS</span><h2>Estado de reservas</h2><div class="horizontal-chart">@for (item of dashboard.byStatus; track item.status) { <div><header><span>{{ statusLabel(item.status) }}</span><b>{{ item.count }}</b></header><i><i [class]="widthPercentClass(statusWidth(item.count))"></i></i></div> }</div></article>
          <article class="panel chart-card"><span class="eyebrow">DEMANDA</span><h2>Horarios preferidos</h2><div class="ranking-list">@for (item of dashboard.popularHours; track item.hour; let index = $index) { <div><span>{{ index + 1 }}</span><b>{{ item.hour }}</b><i><i [class]="widthPercentClass(rankingWidth(item.count, dashboard.popularHours))"></i></i><strong>{{ item.count }}</strong></div> } @empty { <p>Sin datos en este período.</p> }</div></article>
          <article class="panel chart-card"><span class="eyebrow">FORMATO</span><h2>Duraciones elegidas</h2><div class="duration-chart">@for (item of dashboard.durations; track item.durationMinutes) { <div><b>{{ item.durationMinutes }}'</b><i><i [class]="widthPercentClass(rankingWidth(item.count, dashboard.durations))"></i></i><span>{{ item.count }} turnos</span></div> } @empty { <p>Sin datos en este período.</p> }</div><div class="finance-mini"><span>Gastos <b>{{ dashboard.finance.expense | currency:'ARS':'symbol':'1.0-0' }}</b></span><span>Balance <b>{{ dashboard.finance.balance | currency:'ARS':'symbol':'1.0-0' }}</b></span></div></article>
        </section>

        <section class="today-agenda">
          <div class="section-heading"><div><span class="eyebrow">HOY EN LA CANCHA</span><h2>Próximos turnos</h2></div><a routerLink="/admin/agenda-diaria">Ver agenda completa →</a></div>
          <div class="dashboard-agenda">@for (booking of todayBookings; track booking.id) { <article><time>{{ booking.startTime | date:'HH:mm' }}</time><div><span class="tag">{{ statusLabel(booking.status) }}</span><h3>{{ booking.clientName }}</h3><p>{{ booking.clientPhone }} · {{ booking.durationMinutes }} min · {{ originLabel(booking.origin) }}</p></div><strong>{{ booking.priceTotal | currency:'ARS':'symbol':'1.0-0' }}</strong></article> } @empty { <div class="empty">No hay turnos cargados para hoy.</div> }</div>
        </section>
      }
      @if (error) { <p class="notice error-notice">{{ error }}</p> }
    </section>
  `
})
export class AdminStatsPage implements OnInit, OnDestroy {
  private api = inject(Api); private router = inject(Router);
  private realtime = inject(RealtimeService); private destroyRef = inject(DestroyRef);
  dashboard: DashboardData | null = null; availability: any; todayBookings: any[] = [];
  readonly dashboardStatus = signal<AsyncStatus>('idle');
  readonly availabilityStatus = signal<AsyncStatus>('idle');
  readonly agendaStatus = signal<AsyncStatus>('idle');
  dashboardError = '';
  availabilityError = '';
  agendaError = '';
  period = 'today';
  private dashboardRequestId = 0;
  private availabilityRequestId = 0;
  private agendaRequestId = 0;
  private requestedAgendaDate = '';
  private dashboardAbort: AbortController | null = null;
  private availabilityAbort: AbortController | null = null;
  private agendaAbort: AbortController | null = null;
  from = this.dateInput(new Date()); to = this.dateInput(new Date());
  availabilityDate = this.dateInput(new Date()); availabilityDuration = 90; courtId = 0;

  ngOnInit() {
    this.loadDashboard();
    this.loadCourt();
    merge(this.realtime.listen([
        'AVAILABILITY_CHANGED', 'BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED', 'BOOKING_STATUS_CHANGED', 'BOOKING_PAYMENT_CHANGED',
        'SCHEDULE_BLOCKED', 'SCHEDULE_UNBLOCKED', 'CONFIGURATION_CHANGED',
        'RECURRING_BOOKING_CHANGED', 'CASH_MOVEMENT_CREATED'
      ]).pipe(debounceTime(150)), this.realtime.poll$()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(change => {
      this.loadDashboard();
      if (typeof change === 'object' && (change as RealtimeEvent).type === 'CONFIGURATION_CHANGED'
        && (change as RealtimeEvent).resource.resource === 'COURTS') this.loadCourt();
      else if (this.courtId) this.loadAvailability();
    });
  }
  private loadCourt() {
    this.api.get<any[]>('/courts', undefined, { noCache: true }).subscribe({
      next: courts => {
        this.courtId = Number(courts?.[0]?.id ?? 0);
        if (this.courtId) this.loadAvailability();
        else this.availabilityError = 'No hay una cancha activa configurada.';
      },
      error: error => this.availabilityError = error.error?.message ?? 'No se pudo cargar la cancha activa.'
    });
  }
  ngOnDestroy() { this.dashboardAbort?.abort(); this.availabilityAbort?.abort(); this.agendaAbort?.abort(); }
  get error() { return this.dashboardError || this.availabilityError || this.agendaError; }
  setPeriod(period: string) { this.period = period; const today = new Date(); const start = new Date(today); if (period === '7') start.setDate(start.getDate() - 6); if (period === '30') start.setDate(start.getDate() - 29); this.from = this.dateInput(start); this.to = this.dateInput(today); this.loadDashboard(); }
  private dashboardRequestKey = '';
  loadDashboard() {
    const key = JSON.stringify([this.from, this.to]);
    if (this.dashboardAbort && key === this.dashboardRequestKey) return;
    this.dashboardRequestKey = key;
    const requestId = ++this.dashboardRequestId;
    this.dashboardAbort?.abort();
    const abortController = new AbortController();
    this.dashboardAbort = abortController;
    this.dashboardStatus.set('loading');
    this.dashboardError = '';
    this.api.get<DashboardData>('/admin/dashboard', { from: this.from, to: this.to }, { noCache: true, abortSignal: abortController.signal }).pipe(
      finalize(() => { if (requestId === this.dashboardRequestId && this.dashboardStatus() === 'loading') this.dashboardStatus.set('error'); if (requestId === this.dashboardRequestId) this.dashboardAbort = null; })
    ).subscribe({
      next: data => { if (requestId === this.dashboardRequestId) { this.dashboard = data; this.dashboardStatus.set('success'); } },
      error: error => { if (requestId === this.dashboardRequestId) { this.dashboardError = error.error?.message ?? 'No se pudieron cargar las estadísticas.'; this.dashboardStatus.set('error'); } }
    });
  }
  readonly loading = computed(() => [this.dashboardStatus(), this.availabilityStatus(), this.agendaStatus()].includes('loading'));
  private availabilityRequestKey = '';
  loadAvailability() {
    const key = JSON.stringify([this.availabilityDate, this.availabilityDuration, this.courtId]);
    if (this.availabilityAbort && key === this.availabilityRequestKey) return;
    this.availabilityRequestKey = key;
    if (!this.courtId) return;
    if (this.requestedAgendaDate !== this.availabilityDate || ['idle', 'error'].includes(this.agendaStatus())) this.loadTodayAgenda();
    const requestId = ++this.availabilityRequestId;
    this.availabilityAbort?.abort();
    const abortController = new AbortController();
    this.availabilityAbort = abortController;
    this.availabilityStatus.set('loading');
    this.availabilityError = '';
    this.api.get<unknown>('/availability', { date: this.availabilityDate, duration: this.availabilityDuration, courtId: this.courtId }, { noCache: true, abortSignal: abortController.signal }).pipe(
      finalize(() => { if (requestId === this.availabilityRequestId && this.availabilityStatus() === 'loading') this.availabilityStatus.set('error'); if (requestId === this.availabilityRequestId) this.availabilityAbort = null; })
    ).subscribe({
      next: response => {
        if (requestId !== this.availabilityRequestId) return;
        const value = response as any;
        const slots = Array.isArray(response) ? response : value?.slots ?? value?.data?.slots ?? [];
        this.availability = { ...(Array.isArray(response) ? {} : value), slots: Array.isArray(slots) ? slots : [] };
        this.availabilityStatus.set('success');
      },
      error: error => { if (requestId === this.availabilityRequestId) { this.availabilityError = error.error?.message ?? 'No se pudo cargar la disponibilidad.'; this.availabilityStatus.set('error'); } }
    });
  }
  loadTodayAgenda() {
    if (this.agendaAbort && this.requestedAgendaDate === this.availabilityDate) return;
    const requestId = ++this.agendaRequestId;
    this.agendaAbort?.abort();
    const abortController = new AbortController();
    this.agendaAbort = abortController;
    this.requestedAgendaDate = this.availabilityDate;
    const start = new Date(`${this.availabilityDate}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    this.agendaStatus.set('loading');
    this.agendaError = '';
    this.api.get<unknown>('/admin/bookings', { from: start.toISOString(), to: end.toISOString() }, { noCache: true, abortSignal: abortController.signal }).pipe(
      finalize(() => { if (requestId === this.agendaRequestId && this.agendaStatus() === 'loading') this.agendaStatus.set('error'); if (requestId === this.agendaRequestId) this.agendaAbort = null; })
    ).subscribe({
      next: response => {
        if (requestId !== this.agendaRequestId) return;
        const value = response as any;
        const bookings = Array.isArray(response) ? response : value?.bookings ?? value?.data?.bookings ?? [];
        this.todayBookings = (Array.isArray(bookings) ? bookings : []).filter(item => item.status !== 'CANCELLED').slice(0, 8);
        this.agendaStatus.set('success');
      },
      error: error => { if (requestId === this.agendaRequestId) { this.agendaError = error.error?.message ?? 'No se pudo cargar la agenda.'; this.agendaStatus.set('error'); } }
    });
  }
  openManualBooking(slot: any) { if (!slot.available && slot.reason !== 'DEAD_GAP') return; this.router.navigate(['/admin/turno'], { queryParams: { date: this.availabilityDate, startTime: slot.startTime, durationMinutes: this.availabilityDuration } }); }
  dayHeight(value: number) { const max = Math.max(1, ...(this.dashboard?.byDay.map(item => item.bookings) ?? [1])); return Math.max(value ? 8 : 2, value / max * 100); }
  statusWidth(value: number) { return this.dashboard?.summary.totalBookings ? value / this.dashboard.summary.totalBookings * 100 : 0; }
  rankingWidth(value: number, items: Array<{ count: number }>) { return value / Math.max(1, ...items.map(item => item.count)) * 100; }
  widthPercentClass(value: number) { return WIDTH_PERCENT_CLASSES[this.percentClassIndex(value)]; }
  heightPercentClass(value: number) { return HEIGHT_PERCENT_CLASSES[this.percentClassIndex(value)]; }
  originLabel(origin?: string) { return ({ WEB: 'Web', WHATSAPP: 'WhatsApp', MANUAL: 'Manual' } as Record<string, string>)[origin ?? 'WEB'] ?? 'Web'; }
  statusLabel(status: string) { return ({ CONFIRMED: 'Confirmado', PLAYED: 'Jugado', CANCELLED: 'Cancelado', NO_SHOW: 'No asistió', BLOCKED: 'Bloqueado' } as Record<string, string>)[status] ?? status; }
  private percentClassIndex(value: number) { return Math.min(20, Math.max(0, Math.round(Number(value || 0) / 5))); }
  private dateInput(date: Date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
}
