import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api, Auth } from './api';
import { RealtimeService } from './realtime';
import { AdminAgendaStore } from '../features/admin/admin-agenda-store';
import { MyBookingsStore } from '../features/client/my-bookings-store';

describe('root stores with mounted consumers', () => {
  const events = new Subject<any>();
  const api = { get: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers(); api.get.mockReset().mockReturnValue(of([]));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(),
      { provide: Api, useValue: api },
      { provide: Auth, useValue: { user: signal({ id: 1 }), sessionRevision: signal(0), isAdmin: () => true } },
      { provide: RealtimeService, useValue: { listen: () => events } }
    ] });
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it('does not refresh cached agenda/availability after the screen leaves', async () => {
    const store = TestBed.inject(AdminAgendaStore); const release = store.activate(true);
    await store.ensureAgendaLoaded({ date: '2030-01-01', days: 1 });
    await store.ensureAvailabilityLoaded({ date: '2030-01-01', duration: 60, courtId: 1 });
    api.get.mockClear(); events.next({}); await vi.advanceTimersByTimeAsync(120);
    expect(api.get).toHaveBeenCalledTimes(2);
    release(); api.get.mockClear(); events.next({}); await vi.advanceTimersByTimeAsync(600_000);
    expect(api.get).not.toHaveBeenCalled();
  });
  it('reuses a forced agenda request instead of aborting and restarting it', async () => {
    const response = new Subject<any>(); api.get.mockReturnValue(response);
    const store = TestBed.inject(AdminAgendaStore);
    const first = store.ensureAgendaLoaded({ date: '2030-01-01', days: 1 }, true);
    const second = store.ensureAgendaLoaded({ date: '2030-01-01', days: 1 }, true);
    expect(first).toBe(second); expect(api.get).toHaveBeenCalledTimes(1);
    response.next([]); response.complete(); await first;
  });
  it('refreshes only the displayed My Bookings section, then stops after deactivation', async () => {
    const store = TestBed.inject(MyBookingsStore); const release = store.activate();
    await store.loadBookings(true); api.get.mockClear();
    await store.loadBookings(true, 'upcoming');
    expect(api.get.mock.calls.map(call => call[0])).toEqual(['/bookings/my']);
    api.get.mockClear(); await store.loadBookings(true, 'history');
    expect(api.get.mock.calls.map(call => call[0])).toEqual(['/bookings/my/history']);
    release(); api.get.mockClear(); events.next({}); await vi.advanceTimersByTimeAsync(600_000);
    expect(api.get).not.toHaveBeenCalled();
  });
  it('never creates requests for local invalidations while the document is hidden', async () => {
    const store = TestBed.inject(MyBookingsStore); store.activate(); await store.loadBookings(true);
    api.get.mockClear(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    events.next({}); await vi.advanceTimersByTimeAsync(120); expect(api.get).not.toHaveBeenCalled();
  });
});
