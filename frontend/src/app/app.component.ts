import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './core/api';
import { VENUE } from './shared/venue';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (!isAuthPage()) {
      <header class="site-header">
        <div class="site-header__inner">
          <a class="brand brand-logo" routerLink="/" aria-label="Lo del Profe, inicio"><img src="assets/logos/lo-del-profe-horizontal.png" alt="Lo del Profe"></a>
          <button type="button" class="mobile-menu-toggle" [class.open]="mobileMenuOpen" [attr.aria-expanded]="mobileMenuOpen" aria-label="Abrir menú" (click)="mobileMenuOpen = !mobileMenuOpen"><span></span><span></span><span></span></button>
          <nav [class.open]="mobileMenuOpen" (click)="closeMobileMenu()">
            @if (!auth.user()) {
              <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Inicio</a>
              <a routerLink="/reservar" routerLinkActive="active">Reservar</a>
              <a routerLink="/" fragment="ubicacion">Cómo llegar</a>
              <a routerLink="/ingresar">Ingresar</a>
              <a class="nav-cta" routerLink="/registro">Registrarse</a>
            } @else {
              <a routerLink="/reservar" routerLinkActive="active">Reservar</a>
              <a routerLink="/mis-turnos" routerLinkActive="active">Mis turnos</a>
              <a routerLink="/" fragment="ubicacion">Cómo llegar</a>
              @if (auth.isAdmin()) { <a routerLink="/admin" routerLinkActive="active">Admin</a> }
              <button class="link" (click)="auth.logout()">Salir</button>
            }
          </nav>
        </div>
      </header>
    }

    <main><router-outlet/></main>

    @if (!isAuthPage()) {
      <footer class="footer">
        <div class="footer__container">
          <section class="footer__brand" aria-label="Lo del Profe">
            <img class="footer__logo" src="assets/logos/lo-del-profe-horizontal.png" alt="Lo del Profe">
            <strong class="footer__title">Cancha de pádel</strong>
            <p>Pádel, amigos y buenos partidos.</p>
          </section>
          <nav class="footer__nav" aria-label="Navegación del pie de página">
            <span class="footer__eyebrow">Navegación</span>
            <div class="footer__links">
              @if (auth.user()) {
                <a class="footer__link" routerLink="/reservar">Reservar</a>
                <a class="footer__link" routerLink="/mis-turnos">Mis turnos</a>
              } @else {
                <a class="footer__link" routerLink="/">Inicio</a>
                <a class="footer__link" routerLink="/ingresar">Ingresar</a>
              }
              <a class="footer__link" routerLink="/" fragment="ubicacion">Cómo llegar</a>
            </div>
          </nav>
          <section class="footer__contact">
            <span class="footer__eyebrow">Cómo llegar</span>
            <p>Villa Concepción del Tío, Córdoba</p>
            <a class="footer__map-link" [href]="venue.mapsUrl" target="_blank" rel="noopener noreferrer">Abrir en Google Maps <span>↗</span></a>
          </section>
        </div>
        <div class="footer__bottom">
          <span>© 2026 Lo del Profe. Todos los derechos reservados.</span>
          <span>Reservas simples. Partidos grandes.</span>
        </div>
      </footer>
    }
  `
})
export class AppComponent {
  auth = inject(Auth);
  private router = inject(Router);
  venue = VENUE;
  mobileMenuOpen = false;

  closeMobileMenu() { this.mobileMenuOpen = false; }

  isAuthPage() {
    return ['/ingresar', '/login', '/registro'].some(path => this.router.url.startsWith(path));
  }
}
