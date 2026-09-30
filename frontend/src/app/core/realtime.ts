import { inject, Injectable } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { Api, Auth } from './api';
import { startScreenPolling } from './screen-polling';
import { environment } from '../../environments/environment';

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

function resolveWebsocketUrl(configuredUrl: string) {
  if (/^wss?:\/\//i.test(configuredUrl)) return configuredUrl;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const path = configuredUrl.startsWith('/') ? configuredUrl : `/${configuredUrl}`;
  return `${protocol}//${location.host}${path}`;
}

// Retain the existing event vocabulary for local mutations; there is no network transport.
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  readonly websocketUrl = resolveWebsocketUrl(environment.websocketUrl);

  poll$(ready: () => boolean = () => true): Observable<string> {
    return new Observable(observer => startScreenPolling(async () => {
      await this.api.whenIdle();
      if (observer.closed || document.visibilityState !== 'visible' || !navigator.onLine || !ready()) return;
      await this.auth.refreshIfStale();
      if (observer.closed || document.visibilityState !== 'visible' || !navigator.onLine || !ready()) return;
      observer.next('poll');
      await this.api.whenIdle();
    }, 60_000, ready));
  }

  listen(types: readonly RealtimeEventType[]): Observable<RealtimeEvent> {
    const accepted = new Set(types);
    return this.api.changes$.pipe(
      map(path => this.localEvent(path)),
      map(event => event?.type === 'BOOKING_UPDATED' && accepted.has('AVAILABILITY_CHANGED')
        ? { ...event, type: 'AVAILABILITY_CHANGED' as const } : event),
      filter((event): event is RealtimeEvent => !!event && accepted.has(event.type)
        && document.visibilityState === 'visible' && navigator.onLine)
    );
  }

  private localEvent(path: string): RealtimeEvent | null {
    let type: RealtimeEventType;
    let resource: RealtimeResource = {};
    if (path.includes('/leagues')) type = 'LEAGUE_CHANGED';
    else if (path.includes('/users')) { type = 'USER_UPDATED'; resource = { resource: 'USERS' }; }
    else if (path.includes('password-reset')) { type = 'PASSWORD_RESET_CHANGED'; resource = { resource: 'PASSWORD_RESETS' }; }
    else if (path.includes('recurring')) type = 'RECURRING_BOOKING_CHANGED';
    else if (path.includes('/bookings') || path.includes('/reservations') || path.includes('/blocks')) type = 'BOOKING_UPDATED';
    else if (path.includes('/cash')) type = 'CASH_MOVEMENT_CREATED';
    else {
      const name = path.includes('/courts') ? 'COURTS' : path.includes('/prices') ? 'PRICES'
        : path.includes('/business-hours') ? 'BUSINESS_HOURS' : path.includes('/booking-policy') ? 'BOOKING_POLICY' : null;
      if (!name) return null;
      type = 'CONFIGURATION_CHANGED'; resource = { resource: name };
    }
    return { id: path, type, resource, occurredAt: new Date().toISOString() };
  }

  affectsAvailability(event: RealtimeEvent, date: string, courtId?: number | null) {
    const resource = event.resource;
    return (!resource.date || resource.date === date || resource.previousDate === date)
      && (courtId == null || !resource.courtId || resource.courtId === courtId || resource.previousCourtId === courtId);
  }
}
