import { RealtimeService } from '../../core/realtime';
import { NEVER } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../core/api';
import { MyBookingsStore } from '../client/my-bookings-store';
import { AdminAgendaStore } from './admin-agenda-store';
import { AdminBookingFormPage } from './admin-booking-form-page';

describe('AdminBookingFormPage', () => {
  let fixture: ComponentFixture<AdminBookingFormPage>;

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  async function setup(query: Record<string, string> = {}) {
    const availability = {
      slots: [
        { startTime: '16:00', endTime: '17:30', available: true, reason: null },
        { startTime: '16:30', endTime: '18:00', available: false, reason: 'OCCUPIED' },
        { startTime: '17:00', endTime: '18:30', available: false, reason: 'DEAD_GAP' }
      ]
    };
    const api = {
      get: vi.fn((path: string, _params?: Record<string, string | number>, _options?: unknown) => {
        if (path === '/prices') return of([{ id: 1, durationMinutes: 90, price: 20000, active: true }]);
        if (path === '/courts') return of([{ id: 1, name: 'Lo del Profe', active: true }]);
        if (path === '/admin/users') return of([]);
        if (path.startsWith('/admin/bookings/')) return of({
          id: 55,
          userId: null,
          clientName: 'Ana Pérez',
          clientPhone: '3576111111',
          startTime: '2030-01-02T19:00:00.000Z',
          durationMinutes: 90,
          playersCount: 4,
          priceTotal: 20000,
          origin: 'MANUAL',
          notes: ''
        });
        if (path === '/admin/availability') return of(availability);
        throw new Error(`GET inesperado: ${path}`);
      }),
      post: vi.fn(() => of({ id: 1 })),
      patch: vi.fn(() => of({ id: 55 }))
    };
    const route = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => query[key] ?? null
        }
      }
    };

    await TestBed.configureTestingModule({
      imports: [AdminBookingFormPage],
      providers: [
        { provide: RealtimeService, useValue: { listen: () => NEVER, poll$: () => NEVER } },
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Api, useValue: api },
        { provide: ActivatedRoute, useValue: route },
        { provide: AdminAgendaStore, useValue: { invalidate: vi.fn() } },
        { provide: MyBookingsStore, useValue: { invalidate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminBookingFormPage);
    fixture.detectChanges();
    await fixture.whenStable();
    return { component: fixture.componentInstance, api };
  }

  it('ofrece sólo horarios disponibles y rechaza una hora escrita fuera de la grilla', async () => {
    const { component, api } = await setup({ date: '2030-01-02', startTime: '16:00', durationMinutes: '90' });
    const timeSelect = fixture.nativeElement.querySelector('select[name="startTime"]') as HTMLSelectElement;

    expect(Array.from(timeSelect.options).map(option => option.value)).toEqual(['16:00']);
    component.setMode('BLOCK');
    expect(component.selectableSlots.map(slot => slot.startTime)).toEqual(['16:00', '17:00']);
    component.setMode('BOOKING');
    component.setClientMode('MANUAL');
    component.form.firstName = 'Ana';
    component.form.lastName = 'Pérez';
    component.form.clientPhone = '3576111111';
    component.form.startTime = '16:02';
    component.save();

    expect(api.post).not.toHaveBeenCalled();
    expect(component.error).toContain('horarios disponibles');
  });

  it('incluye el turno editado al consultar disponibilidad ignorando su propio id', async () => {
    const { api } = await setup({ id: '55' });
    const availabilityCall = api.get.mock.calls.find(call => call[0] === '/admin/availability');

    expect(availabilityCall?.[1]).toMatchObject({ ignoreBookingId: 55, duration: 90, courtId: 1 });
  });
});
