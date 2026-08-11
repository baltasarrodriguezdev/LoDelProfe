import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpInterceptorFn } from '@angular/common/http';
import { Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, fromEvent, Observable, takeUntil, tap, timeout } from 'rxjs';
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

  get<T>(path: string, params?: Record<string, string | number>, options?: ApiOptions) {
    return applyRequestControls(
      this.http.get<T>(API + path, { params: params as any, headers: requestHeaders(options) }),
      options
    );
  }

  post<T>(path: string, body: unknown, options?: ApiOptions) {
    return applyRequestControls(this.http.post<T>(API + path, body, { headers: requestHeaders(options) }), options);
  }

  patch<T>(path: string, body: unknown, options?: ApiOptions) {
    return applyRequestControls(this.http.patch<T>(API + path, body, { headers: requestHeaders(options) }), options);
  }

  put<T>(path: string, body: unknown, options?: ApiOptions) {
    return applyRequestControls(this.http.put<T>(API + path, body, { headers: requestHeaders(options) }), options);
  }

  delete<T>(path: string, options?: ApiOptions) {
    return applyRequestControls(this.http.delete<T>(API + path, { headers: requestHeaders(options) }), options);
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
    this.sessionStatus.set('success');
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
