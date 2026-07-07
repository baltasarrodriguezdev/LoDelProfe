import { Component, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { VENUE } from '../../shared/venue';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero hero-poster">
      <div class="hero-poster__bg" aria-hidden="true">
        <img src="assets/logos/foto-padel-hero.jpg" alt="">
      </div>
      <div class="hero-poster__overlay" aria-hidden="true"></div>
      <div class="hero-copy hero-content">
        <span class="eyebrow hero-eyebrow">CANCHA DE PÁDEL · VILLA CONCEPCIÓN</span>
        <h1 class="hero-title">EL PARTIDO<br>EMPIEZA <em>ACÁ.</em></h1>
        <p class="hero-subtitle">Elegí horario, armá tu equipo y vení a jugar.</p>
        <div class="actions hero-actions"><a class="btn primary" routerLink="/reservar">Reservar turno</a><a class="btn ghost" routerLink="/reservar">Ver horarios</a></div>
        <div class="hero-details" aria-label="Información de Lo del Profe">
          <div><strong>Turnos online</strong><span>1h · 1h 30m · 2h</span></div>
          <div><strong>Cancha de pádel</strong><span>Villa Concepción del Tío</span></div>
          <div><strong>Lo del Profe</strong><span>Pádel, amigos y buenos partidos</span></div>
        </div>
      </div>
    </section>

    <section class="location-section" id="ubicacion">
      <div class="location-copy">
        <span class="eyebrow">CÓMO LLEGAR</span>
        <h2>Llegá fácil a la cancha.</h2>
        <p>Estamos cerca para que vengas directo al partido, sin vueltas. Abrí el mapa, organizá el equipo y venite a jugar.</p>
        <div class="address-card"><span class="location-pin">⌖</span><div><small>DIRECCIÓN</small><strong>{{ venue.address }}</strong></div></div>
        <a class="btn primary maps-button" [href]="venue.mapsUrl" target="_blank" rel="noopener noreferrer">Abrir en Google Maps <span>↗</span></a>
      </div>
      <div class="map-frame">
        <iframe [src]="mapUrl" title="Ubicación de Lo del Profe" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </section>
  `
})
export class HomePage {
  private sanitizer = inject(DomSanitizer);
  venue = VENUE;
  mapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(VENUE.embedUrl);
}
