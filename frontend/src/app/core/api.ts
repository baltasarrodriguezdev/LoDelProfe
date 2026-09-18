import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpInterceptorFn } from '@angular/common/http';
import { Router, RouterStateSnapshot } from '@angular/router';
import { defer, finalize, firstValueFrom, fromEvent, Observable, of, shareReplay, Subject, takeUntil, tap, timeout } from 'rxjs';
import { AsyncStatus } from '../shared/async-state';

export const API = '/api';
const CSRF_COOKIE = 'padel_csrf';
const REQUEST_TIMEOUT_MS = 20000;
type ApiOptions = { noCache?: boolean; timeoutMs?: number; abortSignal?: AbortSignal };

function cookieValue(name: string) {
  return document.cookie
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(name + '='))
    ?.slice(name.length + 1) ?? '';
}

function signalUser() {
  localStorage.removeItem('token');
  try {
    return signal<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  } catch {
    return signal<any>(null);
  }
}

function requestHeaders(options?: ApiOptions) {
  return options?.noCache
    ? new HttpHeaders({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
    : undefined;
}

function applyRequestControls<T>(request: Observable<T>, options?: ApiOptions) {
  const timed = request.pipe(timeout(options?.timeoutMs ?? REQUEST_TIMEOUT_MS));
  return options?.abortSignal
    ? timed.pipe(takeUntil(fromEvent(options.abortSignal, 'abort')))
    : timed;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private readonly requests = new Map<string, Observable<unknown>>();
  private readonly publicCache = new Map<string, { value: unknown; expires: number }>();
  private readonly changes = new Subject<string>();
  readonly changes$ = this.changes.asObservable();
  private pending = 0;
  private readonly idleWaiters = new Set<() => void>();

  whenIdle(): Promise<void> {
    return this.pending === 0 ? Promise.resolve() : new Promise(resolve => this.idleWaiters.add(resolve));
  }

  private track<T>(request: Observable<T>): Observable<T> {
    return defer(() => {
      this.pending++;
      return request.pipe(finalize(() => {
        this.pending--;
        queueMicrotask(() => {
          if (this.pending !== 0) return;
          for (const resolve of this.idleWaiters) resolve();
          this.idleWaiters.clear();
        });
      }));
    });
  }

  private mutation<T>(path: string, request: Observable<T>, options?: ApiOptions) {
    return this.track(applyRequestControls(request, options)).pipe(tap(() => {
      this.publicCache.clear();
      this.changes.next(path);
    }));
  }

  get<T>(path: string, params?: Record<string, string | number>, options?: ApiOptions) {
    const key = JSON.stringify([path, Object.entries(params ?? {}).sort(), options?.timeoutMs ?? REQUEST_TIMEOUT_MS]);
    const cacheable = path === '/prices' || path === '/courts';
    const cached = this.publicCache.get(key);
    if (cacheable && cached && cached.expires > Date.now()) return of(cached.value as T);
    const shared = defer(() => {
      let request = this.requests.get(key) as Observable<T> | undefined;
      if (!request) {
        request = this.track(applyRequestControls(
          this.http.get<T>(API + path, { params: params as any, headers: requestHeaders(options) }),
          { timeoutMs: options?.timeoutMs }
        )).pipe(
          tap(value => { if (cacheable) this.publicCache.set(key, { value, expires: Date.now() + 5 * 60_000 }); }),
          finalize(() => this.requests.delete(key)),
          shareReplay({ bufferSize: 1, refCount: true })
        );
        this.requests.set(key, request);
      }
      return request;
    });
    return options?.abortSignal
      ? shared.pipe(takeUntil(fromEvent(options.abortSignal, 'abort')))
      : shared;
  }

  getBlob(path: string, params?: Record<string, string | number>, options?: ApiOptions) {
    return applyRequestControls(
      this.http.get(API + path, { params: params as any, headers: requestHeaders(options), responseType: 'blob' }),
      options
    );
  }

  post<T>(path: string, body: unknown, options?: ApiOptions) {
    return this.mutation(path, this.http.post<T>(API + path, body, { headers: requestHeaders(options) }), options);
  }

  patch<T>(path: string, body: unknown, options?: ApiOptions) {
    return this.mutation(path, this.http.patch<T>(API + path, body, { headers: requestHeaders(options) }), options);
  }

  put<T>(path: string, body: unknown, options?: ApiOptions) {
    return this.mutation(path, this.http.put<T>(API + path, body, { headers: requestHeaders(options) }), options);
  }

  delete<T>(path: string, options?: ApiOptions) {
    return this.mutation(path, this.http.delete<T>(API + path, { headers: requestHeaders(options) }), options);
  }

  deleteWithBody<T>(path: string, body: unknown, options?: ApiOptions) {
    return this.mutation(path, this.http.delete<T>(API + path, { body, headers: requestHeaders(options) }), options);
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);
  user = signalUser();
  readonly sessionRevision = signal(0);
  readonly sessionStatus = signal<AsyncStatus>('idle');
  private refreshInFlight: Promise<void> | null = null;
  private sessionInitialized = false;
  private authStateVersion = 0;
  private lastValidatedAt = 0;

  login(body: unknown) {
    return this.api.post<any>('/auth/login', body).pipe(tap(x => this.save(x)));
  }

  register(body: unknown) {
    return this.api.post<any>('/auth/register', body).pipe(tap(x => this.save(x)));
  }

  save(x: any) {
    ++this.authStateVersion;
    this.setUser(x.user);
    this.sessionInitialized = true;
    this.lastValidatedAt = Date.now();
    this.sessionStatus.set('success');
  }

  refreshIfStale() {
    return this.user() && Date.now() - this.lastValidatedAt >= 15 * 60_000
      ? this.refreshSession(true) : Promise.resolve();
  }

  refreshSession(force = false) {
    if (this.sessionInitialized && !force) return Promise.resolve();
    if (this.refreshInFlight) return this.refreshInFlight;
    const previous = this.user();
    if (!previous && !cookieValue(CSRF_COOKIE)) {
      this.sessionInitialized = true;
      this.sessionStatus.set('success');
      return Promise.resolve();
    }
    this.sessionStatus.set('loading');
    const authStateVersion = this.authStateVersion;
    let sessionResolved = false;
    this.refreshInFlight = (async () => {
      try {
        const user = await firstValueFrom(this.api.get<any>('/auth/me', undefined, { noCache: true }));
        if (authStateVersion !== this.authStateVersion) return;
        const unchanged = force && JSON.stringify(user) === JSON.stringify(this.user());
        if (!unchanged) this.setUser(user);
        this.sessionStatus.set('success');
        this.lastValidatedAt = Date.now();
        sessionResolved = true;
      } catch (error) {
        if (authStateVersion !== this.authStateVersion) return;
        const status = (error as HttpErrorResponse)?.status;
        if ([401, 403].includes(status)) {
          if (this.user() === previous) this.clearUser();
          this.sessionStatus.set('success');
          sessionResolved = true;
        } else {
          console.error('[auth] refresh session error', error);
          this.sessionStatus.set('error');
        }
      } finally {
        if (authStateVersion === this.authStateVersion) {
          this.sessionInitialized = sessionResolved;
        }
        this.refreshInFlight = null;
      }
    })();
    return this.refreshInFlight;
  }

  logout() {
    ++this.authStateVersion;
    this.api.post('/auth/logout', {}).subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout()
    });
  }

  private setUser(user: any) {
    localStorage.removeItem('token');
    localStorage.setItem('user', JSON.stringify(user));
    this.user.set(user);
    this.sessionRevision.update(value => value + 1);
  }

  private clearUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.user.set(null);
    this.sessionRevision.update(value => value + 1);
  }

  private finishLogout() {
    this.clearUser();
    this.sessionInitialized = true;
    this.sessionStatus.set('success');
    this.router.navigateByUrl('/');
  }

  isAdmin() {
    return ['ADMIN', 'SUPERADMIN'].includes(this.user()?.role);
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const csrf = cookieValue(CSRF_COOKIE);
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  return next(req.clone({
    withCredentials: true,
    setHeaders: unsafe && csrf ? { 'X-CSRF-Token': csrf } : {}
  }));
};

export const authGuard = async (_: unknown, state: RouterStateSnapshot) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.refreshSession();
  return auth.sessionStatus() === 'success' && auth.user()
    ? true
    : router.createUrlTree(['/ingresar'], { queryParams: { authRequired: '1', returnUrl: state.url } });
};

export const adminGuard = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.refreshSession();
  return auth.sessionStatus() === 'success' && auth.isAdmin() ? true : router.createUrlTree(['/']);
};

export const superAdminGuard = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.refreshSession();
  return auth.sessionStatus() === 'success' && auth.user()?.role === 'SUPERADMIN' ? true : router.createUrlTree(['/admin']);
};
