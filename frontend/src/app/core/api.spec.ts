import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { Api, Auth } from './api';
import { RealtimeService } from './realtime';

describe('API request coordination and session checks', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers(); localStorage.clear();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); });
  it('shares simultaneous GETs and waits until they complete', async () => {
    const api = TestBed.inject(Api);
    const one = firstValueFrom(api.get('/availability', { date: '2030-01-01' }));
    const two = firstValueFrom(api.get('/availability', { date: '2030-01-01' }));
    let idle = false; const finished = api.whenIdle().then(() => { idle = true; });
    expect(idle).toBe(false);
    http.expectOne('/api/availability?date=2030-01-01').flush({ slots: [] });
    await Promise.all([one, two, finished]); expect(idle).toBe(true);
  });
  it('caches prices and courts for five minutes and invalidates on a successful mutation', async () => {
    const api = TestBed.inject(Api);
    const initial = firstValueFrom(api.get('/prices'));
    http.expectOne('/api/prices').flush([{ id: 1 }]); await initial;
    expect(await firstValueFrom(api.get('/prices'))).toEqual([{ id: 1 }]); http.expectNone('/api/prices');
    const mutation = firstValueFrom(api.patch('/admin/prices/1', { price: 123 }));
    http.expectOne('/api/admin/prices/1').flush({}); await mutation;
    const fresh = firstValueFrom(api.get('/prices')); http.expectOne('/api/prices').flush([]); await fresh;
    await vi.advanceTimersByTimeAsync(300_001);
    const expired = firstValueFrom(api.get('/prices')); http.expectOne('/api/prices').flush([]); await expired;
  });
  it('does not query auth/me each minute on an active screen; revalidates after fifteen minutes', async () => {
    const auth = TestBed.inject(Auth); auth.save({ user: { id: 1, role: 'CLIENT' } });
    const refresh = vi.fn(); const subscription = TestBed.inject(RealtimeService).poll$().subscribe(refresh);
    try {
      await vi.advanceTimersByTimeAsync(14 * 60_000);
      http.expectNone('/api/auth/me'); expect(refresh).toHaveBeenCalledTimes(14);
      await vi.advanceTimersByTimeAsync(60_000);
      http.expectOne('/api/auth/me').flush({ id: 1, role: 'CLIENT' });
      await vi.advanceTimersByTimeAsync(0);
      expect(refresh).toHaveBeenCalledTimes(15);
    } finally { subscription.unsubscribe(); }
  });
});
