import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from './api';
import { RealtimeService } from './realtime';

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(readonly url: string) {
    super();
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  message(value: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }));
  }

  send(value: string) { this.sent.push(value); }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return;
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close'));
  }
}

describe('RealtimeService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Auth, useValue: { sessionRevision: signal(0) } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('mantiene una sola conexión y deduplica avisos repetidos', () => {
    const service = TestBed.inject(RealtimeService);
    const received: string[] = [];
    service.events$.subscribe(event => received.push(event.id));

    service.start();
    service.start();
    expect(MockWebSocket.instances).toHaveLength(1);
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toContain('/api/realtime');
    socket.open();
    const event = { id: 'same-id', type: 'AVAILABILITY_CHANGED', occurredAt: new Date().toISOString(), resource: { courtId: 1 } };
    socket.message(event);
    socket.message(event);

    expect(received).toEqual(['same-id']);
    expect(service.status()).toBe('connected');
    service.stop();
  });

  it('reconecta con backoff y solicita resincronización', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const service = TestBed.inject(RealtimeService);
    const reasons: string[] = [];
    service.resync$.subscribe(reason => reasons.push(reason));
    service.start();
    MockWebSocket.instances[0].open();
    expect(reasons).toContain('connected');

    MockWebSocket.instances[0].close();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(MockWebSocket.instances).toHaveLength(2);
    MockWebSocket.instances[1].open();
    expect(reasons).toContain('reconnected');
    service.stop();
  });
});
