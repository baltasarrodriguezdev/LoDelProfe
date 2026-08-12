import { Component, DestroyRef, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { debounceTime, filter, merge } from 'rxjs';
import { Auth } from './core/api';
import { AdminNavigationComponent } from './shared/admin-navigation.component';
import { APP_TAILWIND_CLASSES, APP_TAILWIND_FEATURE_CLASSES, APP_TAILWIND_PUBLIC_CLASSES } from './shared/tailwind-classes';
import { VENUE } from './shared/venue';
import { RealtimeService } from './core/realtime';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, AdminNavigationComponent],
  template: `
    <div [attr.class]="tailwindClasses">
    @if (!isAuthPage()) {
      <header class="site-header" [class.home-header]="isHomePage()">
        <div class="site-header-inner">
          <a class="brand brand-logo" routerLink="/" aria-label="Lo del Profe, inicio"><img src="assets/logos/lo-del-profe-horizontal.png" alt="Lo del Profe"></a>
          <button type="button" class="mobile-menu-toggle" [class.open]="mobileMenuOpen" [attr.aria-expanded]="mobileMenuOpen" [attr.aria-label]="mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'" aria-controls="primary-navigation" (click)="toggleMobileMenu()"><span></span><span></span><span></span></button>
          <nav id="primary-navigation" aria-label="Navegación principal" [class.open]="mobileMenuOpen">
            @for (item of navigationItems(); track item.label) {
              <a [routerLink]="item.route" [fragment]="item.fragment" [class.active]="isNavigationActive(item)" [class.nav-cta]="item.cta" (click)="closeMobileMenu()">{{ item.label }}</a>
            }
            @if (auth.user()) {
              <button type="button" class="link" (click)="logout()">Salir</button>
            }
          </nav>
        </div>
      </header>
      @if (mobileMenuOpen) {
        <button type="button" class="mobile-menu-backdrop" aria-label="Cerrar menú" (click)="closeMobileMenu()"></button>
      }
      @if (isAdminPage() && auth.isAdmin()) {
        <app-admin-navigation />
      }
    }

    <main><router-outlet/></main>

    @if (!isAuthPage()) {
      <footer class="footer">
        <div class="footer-container">
          <section class="footer-brand" aria-label="Lo del Profe">
            <img class="footer-logo" src="assets/logos/lo-del-profe-horizontal.png" alt="Lo del Profe">
            <strong class="footer-title">Cancha de pádel</strong>
            <p>Pádel, amigos y buenos partidos.</p>
          </section>
          <nav class="footer-nav" aria-label="Navegación del pie de página">
            <span class="footer-eyebrow">Navegación</span>
            <div class="footer-links">
              @if (auth.user()) {
                <a class="footer-link" routerLink="/reservar">Reservar</a>
                <a class="footer-link" routerLink="/mis-turnos">Mis turnos</a>
              } @else {
                <a class="footer-link" routerLink="/">Inicio</a>
                <a class="footer-link" routerLink="/ingresar">Ingresar</a>
              }
              <a class="footer-link" routerLink="/la-liga">La Liga</a>
              <a class="footer-link" routerLink="/" fragment="como-llegar">Cómo llegar</a>
            </div>
          </nav>
          <section class="footer-contact">
            <span class="footer-eyebrow">Cómo llegar</span>
            <p>Villa Concepción del Tío, Córdoba</p>
            <a class="footer-map-link" [href]="venue.mapsUrl" target="_blank" rel="noopener noreferrer">Abrir en Google Maps <span>↗</span></a>
          </section>
        </div>
        <div class="footer-bottom">
          <span>© 2026 Lo del Profe. Todos los derechos reservados.</span>
          <span>Reservas simples. Partidos grandes.</span>
        </div>
      </footer>
    }
    </div>
  `
})
export class AppComponent {
  readonly tailwindClasses = `${APP_TAILWIND_CLASSES} ${APP_TAILWIND_PUBLIC_CLASSES} ${APP_TAILWIND_FEATURE_CLASSES}`;
  auth = inject(Auth);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private realtime = inject(RealtimeService);
  venue = VENUE;
  mobileMenuOpen = false;

  constructor() {
    this.auth.refreshSession();
    this.realtime.start();
    merge(
      this.realtime.listen(['USER_UPDATED', 'USER_VERIFICATION_CHANGED']),
      this.realtime.resync$
    ).pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.auth.user()) void this.auth.refreshSession(true);
    });
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.closeMobileMenu());
    this.destroyRef.onDestroy(() => document.body.classList.remove('mobile-menu-open'));
  }

  navigationItems() {
    const items = [
      { label: 'Reservar', route: '/reservar' },
      { label: 'La Liga', route: '/la-liga' },
      ...(this.auth.user() ? [{ label: 'Mis turnos', route: '/mis-turnos' }] : []),
      { label: 'Cómo llegar', route: '/', fragment: 'como-llegar' },
      ...(this.auth.isAdmin() ? [{ label: 'Admin', route: '/admin' }] : []),
      ...(!this.auth.user() ? [
        { label: 'Ingresar', route: '/ingresar' },
        { label: 'Registrarse', route: '/registro', cta: true }
      ] : [])
    ];
    return items;
  }

  toggleMobileMenu() { this.setMobileMenu(!this.mobileMenuOpen); }

  closeMobileMenu() { this.setMobileMenu(false); }

  private setMobileMenu(open: boolean) {
    this.mobileMenuOpen = open;
    document.body.classList.toggle('mobile-menu-open', open);
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.closeMobileMenu(); }

  @HostListener('window:resize')
  onResize() { if (window.innerWidth > 900) this.closeMobileMenu(); }

  isNavigationActive(item: { label: string; route: string; fragment?: string }) {
    const [pathWithQuery, fragment = ''] = this.router.url.split('#');
    const path = pathWithQuery.split('?')[0] || '/';
    if (item.label === 'Reservar') return path === '/reservar';
    if (item.label === 'La Liga') return path === '/la-liga';
    if (item.label === 'Mis turnos') return path === '/mis-turnos';
    if (item.label === 'Admin') return path === '/admin' || path.startsWith('/admin/');
    if (item.label === 'Cómo llegar') return path === '/como-llegar' || (path === '/' && fragment === 'como-llegar');
    return path === item.route;
  }

  logout() {
    this.closeMobileMenu();
    this.auth.logout();
  }

  isAuthPage() {
    return ['/ingresar', '/login', '/registro'].some(path => this.router.url.startsWith(path));
  }

  isHomePage() {
    return this.router.url.split(/[?#]/)[0] === '/';
  }

  isAdminPage() {
    return this.router.url.split(/[?#]/)[0].startsWith('/admin');
  }
}
