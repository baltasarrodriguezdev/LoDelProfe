import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, finalize, forkJoin, merge } from 'rxjs';
import { Api } from '../../core/api';
import { RealtimeService } from '../../core/realtime';
import { AsyncStatus } from '../../shared/async-state';
import { AdminAgendaStore } from './admin-agenda-store';

type SettingsView = 'prices' | 'hours' | 'recurring' | 'cash' | 'policy';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class='admin-shell'>
      <div class='admin-content'>
        <div class='admin-title'><div><span class='eyebrow'>GESTIÓN</span><h1>{{ title }}</h1></div><span class='today'>{{ today | date:'EEEE d MMMM' }}</span></div>
        @if (notice()) { <p class='notice' [class.error-notice]='noticeError()'>{{ notice() }}</p> }
        @if (resourceStatus() === 'loading') {
          <div class='empty'>Cargando información...</div>
        } @else if (resourceStatus() === 'error') {
          <div class='empty'><strong>No pudimos cargar la información.</strong><span>{{ resourceError() }}</span></div>
        } @else if (resourceStatus() === 'success') {
          @if (view === 'prices') {
            <div class='settings-list'>
              @for (price of items(); track price.id) {
                <article class='panel row'>
                  <div><h2>{{ price.durationMinutes }} minutos</h2><span>{{ price.active ? 'Activo' : 'Inactivo' }}</span></div>
                  <label>Precio<input type='number' [(ngModel)]='price.price'></label>
                  <button type='button' class='btn primary' [disabled]='savingItemId() !== null' (click)='savePrice(price)'>{{ savingItemId() === price.id ? 'Guardando...' : 'Guardar' }}</button>
                </article>
              } @empty { <div class='empty'>No hay precios configurados.</div> }
            </div>
          }
          @if (view === 'hours') {
            <div class='settings-list'>
              @for (hours of items(); track hours.id) {
                <article class='panel row'>
                  <b>{{ days[hours.dayOfWeek] }}</b>
                  <label>Abre<input type='time' [(ngModel)]='hours.openTime'></label>
                   <label>Cierra<input type='time' [(ngModel)]='hours.closeTime'></label>
                   <label>Descanso desde<input type='time' [(ngModel)]='hours.breakStartTime'></label>
                   <label>Descanso hasta<input type='time' [(ngModel)]='hours.breakEndTime'></label>
                  <label class='check'><input type='checkbox' [(ngModel)]='hours.active'> Abierto</label>
                </article>
              } @empty { <div class='empty'>No hay horarios configurados.</div> }
              <button type='button' class='btn primary' [disabled]='savingHours()' (click)='saveHours()'>{{ savingHours() ? 'Guardando...' : 'Guardar horarios' }}</button>
            </div>
          }
          @if (view === 'recurring') {
            <form class='panel form-grid' (ngSubmit)='createRecurring()'>
              <label>Cliente<input [(ngModel)]='form.clientName' name='rname' required></label>
              <label>Teléfono<input [(ngModel)]='form.clientPhone' name='rphone' required></label>
              <label>Día<select [(ngModel)]='form.dayOfWeek' name='day'>@for (day of days; track $index) { <option [ngValue]='$index'>{{ day }}</option> }</select></label>
              <label>Hora<input type='time' [(ngModel)]='form.startTime' name='rtime'></label>
              <label>Desde<input type='date' [(ngModel)]='form.startDate' name='from'></label>
              <label>Hasta<input type='date' [(ngModel)]='form.endDate' name='to'></label>
              <label>Duración<select [(ngModel)]='form.durationMinutes' name='rdur'>@for (price of recurringPrices; track price.id) { <option [ngValue]='price.durationMinutes'>{{ price.durationMinutes }} minutos</option> }</select></label>
              <button class='btn primary' [disabled]='creatingRecurring()'>{{ creatingRecurring() ? 'Creando...' : 'Crear serie' }}</button>
            </form>
            <div class='table recurring-table'>
              @for (item of items(); track item.id) {
                <div [class.inactive]='!item.active'>
                  <b>{{ item.clientName }}</b><span>{{ days[item.dayOfWeek] }} {{ item.startTime }}</span>
                  <span><small class='recurring-status' [class.inactive]='!item.active'>{{ item.active ? 'Activo' : 'Desactivado' }}</small> · {{ item._count?.bookings ?? 0 }} fechas</span>
                  <button type='button' class='link danger-text' [disabled]='!item.active || deactivatingId() !== null' (click)='deactivate(item)'>{{ deactivatingId() === item.id ? 'Desactivando...' : item.active ? 'Desactivar' : 'Desactivado' }}</button>
                </div>
              } @empty { <div class='empty'>No hay turnos fijos configurados.</div> }
            </div>
          }
          @if (view === 'cash') {
            <div class='metric-grid'>
              <article><span>Ingresos</span><b>{{ report()?.income ?? 0 | currency:'ARS':'symbol':'1.0-0' }}</b></article>
              <article><span>Gastos</span><b>{{ report()?.expense ?? 0 | currency:'ARS':'symbol':'1.0-0' }}</b></article>
              <article><span>Balance</span><b>{{ report()?.balance ?? 0 | currency:'ARS':'symbol':'1.0-0' }}</b></article>
            </div>
            <form class='panel cash-form' (ngSubmit)='addCash()'>
              <select [(ngModel)]='cash.type' name='type'><option>INCOME</option><option>EXPENSE</option></select>
              <select [(ngModel)]='cash.category' name='category'><option>TURNO</option><option>BEBIDAS</option><option>COMIDA</option><option>MANTENIMIENTO</option><option>OTRO</option></select>
              <input type='number' placeholder='Monto' [(ngModel)]='cash.amount' name='amount'>
              <input placeholder='Descripción' [(ngModel)]='cash.description' name='description'>
              <button class='btn primary' [disabled]='addingCash()'>{{ addingCash() ? 'Registrando...' : 'Registrar' }}</button>
            </form>
            <div class='table'>
              @for (item of items(); track item.id) {
                <div><span class='tag'>{{ item.type }}</span><b>{{ item.description }}</b><span>{{ item.category }}</span><strong>{{ item.amount | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
              } @empty { <div class='empty'>No hay movimientos registrados.</div> }
            </div>
          }
          @if (view === 'policy') {
            <form class='panel form-grid' (ngSubmit)='savePolicy()'>
              <label>Límite para cancelar
                <input type='number' min='0' max='10080' [(ngModel)]='cancellationCutoffMinutes' name='cutoff'>
              </label>
              <p>Los clientes podrán cancelar hasta esta cantidad de minutos antes del turno. Administración conserva la posibilidad de resolver excepciones.</p>
              <button class='btn primary' [disabled]='savingPolicy()'>{{ savingPolicy() ? 'Guardando...' : 'Guardar política' }}</button>
            </form>
          }
        }
      </div>
    </section>
  `
})
export class AdminSettingsPage implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  private agendaStore = inject(AdminAgendaStore);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);

  readonly resourceStatus = signal<AsyncStatus>('idle');
  readonly resourceError = signal('');
  readonly items = signal<any[]>([]);
  readonly report = signal<any>(null);
  readonly notice = signal('');
  readonly noticeError = signal(false);
  readonly savingItemId = signal<number | null>(null);
  readonly savingHours = signal(false);
  readonly creatingRecurring = signal(false);
  readonly deactivatingId = signal<number | null>(null);
  readonly addingCash = signal(false);
  readonly savingPolicy = signal(false);
  private requestId = 0;

  today = new Date();
  days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  form: any = { courtId: 0, clientName: '', clientPhone: '', dayOfWeek: 3, startTime: '18:00', durationMinutes: 90, startDate: this.dateInput(new Date()), endDate: this.dateInput(new Date()) };
  cash: any = { type: 'INCOME', category: 'TURNO', amount: null, description: '' };
  recurringPrices: any[] = [];
  cancellationCutoffMinutes = 120;

  get view(): SettingsView {
    const url = this.router.url;
    if (url.includes('precios')) return 'prices';
    if (url.includes('horarios')) return 'hours';
    if (url.includes('politicas')) return 'policy';
    if (url.includes('fijos')) return 'recurring';
    return 'cash';
  }

  get title() {
    return ({ prices: 'Precios', hours: 'Horarios de apertura', recurring: 'Turnos fijos', cash: 'Caja básica', policy: 'Políticas de reserva' } as Record<SettingsView, string>)[this.view];
  }

  ngOnInit() {
    this.load();
    merge(
      this.realtime.listen(['CONFIGURATION_CHANGED', 'RECURRING_BOOKING_CHANGED', 'CASH_MOVEMENT_CREATED', 'BOOKING_PAYMENT_CHANGED']),
      this.realtime.resync$
    ).pipe(debounceTime(150), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  load() {
    const requestId = ++this.requestId;
    this.resourceStatus.set('loading');
    this.resourceError.set('');
    const request = this.view === 'prices'
      ? this.api.get<unknown>('/prices', undefined, { noCache: true })
      : this.view === 'hours'
        ? this.api.get<unknown>('/business-hours', undefined, { noCache: true })
        : this.view === 'recurring'
          ? forkJoin({
              items: this.api.get<unknown>('/admin/recurring-bookings', undefined, { noCache: true }),
              courts: this.api.get<unknown>('/courts', undefined, { noCache: true }),
              prices: this.api.get<unknown>('/prices', undefined, { noCache: true })
            })
          : this.view === 'policy'
            ? this.api.get<any>('/admin/booking-policy', undefined, { noCache: true })
          : forkJoin({
              items: this.api.get<unknown>('/admin/cash-movements', undefined, { noCache: true }),
              report: this.api.get<any>('/admin/reports/daily', undefined, { noCache: true })
            });

    request.pipe(finalize(() => {
      if (requestId === this.requestId && this.resourceStatus() === 'loading') this.resourceStatus.set('error');
    })).subscribe({
      next: response => {
        if (requestId !== this.requestId) return;
        if (this.view === 'cash') {
          const value = response as any;
          this.items.set(this.normalizeList(value?.items));
          this.report.set(value?.report ?? null);
        } else if (this.view === 'recurring') {
          const value = response as any;
          this.items.set(this.normalizeList(value?.items));
          this.form.courtId = Number(this.normalizeList(value?.courts)[0]?.id ?? 0);
          this.recurringPrices = this.normalizeList(value?.prices);
          if (this.recurringPrices.length && !this.recurringPrices.some(item => item.durationMinutes === this.form.durationMinutes)) {
            this.form.durationMinutes = this.recurringPrices[0].durationMinutes;
          }
        } else if (this.view === 'policy') {
          this.cancellationCutoffMinutes = Number((response as any)?.cancellationCutoffMinutes ?? 120);
        } else {
          this.items.set(this.normalizeList(response));
        }
        this.resourceStatus.set('success');
      },
      error: error => {
        if (requestId !== this.requestId) return;
        this.resourceError.set(error.error?.message ?? 'No pudimos cargar la información.');
        this.resourceStatus.set('error');
      }
    });
  }

  savePrice(price: any) {
    if (!price?.id || this.savingItemId() !== null) return;
    this.savingItemId.set(price.id);
    this.api.patch(`/admin/prices/${price.id}`, { price: Number(price.price), active: price.active }).pipe(
      finalize(() => this.savingItemId.set(null))
    ).subscribe({
      next: () => { this.agendaStore.invalidate(); this.showNotice('Precio guardado correctamente.'); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo guardar el precio.', true)
    });
  }

  saveHours() {
    if (this.savingHours()) return;
    const payload = this.items().map(({ dayOfWeek, openTime, closeTime, breakStartTime, breakEndTime, active }) => ({
      dayOfWeek,
      openTime,
      closeTime,
      breakStartTime: breakStartTime || null,
      breakEndTime: breakEndTime || null,
      active
    }));
    this.savingHours.set(true);
    this.api.put('/admin/business-hours', payload).pipe(
      finalize(() => this.savingHours.set(false))
    ).subscribe({
      next: () => { this.agendaStore.invalidate(); this.showNotice('Horarios guardados correctamente.'); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudieron guardar los horarios.', true)
    });
  }

  createRecurring() {
    if (this.creatingRecurring()) return;
    if (!this.form.clientName?.trim() || !this.form.clientPhone?.trim() || !this.form.startDate || !this.form.endDate) {
      this.showNotice('Completá los datos obligatorios del turno fijo.', true);
      return;
    }
    this.creatingRecurring.set(true);
    this.api.post('/admin/recurring-bookings', this.form).pipe(
      finalize(() => this.creatingRecurring.set(false))
    ).subscribe({
      next: () => { this.agendaStore.invalidate(); this.showNotice('Turno fijo creado correctamente.'); this.load(); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo crear el turno fijo.', true)
    });
  }

  deactivate(item: any) {
    if (!item?.id || !item.active || this.deactivatingId() !== null) return;
    this.deactivatingId.set(item.id);
    this.api.patch<any>(`/admin/recurring-bookings/${item.id}/deactivate`, {}).pipe(
      finalize(() => this.deactivatingId.set(null))
    ).subscribe({
      next: response => { item.active = false; this.agendaStore.invalidate(); this.showNotice(response?.message ?? 'Turno fijo desactivado correctamente.'); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo desactivar el turno fijo.', true)
    });
  }

  addCash() {
    if (this.addingCash()) return;
    const amount = Number(this.cash.amount);
    if (!Number.isFinite(amount) || amount <= 0) { this.showNotice('Ingresá un monto válido.', true); return; }
    this.addingCash.set(true);
    this.api.post('/admin/cash-movements', { ...this.cash, amount }).pipe(
      finalize(() => this.addingCash.set(false))
    ).subscribe({
      next: () => { this.cash = { type: 'INCOME', category: 'TURNO', amount: null, description: '' }; this.showNotice('Movimiento registrado.'); this.load(); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo registrar el movimiento.', true)
    });
  }

  savePolicy() {
    const cancellationCutoffMinutes = Number(this.cancellationCutoffMinutes);
    if (!Number.isInteger(cancellationCutoffMinutes) || cancellationCutoffMinutes < 0 || cancellationCutoffMinutes > 10080) {
      this.showNotice('Ingresá un límite válido entre 0 y 10080 minutos.', true);
      return;
    }
    this.savingPolicy.set(true);
    this.api.put('/admin/booking-policy', { cancellationCutoffMinutes }).pipe(
      finalize(() => this.savingPolicy.set(false))
    ).subscribe({
      next: () => this.showNotice('Política de cancelación guardada.'),
      error: error => this.showNotice(error.error?.message ?? 'No se pudo guardar la política.', true)
    });
  }

  private normalizeList(response: unknown) {
    const value = response as any;
    const normalized = Array.isArray(response)
      ? response
      : value?.items ?? value?.data?.items ?? value?.prices ?? value?.hours ?? value?.bookings ?? [];
    return Array.isArray(normalized) ? normalized : [];
  }

  private showNotice(message: string, error = false) {
    this.notice.set(message);
    this.noticeError.set(error);
  }

  private dateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
