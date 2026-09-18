import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api, Auth } from './api';
import { RealtimeService } from './realtime';
import { startScreenPolling } from './screen-polling';

describe('screen-owned polling', () => {
  const stops: Array<() => void> = [];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  });
  afterEach(() => {
    stops.splice(0).forEach(stop => stop());
    TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  });
  it('does not open sockets or schedule global refreshes just by creating the service', async () => {
    const socket = vi.fn(); vi.stubGlobal('WebSocket', socket);
    const auth = { refreshIfStale: vi.fn(() => Promise.resolve()) };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(),
      { provide: Api, useValue: { changes$: new Subject(), whenIdle: () => Promise.resolve() } },
      { provide: Auth, useValue: auth }
    ] });
    TestBed.inject(RealtimeService);
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(socket).not.toHaveBeenCalled(); expect(auth.refreshIfStale).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('refreshes after 60 seconds and removes timers/listeners on destruction', async () => {
    const refresh = vi.fn(); const stop = startScreenPolling(refresh); stops.push(stop);
    await vi.advanceTimersByTimeAsync(59_999); expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(refresh).toHaveBeenCalledTimes(1);
    stop(); window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(600_000); expect(refresh).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('pauses in background and resumes once despite simultaneous visibility/online events', async () => {
    const refresh = vi.fn(); stops.push(startScreenPolling(refresh));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange')); expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(300_000); expect(refresh).not.toHaveBeenCalled();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0); expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('does not overlap work and waits 60 seconds after completion', async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    stops.push(startScreenPolling(refresh));
    await vi.advanceTimersByTimeAsync(60_000); await vi.advanceTimersByTimeAsync(300_000);
    window.dispatchEvent(new Event('online')); expect(refresh).toHaveBeenCalledTimes(1);
    finish(); await vi.advanceTimersByTimeAsync(0); await vi.advanceTimersByTimeAsync(59_999);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('pauses when offline', async () => {
    const refresh = vi.fn(); stops.push(startScreenPolling(refresh));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); window.dispatchEvent(new Event('offline'));
    await vi.advanceTimersByTimeAsync(180_000); expect(refresh).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('unsubscribing during pending requests prevents a late screen refresh', async () => {
    let finish!: () => void; const waiting = new Promise<void>(resolve => { finish = resolve; });
    const auth = { refreshIfStale: vi.fn(() => Promise.resolve()) };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(),
      { provide: Api, useValue: { changes$: new Subject(), whenIdle: () => waiting } }, { provide: Auth, useValue: auth }
    ] });
    const refresh = vi.fn(); const subscription = TestBed.inject(RealtimeService).poll$().subscribe(refresh);
    await vi.advanceTimersByTimeAsync(60_000); subscription.unsubscribe(); finish();
    await vi.advanceTimersByTimeAsync(0); expect(refresh).not.toHaveBeenCalled();
    expect(auth.refreshIfStale).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
});
