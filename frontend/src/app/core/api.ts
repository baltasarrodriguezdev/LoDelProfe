import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpInterceptorFn } from '@angular/common/http';
import { Router, RouterStateSnapshot } from '@angular/router';
import { retry, tap, throwError, timer, timeout } from 'rxjs';

export const API = '/api';
const CSRF_COOKIE = 'padel_csrf';
const REQUEST_TIMEOUT_MS = 20000;
type ApiOptions = { noCache?: boolean; timeoutMs?: number };

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

function retryTransientRequest(error: unknown, retryIndex: number) {
  const value = error as HttpErrorResponse & { name?: string };
  const transient = String(value.name) === 'TimeoutError'
    || value.status === 0
    || value.status === 408
    || value.status === 429
    || value.status >= 500;
  return transient ? timer(retryIndex * 450) : throwError(() => error);
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number>, options?: ApiOptions) {
    return this.http.get<T>(API + path, { params: params as any, headers: requestHeaders(options) })
      .pipe(
        timeout(options?.timeoutMs ?? REQUEST_TIMEOUT_MS),
        retry({ count: 2, delay: retryTransientRequest })
      );
  }

  post<T>(path: string, body: unknown, options?: ApiOptions) {
    return this.http.post<T>(API + path, body, { headers: requestHeaders(options) })
      .pipe(timeout(options?.timeoutMs ?? REQUEST_TIMEOUT_MS));
  }

  patch<T>(path: string, body: unknown, options?: ApiOptions) {
    return this.http.patch<T>(API + path, body, { headers: requestHeaders(options) })
      .pipe(timeout(options?.timeoutMs ?? REQUEST_TIMEOUT_MS));
  }

  put<T>(path: string, body: unknown, options?: ApiOptions) {
    return this.http.put<T>(API + path, body, { headers: requestHeaders(options) })
      .pipe(timeout(options?.timeoutMs ?? REQUEST_TIMEOUT_MS));
  }

  delete<T>(path: string, options?: ApiOptions) {
    return this.http.delete<T>(API + path, { headers: requestHeaders(options) })
      .pipe(timeout(options?.timeoutMs ?? REQUEST_TIMEOUT_MS));
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);
  user = signalUser();

  login(body: unknown) {
    return this.api.post<any>('/auth/login', body).pipe(tap(x => this.save(x)));
  }

  register(body: unknown) {
    return this.api.post<any>('/auth/register', body).pipe(tap(x => this.save(x)));
  }

  save(x: any) {
    this.setUser(x.user);
  }

  refreshSession() {
    const previous = this.user();
    if (!previous) return;
    this.api.get<any>('/auth/me', undefined, { noCache: true }).subscribe({
      next: user => this.setUser(user),
      error: error => {
        const status = (error as HttpErrorResponse)?.status;
        if ([401, 403].includes(status) && this.user() === previous) this.clearUser();
        else console.error('[auth] refresh session error', error);
      }
    });
  }

  logout() {
    this.api.post('/auth/logout', {}).subscribe({
      next: () => this.finishLogout(),
      error: () => this.finishLogout()
    });
  }

  private setUser(user: any) {
    localStorage.removeItem('token');
    localStorage.setItem('user', JSON.stringify(user));
    this.user.set(user);
  }

  private clearUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.user.set(null);
  }

  private finishLogout() {
    this.clearUser();
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

export const authGuard = (_: unknown, state: RouterStateSnapshot) =>
  inject(Auth).user()
    ? true
    : inject(Router).createUrlTree(['/ingresar'], { queryParams: { authRequired: '1', returnUrl: state.url } });

export const adminGuard = () =>
  inject(Auth).isAdmin() ? true : inject(Router).createUrlTree(['/']);

export const superAdminGuard = () =>
  inject(Auth).user()?.role === 'SUPERADMIN' ? true : inject(Router).createUrlTree(['/admin']);