import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';
import { Auth } from './api';

export type RealtimeEventType =
  | 'AVAILABILITY_CHANGED'
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_STATUS_CHANGED'
  | 'BOOKING_PAYMENT_CHANGED'
  | 'SCHEDULE_BLOCKED'
  | 'SCHEDULE_UNBLOCKED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_VERIFICATION_CHANGED'
  | 'PASSWORD_RESET_CHANGED'
  | 'CONFIGURATION_CHANGED'
  | 'RECURRING_BOOKING_CHANGED'
  | 'CASH_MOVEMENT_CREATED'
  | 'LEAGUE_CHANGED';

export type RealtimeResource = {
  bookingId?: number;
  courtId?: number;
  date?: string;
  previousCourtId?: number;
  previousDate?: string;
  status?: string;
  leagueId?: number;
  leagueMatchId?: number;
  resource?: 'COURTS' | 'PRICES' | 'BUSINESS_HOURS' | 'BOOKING_POLICY' | 'USERS' | 'PASSWORD_RESETS' | 'RECURRING_BOOKINGS' | 'CASH' | 'LEAGUE';
  refreshAt?: string;
};

export type RealtimeEvent = {
  id: string;
  type: RealtimeEventType;
  occurredAt: string;
  resource: RealtimeResource;
};

export type RealtimeResyncReason = 'connected' | 'reconnected' | 'online' | 'visible' | 'fallback';
export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'offline';

const MAX_RECONNECT_ATTEMPTS = 5;

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private readonly eventsSubject = new Subject<RealtimeEvent>();
  private readonly resyncSubject = new Subject<RealtimeResyncReason>();
  private readonly seen = new Map<string, number>();
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private connectedOnce = false;
  private started = false;
  private stopped = false;
  private reconnectExhausted = false;
  private observedSessionRevision: number | undefined;

  readonly status = signal<RealtimeStatus>('idle');
  readonly events$ = this.eventsSubject.asObservable();
  readonly resync$ = this.resyncSubject.asObservable();

  constructor() {
    effect(() => {
      const revision = (this.auth as Auth & { sessionRevision?: () => number }).sessionRevision;
      if (typeof revision !== 'function') return;
      const currentRevision = revision();
      if (this.observedSessionRevision === undefined) {
        this.observedSessionRevision = currentRevision;
        return;
      }
      if (currentRevision === this.observedSessionRevision) return;
      this.observedSessionRevision = currentRevision;
      if (this.started) queueMicrotask(() => this.restart());
    });
    this.destroyRef.onDestroy(() => this.stop());
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.stopped = false;
    this.reconnectAttempt = 0;
    this.reconnectExhausted = false;
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.fallbackTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) this.resyncSubject.next('fallback');
    }, 60_000);
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.started = false;
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearTimers();
    this.socket?.close(1000, 'Aplicación cerrada');
    this.socket = null;
    this.status.set('idle');
  }

  listen(types: readonly RealtimeEventType[]): Observable<RealtimeEvent> {
    const accepted = new Set(types);
    return this.events$.pipe(filter(event => accepted.has(event.type)));
  }

  affectsAvailability(event: RealtimeEvent, date: string, courtId?: number | null) {
    const resource = event.resource;
    const dateMatches = !resource.date || resource.date === date || resource.previousDate === date;
    const courtMatches = courtId == null || !resource.courtId
      || resource.courtId === courtId || resource.previousCourtId === courtId;
    return dateMatches && courtMatches;
  }

  private connect() {
    if (this.stopped || !this.started || this.socket || !navigator.onLine || this.reconnectExhausted) {
      if (!navigator.onLine) this.status.set('offline');
      if (this.reconnectExhausted) this.status.set('offline');
      return;
    }
    this.status.set('connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/api/realtime`);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.status.set('connected');
      this.reconnectAttempt = 0;
      this.reconnectExhausted = false;
      const reason: RealtimeResyncReason = this.connectedOnce ? 'reconnected' : 'connected';
      this.connectedOnce = true;
      this.resyncSubject.next(reason);
      this.heartbeatTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'PING' }));
      }, 25_000);
    });
    socket.addEventListener('message', message => this.handleMessage(message.data));
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.clearHeartbeat();
      if (!this.stopped) this.scheduleReconnect();
    });
    socket.addEventListener('error', () => socket.close());
  }

  private handleMessage(value: unknown) {
    try {
      const message = JSON.parse(String(value));
      if (message?.type === 'REALTIME_CONNECTED' || message?.type === 'PONG') return;
      if (!message?.id || !message?.type || !message?.resource || this.isDuplicate(message.id)) return;
      this.eventsSubject.next(message as RealtimeEvent);
    } catch {
      // Un mensaje inválido se ignora; REST sigue siendo la fuente de verdad.
    }
  }

  private isDuplicate(id: string) {
    const now = Date.now();
    for (const [seenId, timestamp] of this.seen) if (now - timestamp > 120_000) this.seen.delete(seenId);
    if (this.seen.has(id)) return true;
    this.seen.set(id, now);
    return false;
  }

  private scheduleReconnect() {
    if (!navigator.onLine) {
      this.status.set('offline');
      return;
    }
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      this.reconnectExhausted = true;
      this.status.set('offline');
      return;
    }
    this.status.set('connecting');
    const base = Math.min(30_000, 1_000 * 2 ** Math.min(this.reconnectAttempt++, 5));
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private restart() {
    if (!this.started || this.stopped) return;
    this.reconnectAttempt = 0;
    this.reconnectExhausted = false;
    this.clearRetry();
    const socket = this.socket;
    this.socket = null;
    this.clearHeartbeat();
    socket?.close(1000, 'Sesión actualizada');
    this.connect();
  }

  private readonly onOnline = () => {
    this.resyncSubject.next('online');
    this.reconnectAttempt = 0;
    this.reconnectExhausted = false;
    this.clearRetry();
    this.connect();
  };

  private readonly onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    this.resyncSubject.next('visible');
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.clearRetry();
      this.connect();
    }
  };

  private clearRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private clearTimers() {
    this.clearRetry();
    this.clearHeartbeat();
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }
}
