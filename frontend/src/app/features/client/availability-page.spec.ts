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
  afterEach(() => vi.restoreAllMocks());

  async function setup(postResponse: Subject<any>, selectTestSlot = true) {
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
      post: vi.fn(() => postResponse.asObservable())
    };
    const auth = {
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
    const myBookingsStore = { upsertBooking: vi.fn() };
    const adminAgendaStore = { invalidate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AvailabilityPage],
      providers: [
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
    return { fixture, myBookingsStore, adminAgendaStore };
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

    postResponse.next({ reservation: { id: 21 }, alreadyPending: false });
    postResponse.complete();
    await fixture.whenStable();

    expect(fixture.componentInstance.submitting()).toBe(false);
    expect(fixture.componentInstance.modalState).toBe('verificationPending');
    expect(fixture.nativeElement.textContent).toContain('Tu solicitud quedó pendiente');
    expect(popup.location.href).toContain('https://wa.me/');
    expect(myBookingsStore.upsertBooking).toHaveBeenCalledOnce();
    expect(adminAgendaStore.invalidate).toHaveBeenCalledOnce();
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
});
