import { RealtimeService } from '../../core/realtime';
import { NEVER } from 'rxjs';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api, Auth } from '../../core/api';
import { AdminAgendaStore } from '../admin/admin-agenda-store';
import { MyBookingsStore } from './my-bookings-store';
import { AvailabilityPage } from './availability-page';

describe('AvailabilityPage zoneless', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  async function setup(postResponse: Subject<any>, selectTestSlot = true) {
    const polling = new Subject<string>();
    const api = {
      get: vi.fn((path: string) => path === '/prices'
        ? of([{ id: 1, durationMinutes: 90, price: 18000, active: true }])
        : path === '/courts'
          ? of([{ id: 1, name: 'Lo del Profe', active: true }])
          : of({
          date: '2026-07-19',
          durationMinutes: 90,
          price: 18000,
          slots: []
        })),
      post: vi.fn(() => postResponse.asObservable()),
      patch: vi.fn(() => of({ status: 'CANCELLED' }))
    };
    const auth = {
      refreshSession: vi.fn(() => Promise.resolve()),
      user: signal({
        id: 7,
        firstName: 'Ana',
        lastName: 'Pérez',
        phone: '3515551234',
        phoneVerified: false,
        status: 'PENDING_VERIFICATION',
        role: 'CLIENT'
      })
    };
    const myBookingsStore = { upsertBooking: vi.fn(), updateBookingStatus: vi.fn(), loadBookings: vi.fn(() => Promise.resolve()) };
    const adminAgendaStore = { invalidate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AvailabilityPage],
      providers: [
        { provide: RealtimeService, useValue: { listen: () => NEVER, poll$: () => polling } },
        provideZonelessChangeDetection(),
        { provide: Api, useValue: api },
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MyBookingsStore, useValue: myBookingsStore },
        { provide: AdminAgendaStore, useValue: adminAgendaStore }
      ]
    }).compileComponents();

    const fixture: ComponentFixture<AvailabilityPage> = TestBed.createComponent(AvailabilityPage);
    fixture.detectChanges();
    await fixture.whenStable();

    if (selectTestSlot) {
      fixture.componentInstance.date = '2026-07-19';
      fixture.componentInstance.duration = 90;
      fixture.componentInstance.result = {
        date: '2026-07-19',
        durationMinutes: 90,
        price: 18000,
        slots: []
      };
      fixture.componentInstance.selectedSlot = {
        startTime: '18:00',
        endTime: '19:30',
        available: true
      };
      fixture.detectChanges();
    }
    return { fixture, api, polling, auth, myBookingsStore, adminAgendaStore };
  }

  it('muestra el día de hoy por defecto al entrar a reservar', async () => {
    const postResponse = new Subject<any>();
    const { fixture } = await setup(postResponse, false);

    expect(fixture.componentInstance.date).toBe(fixture.componentInstance.today);
  });

  it('sale de Enviando y muestra la solicitud pendiente al abrir WhatsApp', async () => {
    const postResponse = new Subject<any>();
    const popup = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const { fixture, myBookingsStore, adminAgendaStore } = await setup(postResponse);

    fixture.componentInstance.sendVerificationRequest();
    await fixture.whenStable();
    expect(fixture.componentInstance.submitting()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Enviando...');

    const holdExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    postResponse.next({ reservation: { id: 21, holdExpiresAt }, alreadyPending: false });
    postResponse.complete();
    await fixture.whenStable();

    expect(fixture.componentInstance.submitting()).toBe(false);
    expect(fixture.componentInstance.modalState).toBe('verificationPending');
    expect(fixture.nativeElement.textContent).toContain('Guardamos tu horario');
    expect(fixture.nativeElement.textContent).toContain('Tiempo restante');
    expect(fixture.componentInstance.holdRemainingSeconds()).toBeGreaterThan(590);
    expect(popup.location.href).toContain('https://wa.me/');
    expect(myBookingsStore.upsertBooking).toHaveBeenCalledOnce();
    expect(adminAgendaStore.invalidate).toHaveBeenCalledOnce();
  });

  it('permite cancelar la retención y libera el horario', async () => {
    const postResponse = new Subject<any>();
    const popup = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const { fixture, api, myBookingsStore, adminAgendaStore } = await setup(postResponse);

    fixture.componentInstance.sendVerificationRequest();
    postResponse.next({ reservation: { id: 21, holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString() } });
    postResponse.complete();
    await fixture.whenStable();

    fixture.componentInstance.cancelPendingHold();
    await fixture.whenStable();

    expect(api.patch).toHaveBeenCalledWith('/bookings/21/cancel', {});
    expect(myBookingsStore.updateBookingStatus).toHaveBeenCalledWith(21, 'CANCELLED');
    expect(adminAgendaStore.invalidate).toHaveBeenCalled();
    expect(fixture.componentInstance.modalState).toBe('holdReleased');
    expect(fixture.nativeElement.textContent).toContain('Solicitud cancelada');
  });

  it('rehabilita el botón y muestra el error cuando falla la reserva', async () => {
    const postResponse = new Subject<any>();
    const popup = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const { fixture } = await setup(postResponse);

    fixture.componentInstance.sendVerificationRequest();
    postResponse.error({ error: { message: 'Ese horario ya no está disponible.' } });
    await fixture.whenStable();

    expect(fixture.componentInstance.submitting()).toBe(false);
    expect(fixture.componentInstance.modalError).toContain('Ese horario ya no está disponible');
    expect(fixture.nativeElement.textContent).toContain('Enviar solicitud por WhatsApp');
    expect(popup.close).toHaveBeenCalledOnce();
  });
  it('polls availability without downloading prices/courts again, and stops when destroyed', async () => {
    const { fixture, api, polling, auth } = await setup(new Subject(), false);
    auth.user.update(user => ({ ...user, phoneVerified: true }));
    (fixture.componentInstance as any).lastAvailabilityCompleted = Date.now() - 60_000;
    api.get.mockClear(); polling.next('poll'); await fixture.whenStable();
    expect(api.get.mock.calls.map(call => call[0])).toEqual(['/availability']);
    expect(auth.refreshSession).not.toHaveBeenCalled();
    fixture.destroy(); api.get.mockClear(); polling.next('poll');
    expect(api.get).not.toHaveBeenCalled();
  });
  it('coalesces nextChangeAt and a polling tick for the same availability resource', async () => {
    const { fixture, api, polling, auth } = await setup(new Subject(), false);
    auth.user.update(user => ({ ...user, phoneVerified: true }));
    vi.useFakeTimers(); api.get.mockClear();
    (fixture.componentInstance as any).scheduleAvailabilityRefresh(new Date(Date.now() + 59_750).toISOString());
    setTimeout(() => polling.next('poll'), 60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.get.mock.calls.map(call => call[0])).toEqual(['/availability']);
    fixture.destroy();
  });
  it('does not request data for a nextChangeAt expiry in background', async () => {
    const { fixture, api } = await setup(new Subject(), false);
    vi.useFakeTimers(); api.get.mockClear();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    (fixture.componentInstance as any).scheduleAvailabilityRefresh(new Date(Date.now() + 1000).toISOString());
    await vi.advanceTimersByTimeAsync(1250); expect(api.get).not.toHaveBeenCalled(); fixture.destroy();
  });

});
