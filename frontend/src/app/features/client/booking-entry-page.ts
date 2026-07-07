import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VENUE } from '../../shared/venue';

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
        <p class="booking-entry__intro">Creá tu cuenta para reservar online, ver tus turnos y gestionar tus reservas desde la web. Si preferís hacerlo como siempre, también podés escribirnos por WhatsApp.</p>

        <div class="booking-entry__actions">
          <a class="btn primary booking-entry__primary" routerLink="/registro" [queryParams]="{ returnUrl: '/reservar' }">
            <span>Crear cuenta y reservar</span><b aria-hidden="true">→</b>
          </a>
          <a class="btn booking-entry__secondary" routerLink="/ingresar" [queryParams]="{ returnUrl: '/reservar' }">Ya tengo cuenta</a>
        </div>

        <div class="booking-entry__divider"><span>O reservá como siempre</span></div>

        <a class="booking-entry__whatsapp" [href]="whatsappUrl" target="_blank" rel="noopener noreferrer">
          <span class="booking-entry__whatsapp-icon" aria-hidden="true">W</span>
          <span><strong>Reservar por WhatsApp</strong><small>Completá los datos del turno en el mensaje</small></span>
          <b aria-hidden="true">↗</b>
        </a>

        <p class="booking-entry__note">La reserva online permite consultar, cancelar y revisar tus próximos turnos desde un solo lugar.</p>
      </article>
    </section>
  `
})
export class BookingEntryPage {
  private readonly message = `Hola, quiero reservar un turno en Lo del Profe.

Nombre:
Día:
Horario:
Duración:`;

  readonly whatsappUrl = `https://wa.me/${VENUE.whatsapp}?text=${encodeURIComponent(this.message)}`;
}
