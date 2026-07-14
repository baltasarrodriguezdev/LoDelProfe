import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { Router, RouterStateSnapshot } from '@angular/router';
import { tap } from 'rxjs';

export const API = '/api';
const CSRF_COOKIE = 'padel_csrf';

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

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  get<T>(path: string, params?: Record<string, string | number>) {
    return this.http.get<T>(API + path, { params: params as any });
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(API + path, body);
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(API + path, body);
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(API + path, body);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(API + path);
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
    this.api.get<any>('/auth/me').subscribe({
      next: user => this.setUser(user),
      error: () => {
        if (this.user() === previous) this.clearUser();
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
