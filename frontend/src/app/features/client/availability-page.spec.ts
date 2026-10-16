import { NEVER, of, Subject } from 'rxjs';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { RealtimeService } from '../../core/realtime';
import { Api, Auth } from '../../core/api';
import { AdminAgendaStore } from '../admin/admin-agenda-store';
import { MyBookingsStore } from './my-bookings-store';
import { AvailabilityPage } from './availability-page';

describe('AvailabilityPage con email', () => {
  async function setup(verified: boolean) {
    const postResponse = new Subject<any>();
    const api = { get: vi.fn((path: string) => path === '/prices' ? of([{ id: 1, durationMinutes: 90, price: 18000, active: true }]) : path === '/courts' ? of([{ id: 1, active: true }]) : of({ date: '2030-01-02', durationMinutes: 90, price: 18000, slots: [] })), post: vi.fn(() => postResponse.asObservable()) };
    const auth = { refreshSession: vi.fn(() => Promise.resolve()), user: signal({ id: 7, email: 'ana@example.com', emailVerified: verified, role: 'CLIENT' }) };
    const router = { navigate: vi.fn() };
    const store = { upsertBooking: vi.fn(), loadBookings: vi.fn(), updateBookingStatus: vi.fn() };
    const agenda = { invalidate: vi.fn() };
    await TestBed.configureTestingModule({ imports: [AvailabilityPage], providers: [provideZonelessChangeDetection(), { provide: Api, useValue: api }, { provide: Auth, useValue: auth }, { provide: Router, useValue: router }, { provide: ActivatedRoute, useValue: {} }, { provide: RealtimeService, useValue: { listen: () => NEVER, poll$: () => NEVER } }, { provide: MyBookingsStore, useValue: store }, { provide: AdminAgendaStore, useValue: agenda }] }).compileComponents();
    const fixture = TestBed.createComponent(AvailabilityPage); fixture.detectChanges(); await fixture.whenStable();
    fixture.componentInstance.result = { date: '2030-01-02', durationMinutes: 90, price: 18000, slots: [] };
    fixture.componentInstance.selectedSlot = { startTime: '18:00', endTime: '19:30', available: true };
    fixture.detectChanges();
    return { fixture, api, router, postResponse, store };
  }

  it('no crea ni retiene una reserva mientras falta confirmar el email', async () => {
    const { fixture, api, router } = await setup(false);
    expect(fixture.nativeElement.textContent).toContain('Confirmar mi email');
    fixture.componentInstance.goToEmailVerification();
    expect(api.post).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenLastCalledWith(['/revisar-email'], { queryParams: { email: 'ana@example.com' } });
  });

  it('confirma directamente la reserva de una cuenta verificada', async () => {
    const { fixture, postResponse, store } = await setup(true);
    fixture.componentInstance.confirmBooking();
    postResponse.next({ id: 21, status: 'CONFIRMED' }); postResponse.complete();
    await fixture.whenStable();
    expect(fixture.componentInstance.modalState).toBe('reservationConfirmed');
    expect(store.upsertBooking).toHaveBeenCalledWith({ id: 21, status: 'CONFIRMED' });
  });
});
