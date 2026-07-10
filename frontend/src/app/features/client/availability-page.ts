import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, Auth } from '../../core/api';
import { VENUE } from '../../shared/venue';
import { buildWhatsappBookingUrl } from '../../shared/whatsapp-booking';

type Price = { id: number; durationMinutes: number; price: number };
type Slot = { startTime: string; endTime: string; available: boolean };
type Availability = { date: string; durationMinutes: number; price: number | null; reason?: string; message?: string; slots: Slot[] };
type PendingBooking = { date: string; duration: number; startTime: string };

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrl: './availability-page.css',
  template: `
    <section class="page-head availability-head">
      <span class="eyebrow">RESERVAS</span>
      <h1>Encontrá tu próximo partido.</h1>
      <p>Elegí la duración y te mostramos directamente los mejores horarios disponibles.</p>
    </section>

    <section class="turn-grid-layout">
      <aside class="panel turn-filters">
        <div class="filter-step"><span>01</span><label>Fecha<input type="date" [min]="today" [(ngModel)]="date" (change)="search()"></label></div>
        <div class="filter-step duration-step"><span>02</span><div><label>Duración del turno</label><div class="duration-options">@for (price of prices; track price.id) { <button type="button" [class.selected]="duration === price.durationMinutes" (click)="selectDuration(price.durationMinutes)"><b>{{ durationLabel(price.durationMinutes) }}</b><small>{{ price.price | currency:'ARS':'symbol':'1.0-0' }}</small></button> }</div></div></div>
      </aside>

      <div class="turn-results" aria-live="polite">
        <div class="result-title turn-results-title"><div><span class="eyebrow">HORARIOS DEL DÍA</span><h2>Elegí cuándo jugar</h2><p>{{ formattedDate }} · {{ durationLabel(duration) }}</p></div>@if (result?.price) { <strong>{{ result!.price | currency:'ARS':'symbol':'1.0-0' }}</strong> }</div>
        @if (loading) {
          <div class="empty turn-empty">Buscando horarios...</div>
        } @else if (availabilityLoadFailed) {
          <div class="empty turn-empty"><strong>No pudimos cargar los horarios.</strong><span>{{ message }}</span></div>
        } @else if (!availableSlots.length) {
          <div class="empty turn-empty"><strong>{{ emptyTitle }}</strong><span>{{ emptyHint }}</span></div>
        } @else {
          <div class="start-time-grid">
            @for (slot of availableSlots; track slot.startTime) {
              <button type="button" [class.selected]="selectedSlot === slot" (click)="openConfirmation(slot)"><span>INICIO</span><b>{{ slot.startTime }}</b><small>hasta {{ slot.endTime }}</small></button>
            }
          </div>
        }
        @if (message && !availabilityLoadFailed) { <p class="notice" [class.error-notice]="messageIsError">{{ message }}</p> }
      </div>
    </section>

    @if (selectedSlot) {
      <div class="modal-backdrop" (click)="closeModal()">
        <section class="booking-modal" [class.guest-booking-modal]="!auth.user()" role="dialog" aria-modal="true" aria-labelledby="confirm-title" (click)="$event.stopPropagation()">
          @if (!confirmedBooking) {
            <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeModal()">×</button>

            @if (!auth.user()) {
              <span class="eyebrow">ÚLTIMO PASO</span>
              <h2 id="confirm-title">Ya casi tenés tu turno</h2>
              <p>Para confirmar desde la web, ingresá o creá tu cuenta. Si preferís hacerlo como siempre, también podés pedirlo por WhatsApp.</p>

              <div class="booking-summary guest-booking-summary">
                <div><span>Día</span><strong>{{ formattedDate }}</strong></div>
                <div><span>Horario</span><strong>{{ selectedSlot.startTime }} — {{ selectedSlot.endTime }}</strong></div>
                <div><span>Duración</span><strong>{{ durationLabel(duration) }}</strong></div>
                <div><span>Precio</span><strong>{{ result?.price | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
              </div>

              <div class="guest-auth-actions">
                <button type="button" class="btn primary" (click)="continueWithAuth('/ingresar')">Ingresar y reservar</button>
                <button type="button" class="btn guest-register" (click)="continueWithAuth('/registro')">Crear cuenta y reservar</button>
              </div>

              @if (!whatsappOpened) {
                <div class="guest-divider"><span>O pedilo por WhatsApp</span></div>
                <div class="guest-name-fields">
                  <label>Nombre<input [(ngModel)]="guestFirstName" autocomplete="given-name" placeholder="Tu nombre"></label>
                  <label>Apellido<input [(ngModel)]="guestLastName" autocomplete="family-name" placeholder="Tu apellido"></label>
                </div>
                @if (modalError) { <p class="notice error-notice">{{ modalError }}</p> }
                <button type="button" class="btn guest-whatsapp full" (click)="reserveByWhatsapp()">Reservar por WhatsApp <span>↗</span></button>
                <p class="guest-confirmation-note">El turno por WhatsApp queda sujeto a confirmación del club.</p>
                <button type="button" class="link cancel-modal" (click)="closeModal()">Elegir otro horario</button>
              } @else {
                <div class="whatsapp-opened">
                  <span class="success-check">✓</span>
                  <h3>Te abrimos WhatsApp</h3>
                  <p>El mensaje ya tiene los datos del turno. El horario no queda reservado hasta que el club lo confirme.</p>
                  <button type="button" class="btn guest-register full" (click)="closeModal()">Volver a horarios</button>
                  <button type="button" class="link cancel-modal" (click)="continueWithAuth('/registro')">Crear cuenta para reservar online</button>
                </div>
              }
            } @else {
              <span class="eyebrow">ÚLTIMO PASO</span><h2 id="confirm-title">Confirmá tu turno</h2><p>Revisá los datos antes de guardar la reserva.</p>
              <div class="booking-summary">
                <div><span>Fecha</span><strong>{{ formattedDate }}</strong></div>
                <div><span>Horario</span><strong>{{ selectedSlot.startTime }} — {{ selectedSlot.endTime }}</strong></div>
                <div><span>Duración</span><strong>{{ durationLabel(duration) }}</strong></div>
                <div><span>Jugadores</span><strong>{{ players }}</strong></div>
                <div><span>Precio total</span><strong>{{ result?.price | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
              </div>
              <div class="modal-fields">
                <label>Cantidad de jugadores<input type="number" min="1" max="12" [(ngModel)]="players"></label>
                <label>Nota para la cancha <small>(opcional)</small><textarea maxlength="1000" [(ngModel)]="notes" placeholder="Ej. llegamos cinco minutos antes"></textarea></label>
              </div>
              @if (modalError) { <p class="notice error-notice">{{ modalError }}</p> }
              <button type="button" class="btn primary full confirm-booking" [disabled]="submitting" (click)="confirmBooking()">{{ submitting ? 'Reservando...' : 'Confirmar reserva' }}</button>
              <button type="button" class="link cancel-modal" [disabled]="submitting" (click)="closeModal()">Elegir otro horario</button>
            }
          } @else {
            <div class="booking-success">
              @if (confirmedBooking.requiresWhatsappConfirmation) {
                <span class="eyebrow">CONFIRMACIÓN PENDIENTE</span>
                <h2>Confirmá tu primer turno por WhatsApp</h2>
                <p>Para evitar reservas falsas, necesitamos confirmar tu identidad una sola vez. Tocá el botón de WhatsApp y envianos el mensaje ya armado. Cuando lo aprobemos, tu cuenta quedará verificada.</p>
                <div class="booking-summary">
                  <div><span>Día</span><strong>{{ formattedDate }}</strong></div>
                  <div><span>Horario</span><strong>{{ selectedSlot.startTime }} - {{ selectedSlot.endTime }}</strong></div>
                  <div><span>Duración</span><strong>{{ durationLabel(duration) }}</strong></div>
                  <div><span>Estado</span><strong>Pendiente de confirmación</strong></div>
                </div>
                @if (confirmedBooking.whatsappUrl) {
                  @if (!whatsappOpened) {
                    <button type="button" class="btn primary full" (click)="openPendingWhatsapp()">Enviar WhatsApp</button>
                    <p class="guest-confirmation-note">El turno queda pendiente hasta que la cancha lo confirme.</p>
                  } @else {
                    <div class="whatsapp-opened">
                      <span class="success-check">✓</span>
                      <h3>WhatsApp abierto</h3>
                      <p>Si ya enviaste el mensaje, podés cerrar este paso. Tu turno quedó pendiente hasta que la cancha lo confirme.</p>
                      <button type="button" class="btn primary full" (click)="finishPendingWhatsapp()">Ya envié el WhatsApp</button>
                      <button type="button" class="btn guest-register full" (click)="openPendingWhatsapp()">Enviar WhatsApp de nuevo</button>
                    </div>
                  }
                }
                @else { <p class="notice error-notice">La reserva quedó pendiente, pero falta configurar el WhatsApp de la cancha.</p> }
                <a class="btn ghost full" routerLink="/mis-turnos">Ver mis turnos</a>
                <button type="button" class="link cancel-modal" (click)="closeModal()">Cerrar</button>
              } @else {
                <span class="success-check">✓</span><span class="eyebrow">RESERVA CONFIRMADA</span><h2>La cancha es tuya.</h2><p>Turno confirmado para las {{ selectedSlot.startTime }}.</p><div class="success-location"><small>DÓNDE JUGAMOS</small><strong>{{ venue.address }}</strong><a [href]="venue.mapsUrl" target="_blank" rel="noopener noreferrer">Cómo llegar</a></div><a class="btn primary full" routerLink="/mis-turnos">Ver mis turnos</a><button type="button" class="link cancel-modal" (click)="closeModal()">Cerrar</button>
              }
            </div>
          }
        </section>
      </div>
    }
  `
})
export class AvailabilityPage implements OnInit {
  private api = inject(Api);
  public auth = inject(Auth);
  private router = inject(Router);
  private readonly pendingKey = 'pendingBooking';

