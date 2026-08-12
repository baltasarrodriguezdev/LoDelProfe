import { Component, DestroyRef, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { Auth } from '../core/api';

type AdminNavItem = {
  label: string;
  route: string;
  queryParams?: Record<string, string>;
};

@Component({
  selector: 'app-admin-navigation',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="admin-navigation" aria-label="Navegación del panel administrador">
      <div class="admin-navigation-inner">
        <button
          type="button"
          class="admin-navigation-toggle"
          [class.open]="mobileOpen"
          [attr.aria-expanded]="mobileOpen"
          [attr.aria-label]="(mobileOpen ? 'Cerrar' : 'Abrir') + ' navegación administrativa. Sección actual: ' + currentSection()"
          aria-controls="admin-navigation-mobile"
          (click)="mobileOpen = !mobileOpen"
        >
          <span><small>SECCIÓN ACTUAL</small><strong>{{ currentSection() }}</strong></span>
          <span class="admin-navigation-chevron" aria-hidden="true">⌄</span>
        </button>

        <div id="admin-navigation-mobile" class="admin-navigation-mobile" [class.open]="mobileOpen">
          <span class="admin-navigation-label">USO DIARIO</span>
          @for (item of dailyItems; track item.label) {
            <a [routerLink]="item.route" [queryParams]="item.queryParams" [class.active]="isActive(item)"
              [attr.aria-current]="isActive(item) ? 'page' : null" (click)="close()">{{ item.label }}</a>
          }
          @if (auth.user()?.role === 'SUPERADMIN') {
            <span class="admin-navigation-label">CONFIGURACIÓN</span>
            @for (item of configurationItems; track item.label) {
              <a [routerLink]="item.route" [class.active]="isActive(item)"
                [attr.aria-current]="isActive(item) ? 'page' : null" (click)="close()">{{ item.label }}</a>
            }
          }
        </div>

        <div class="admin-navigation-desktop">
          <a class="admin-navigation-brand" routerLink="/admin" [class.active]="currentPath() === '/admin'">Panel</a>
          @for (item of dailyItems.slice(1); track item.label) {
            <a [routerLink]="item.route" [queryParams]="item.queryParams" [class.active]="isActive(item)"
              [attr.aria-current]="isActive(item) ? 'page' : null">{{ item.label }}</a>
          }
          @if (auth.user()?.role === 'SUPERADMIN') {
            <details #configurationTools class="admin-navigation-tools" [class.active]="configurationActive()">
              <summary>Configuración</summary>
              <div>
                @for (item of configurationItems; track item.label) {
                  <a [routerLink]="item.route" [class.active]="isActive(item)"
                    [attr.aria-current]="isActive(item) ? 'page' : null" (click)="configurationTools.open = false">{{ item.label }}</a>
                }
              </div>
            </details>
          }
        </div>
      </div>
    </nav>
  `
})
export class AdminNavigationComponent {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  mobileOpen = false;

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.close());
  }

  readonly dailyItems: AdminNavItem[] = [
    { label: 'Hoy', route: '/admin' },
    { label: 'Agenda diaria', route: '/admin/agenda-diaria' },
    { label: 'Agenda semanal', route: '/admin/agenda-semanal' },
    { label: 'Agregar turno', route: '/admin/turno' },
    { label: 'Bloquear horario', route: '/admin/turno', queryParams: { mode: 'block' } },
    { label: 'La Liga', route: '/admin/la-liga' },
    { label: 'Historias Instagram', route: '/admin/marketing/historias-instagram' }
  ];

  readonly configurationItems: AdminNavItem[] = [
    { label: 'Precios', route: '/admin/precios' },
    { label: 'Horarios', route: '/admin/horarios' },
    { label: 'Políticas', route: '/admin/politicas' },
    { label: 'Turnos fijos', route: '/admin/turnos-fijos' },
    { label: 'Clientes', route: '/admin/clientes' },
    { label: 'Seguridad y accesos', route: '/admin/seguridad' },
    { label: 'Caja', route: '/admin/caja' },
    { label: 'Estadísticas', route: '/admin/estadisticas' }
  ];

  currentPath() {
    return this.router.url.split(/[?#]/)[0] || '/';
  }

  currentSection() {
    const item = [...this.dailyItems, ...this.configurationItems].find(candidate => this.isActive(candidate));
    return item?.label ?? 'Panel';
  }

  isActive(item: AdminNavItem) {
    const path = this.currentPath();
    if (item.route === '/admin') return path === '/admin';
    if (item.route === '/admin/turno') {
      const blockMode = this.router.url.includes('mode=block');
      return path === item.route && Boolean(item.queryParams?.['mode']) === blockMode;
    }
    return path === item.route;
  }

  configurationActive() {
    return this.configurationItems.some(item => this.isActive(item));
  }

  close() {
    this.mobileOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.close();
  }

  @HostListener('window:resize')
  onResize() {
    if (window.innerWidth > 900) this.close();
  }
}
