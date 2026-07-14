import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  styleUrl: './booking-entry-page.css',
  template: `
    <section class="booking-entry">
      <div class="booking-entry__accent" aria-hidden="true"></div>
      <article class="booking-entry__card">
        <span class="eyebrow">RESERVAS · LO DEL PROFE</span>
        <h1>¿Cómo querés reservar?</h1>
        <p class="booking-entry__intro">Creá tu cuenta para reservar online, ver tus turnos y gestionar tus reservas desde la web.</p>

        <div class="booking-entry__actions">
          <a class="btn primary booking-entry__primary" routerLink="/registro" [queryParams]="{ returnUrl: '/reservar' }">
            <span>Crear cuenta y reservar</span><b aria-hidden="true">→</b>
          </a>
          <a class="btn booking-entry__secondary" routerLink="/ingresar" [queryParams]="{ returnUrl: '/reservar' }">Ya tengo cuenta</a>
        </div>

        <p class="booking-entry__note">La reserva online permite consultar, cancelar y revisar tus próximos turnos desde un solo lugar.</p>
      </article>
    </section>
  `
})
export class BookingEntryPage {}