  venue = VENUE;
  prices: Price[] = [];
  result: Availability | null = null;
  courtId = 1;
  duration = 90;
  players = 4;
  notes = '';
  guestFirstName = '';
  guestLastName = '';
  today = new Date().toISOString().slice(0, 10);
  date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  selectedSlot: Slot | null = null;
  confirmedBooking: any = null;
  loading = false;
  submitting = false;
  message = '';
  messageIsError = true;
  availabilityLoadFailed = false;
  modalError = '';
  whatsappOpened = false;
  private pendingBooking: PendingBooking | null = null;

  get availableSlots() {
    return this.result?.slots.filter(slot => slot.available) ?? [];
  }

  get emptyTitle() {
    if (this.result?.reason === 'CLOSED') return 'La cancha está cerrada ese día.';
    if (this.result?.reason === 'NO_PRICE') return 'No hay precio activo para esta duración.';
    if (this.result?.reason === 'NO_BUSINESS_HOURS') return 'Faltan configurar horarios para ese día.';
    return 'No hay turnos disponibles para este día.';
  }

  get emptyHint() {
    return this.result?.message ?? 'Probá con otra fecha o duración.';
  }

  get formattedDate() {
    const value = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
    }).format(new Date(`${this.date}T12:00:00Z`));
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  ngOnInit() {
    this.restorePendingBooking();
    this.api.get<Price[]>('/prices').subscribe({
      next: prices => {
        this.prices = prices;
        if (!prices.length) {
          this.message = 'No hay precios activos configurados.';
          this.messageIsError = true;
          this.availabilityLoadFailed = true;
          return;
        }
        if (!prices.some(price => price.durationMinutes === this.duration)) {
          this.duration = prices[0]?.durationMinutes ?? 60;
        }
        this.search();
      },
      error: error => {
        this.message = error.error?.message ?? 'No pudimos cargar las duraciones disponibles.';
        this.messageIsError = true;
        this.availabilityLoadFailed = true;
      }
    });
  }

  selectDuration(duration: number) {
    this.duration = duration;
    this.pendingBooking = null;
    this.search();
  }

  search() {
    if (!this.date || !this.courtId || !this.duration) return;
    this.loading = true;
    this.message = '';
    this.availabilityLoadFailed = false;
    this.result = null;
    this.selectedSlot = null;
    this.api.get<Availability>('/availability', {
      date: this.date, duration: this.duration, courtId: this.courtId
    }).subscribe({
      next: result => {
        this.result = result;
        this.loading = false;
        this.resumePendingConfirmation();
      },
      error: error => {
        this.message = error.error?.message ?? 'No pudimos consultar los horarios.';
        this.messageIsError = true;
        this.availabilityLoadFailed = true;
        this.loading = false;
      }
    });
  }

  openConfirmation(slot: Slot) {
    this.selectedSlot = slot;
    this.confirmedBooking = null;
    this.modalError = '';
    this.players = 4;
    this.notes = '';
    this.guestFirstName = '';
    this.guestLastName = '';
    this.whatsappOpened = false;
  }

  closeModal() {
    if (this.submitting) return;
    const refresh = !!this.confirmedBooking;
    this.selectedSlot = null;
    this.confirmedBooking = null;
    this.modalError = '';
    this.whatsappOpened = false;
    if (refresh) this.search();
  }

  continueWithAuth(path: '/ingresar' | '/registro') {
    if (!this.selectedSlot) return;
    const pending: PendingBooking = {
      date: this.date,
      duration: this.duration,
      startTime: this.selectedSlot.startTime
    };
    sessionStorage.setItem(this.pendingKey, JSON.stringify(pending));
    this.router.navigate([path], { queryParams: { returnUrl: '/reservar?resume=1' } });
  }

  reserveByWhatsapp() {
    if (!this.selectedSlot || !this.result) return;
    const firstName = this.guestFirstName.trim();
    const lastName = this.guestLastName.trim();
    if (!firstName || !lastName) {
      this.modalError = 'Ingresá tu nombre y apellido para continuar por WhatsApp.';
      return;
    }
    this.modalError = '';
    const price = new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0
    }).format(this.result.price ?? 0);
    const url = buildWhatsappBookingUrl(VENUE.whatsapp, {
      firstName, lastName, formattedDate: this.formattedDate,
      startTime: this.selectedSlot.startTime, endTime: this.selectedSlot.endTime,
      durationLabel: this.durationLabel(this.duration), formattedPrice: price
    });
    window.open(url, '_blank', 'noopener,noreferrer');
    this.whatsappOpened = true;
  }

  openPendingWhatsapp() {
    const url = this.confirmedBooking?.whatsappUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    this.whatsappOpened = true;
  }

  finishPendingWhatsapp() {
    this.closeModal();
    this.router.navigate(['/mis-turnos']);
  }

  confirmBooking() {
    if (!this.auth.user() || !this.selectedSlot || this.submitting) return;
    if (!Number.isInteger(this.players) || this.players < 1 || this.players > 12) {
      this.modalError = 'La cantidad de jugadores debe estar entre 1 y 12.';
      return;
    }
    this.submitting = true;
    this.modalError = '';
    this.api.post('/bookings', {
      courtId: this.courtId,
      date: this.date,
      startTime: this.selectedSlot.startTime,
      durationMinutes: this.duration,
      playersCount: this.players,
      notes: this.notes.trim() || undefined
    }).subscribe({
      next: (booking: any) => {
        this.confirmedBooking = booking;
        this.submitting = false;
        sessionStorage.removeItem(this.pendingKey);
      },
      error: error => {
        this.modalError = error.error?.message ?? 'No se pudo reservar el turno.';
        this.submitting = false;
      }
    });
  }

  durationLabel(minutes: number) {
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    return `${hours ? `${hours}h` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest}m` : ''}`;
  }

  private restorePendingBooking() {
    if (!this.auth.user()) return;
    try {
      const value = sessionStorage.getItem(this.pendingKey);
      if (!value) return;
      const pending = JSON.parse(value) as PendingBooking;
      if (!pending.date || !pending.duration || !pending.startTime) return;
      this.pendingBooking = pending;
      this.date = pending.date;
      this.duration = pending.duration;
    } catch {
      sessionStorage.removeItem(this.pendingKey);
    }
  }

  private resumePendingConfirmation() {
    if (!this.pendingBooking || !this.auth.user()) return;
    const slot = this.availableSlots.find(item => item.startTime === this.pendingBooking!.startTime);
    sessionStorage.removeItem(this.pendingKey);
    this.pendingBooking = null;
    this.router.navigate(['/reservar'], { replaceUrl: true });
    if (slot) {
      this.openConfirmation(slot);
    } else {
      this.message = 'Ese horario ya no está disponible. Elegí otro turno.';
    }
  }
}
