import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, Auth } from '../../core/api';
import { VENUE } from '../../shared/venue';
import { buildPhoneVerificationWhatsappUrl } from '../../shared/whatsapp-booking';

type Price = { id: number; durationMinutes: number; price: number };
type Slot = { startTime: string; endTime: string; available: boolean };
type Availability = { date: string; durationMinutes: number; price: number | null; reason?: string; message?: string; slots: Slot[] };
type PendingBooking = { date: string; startTime: string; endTime: string; duration: number; price: number | null; players: number };
type ModalState = 'confirm' | 'reservationConfirmed' | 'verificationPending';

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
        <section class="booking-modal reservation-confirm-modal unified-booking-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" (click)="$event.stopPropagation()">
          <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeModal()">×</button>

          @if (modalState === 'confirm') {
            <div class="booking-modal-header">
              <span class="eyebrow">ÚLTIMO PASO</span>
              <h2 id="confirm-title">{{ modalTitle }}</h2>
              <p>{{ modalText }}</p>
            </div>

            <div class="booking-summary">
              <div><span>Día</span><strong>{{ formattedDate }}</strong></div>
              <div><span>Horario</span><strong>{{ selectedSlot.startTime }} — {{ selectedSlot.endTime }}</strong></div>
              <div><span>Duración</span><strong>{{ durationLabel(duration) }}</strong></div>
              @if (auth.user()) { <div><span>Jugadores</span><strong>{{ players }}</strong></div> }
              <div><span>Precio total</span><strong>{{ selectedPrice | currency:'ARS':'symbol':'1.0-0' }}</strong></div>
            </div>

            @if (!auth.user()) {
              <div class="guest-auth-actions unified-auth-actions">
                <button type="button" class="btn primary" (click)="continueWithAuth('/ingresar')">Ingresar y continuar</button>
                <button type="button" class="btn guest-register" (click)="continueWithAuth('/registro')">Crear cuenta y continuar</button>
              </div>
              <button type="button" class="link cancel-modal" (click)="closeModal()">Elegir otro horario</button>
            } @else {
              <div class="modal-fields">
                <label>Cantidad de jugadores<input type="number" min="1" max="12" [(ngModel)]="players"></label>
                <label>Nota para la cancha <small>(opcional)</small><textarea maxlength="1000" [(ngModel)]="notes" placeholder="Ej. llegamos cinco minutos antes"></textarea></label>
              </div>
              @if (modalError) { <p class="notice error-notice modal-alert">{{ modalError }}</p> }
              <div class="booking-modal-footer">
                <button type="button" class="link cancel-modal" [disabled]="submitting" (click)="closeModal()">Elegir otro horario</button>
                @if (isPhoneVerified()) {
                  <button type="button" class="btn primary confirm-booking" [disabled]="submitting" (click)="confirmBooking()">{{ submitting ? 'Reservando...' : 'Confirmar reserva' }}</button>
                } @else {
                  <button type="button" class="btn primary confirm-booking" [disabled]="submitting" (click)="sendVerificationRequest()">{{ submitting ? 'Enviando...' : 'Enviar solicitud por WhatsApp' }}</button>
                }
              </div>
            }
          } @else if (modalState === 'reservationConfirmed') {
            <div class="booking-success unified-success">
              <span class="success-check">✓</span>
              <span class="eyebrow">RESERVA CONFIRMADA</span>
              <h2 id="confirm-title">¡Turno reservado!</h2>
              <p>Tu reserva quedó confirmada correctamente. Podés verla desde Mis turnos.</p>
              <div class="success-actions">
                <a class="btn primary" routerLink="/mis-turnos">Ver mis turnos</a>
                <a class="btn ghost" routerLink="/">Volver al inicio</a>
              </div>
            </div>
          } @else {
            <div class="booking-success unified-success">
              <span class="success-check">✓</span>
              <span class="eyebrow">SOLICITUD PENDIENTE</span>
              <h2 id="confirm-title">Tu solicitud quedó pendiente</h2>
              <p>Te abrimos WhatsApp para validar tu número y solicitar tu primer turno. Cuando la cancha revise el mensaje, confirmará tu cuenta y tu reserva.</p>
              <div class="booking-summary pending-summary">
                <div><span>Día</span><strong>{{ formattedDate }}</strong></div>
                <div><span>Horario</span><strong>{{ selectedSlot.startTime }} — {{ selectedSlot.endTime }}</strong></div>
                <div><span>Duración</span><strong>{{ durationLabel(duration) }}</strong></div>
                <div><span>Estado</span><strong class="pending-chip">Pendiente de confirmación</strong></div>
              </div>
              <button type="button" class="btn primary full" (click)="closeModal()">Entendido</button>
              <button type="button" class="link cancel-modal resend-whatsapp" (click)="openWhatsappAgain()">Abrir WhatsApp nuevamente</button>
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
  today = new Date().toISOString().slice(0, 10);
  date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  selectedSlot: Slot | null = null;
  modalState: ModalState = 'confirm';
  loading = false;
  submitting = false;
  message = '';
  messageIsError = true;
  availabilityLoadFailed = false;
  modalError = '';
  private pendingBooking: PendingBooking | null = null;
  private lastWhatsappUrl = '';

  get availableSlots() { return this.result?.slots.filter(slot => slot.available) ?? []; }
  get selectedPrice() { return this.pendingBooking?.price ?? this.result?.price ?? null; }

  get modalTitle() {
    if (!this.auth.user()) return 'Reservá tu turno';
    if (!this.isPhoneVerified()) return 'Validá tu cuenta y solicitá tu primer turno';
    return 'Confirmá tu turno';
  }

  get modalText() {
    if (!this.auth.user()) return 'Para reservar desde la web, ingresá o creá tu cuenta.';
    if (!this.isPhoneVerified()) return 'Para validar tu número, te vamos a abrir WhatsApp con los datos de tu cuenta y del turno. La reserva quedará pendiente hasta que la cancha la confirme.';
    return 'Revisá los datos antes de guardar la reserva.';
  }

  get emptyTitle() {
    if (this.result?.reason === 'CLOSED') return 'La cancha está cerrada ese día.';
    if (this.result?.reason === 'NO_PRICE') return 'No hay precio activo para esta duración.';
    if (this.result?.reason === 'NO_BUSINESS_HOURS') return 'Faltan configurar horarios para ese día.';
    return 'No hay turnos disponibles para este día.';
  }

  get emptyHint() { return this.result?.message ?? 'Probá con otra fecha o duración.'; }

  get formattedDate() {
    const value = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${this.date}T12:00:00Z`));
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
        if (!prices.some(price => price.durationMinutes === this.duration)) this.duration = prices[0]?.durationMinutes ?? 60;
        this.search();
      },
      error: error => {
        this.message = error.error?.message ?? 'No pudimos cargar las duraciones disponibles.';
        this.messageIsError = true;
        this.availabilityLoadFailed = true;
      }
    });
  }

  isPhoneVerified() { return this.auth.user()?.phoneVerified === true || this.auth.user()?.status === 'VERIFIED'; }

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
    this.api.get<Availability>('/availability', { date: this.date, duration: this.duration, courtId: this.courtId }).subscribe({
      next: result => { this.result = result; this.loading = false; this.resumePendingConfirmation(); },
      error: error => {
        this.message = error.error?.message ?? 'No pudimos consultar los horarios.';
        this.messageIsError = true;
        this.availabilityLoadFailed = true;
        this.loading = false;
      }
    });
  }

  openConfirmation(slot: Slot, pending?: PendingBooking) {
    this.selectedSlot = slot;
    this.pendingBooking = pending ?? null;
    this.modalState = 'confirm';
    this.modalError = '';
    this.players = pending?.players ?? 4;
    this.notes = '';
    this.lastWhatsappUrl = '';
  }

  closeModal() {
    if (this.submitting) return;
    const refresh = this.modalState === 'reservationConfirmed' || this.modalState === 'verificationPending';
    this.selectedSlot = null;
    this.modalState = 'confirm';
    this.modalError = '';
    this.lastWhatsappUrl = '';
    if (refresh) this.search();
  }

  continueWithAuth(path: '/ingresar' | '/registro') {
    if (!this.selectedSlot) return;
    const pending: PendingBooking = {
      date: this.date,
      startTime: this.selectedSlot.startTime,
      endTime: this.selectedSlot.endTime,
      duration: this.duration,
      price: this.result?.price ?? null,
      players: this.players
    };
    sessionStorage.setItem(this.pendingKey, JSON.stringify(pending));
    this.router.navigate([path], { queryParams: { returnUrl: '/reservar?resume=1' } });
  }

  sendVerificationRequest() {
    if (!this.auth.user() || !this.selectedSlot || !this.result || this.submitting) return;
    if (!Number.isInteger(this.players) || this.players < 1 || this.players > 12) {
      this.modalError = 'La cantidad de jugadores debe estar entre 1 y 12.';
      return;
    }
    const popup = window.open('', '_blank');
    if (!popup) {
      this.modalError = 'No pudimos abrir WhatsApp. Permití las ventanas emergentes e intentá nuevamente.';
      return;
    }
    this.submitting = true;
    this.modalError = '';
    this.api.post<any>('/bookings', this.bookingPayload()).subscribe({
      next: () => {
        const url = this.buildVerificationWhatsappUrl();
        this.lastWhatsappUrl = url;
        popup.location.href = url;
        this.modalState = 'verificationPending';
        this.submitting = false;
        sessionStorage.removeItem(this.pendingKey);
      },
      error: error => {
        popup.close();
        this.modalError = this.friendlyBookingError(error.error?.message);
        this.submitting = false;
      }
    });
  }

  openWhatsappAgain() {
    if (!this.lastWhatsappUrl) return;
    window.open(this.lastWhatsappUrl, '_blank');
  }

  confirmBooking() {
    if (!this.auth.user() || !this.selectedSlot || this.submitting) return;
    if (!Number.isInteger(this.players) || this.players < 1 || this.players > 12) {
      this.modalError = 'La cantidad de jugadores debe estar entre 1 y 12.';
      return;
    }
    this.submitting = true;
    this.modalError = '';
    this.api.post('/bookings', this.bookingPayload()).subscribe({
      next: () => {
        this.modalState = 'reservationConfirmed';
        this.submitting = false;
        sessionStorage.removeItem(this.pendingKey);
      },
      error: error => {
        this.modalError = this.friendlyBookingError(error.error?.message);
        this.submitting = false;
      }
    });
  }

  durationLabel(minutes: number) {
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    return `${hours ? `${hours}h` : ''}${hours && rest ? ' ' : ''}${rest ? `${rest}m` : ''}`;
  }

  private bookingPayload() {
    return {
      courtId: this.courtId,
      date: this.date,
      startTime: this.selectedSlot!.startTime,
      durationMinutes: this.duration,
      playersCount: this.players,
      notes: this.notes.trim() || undefined
    };
  }

  private buildVerificationWhatsappUrl() {
    const user = this.auth.user();
    const price = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(this.selectedPrice ?? 0);
    return buildPhoneVerificationWhatsappUrl(VENUE.whatsapp, {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      formattedDate: this.formattedDate,
      startTime: this.selectedSlot!.startTime,
      endTime: this.selectedSlot!.endTime,
      durationLabel: this.durationLabel(this.duration),
      playersCount: this.players,
      formattedPrice: price,
      registeredPhone: user?.phone ?? ''
    });
  }

  private friendlyBookingError(message?: string) {
    if (!message) return 'No pudimos confirmar la reserva.';
    const normalized = message.toLowerCase();
    if (normalized.includes('pendiente')) return message;
    if (normalized.includes('disponible') || normalized.includes('otro turno')) return 'Ese horario ya no está disponible.';
    if (normalized.includes('jugador')) return 'Revisá la cantidad de jugadores.';
    return 'No pudimos confirmar la reserva.';
  }

  private restorePendingBooking() {
    if (!this.auth.user()) return;
    try {
      const value = sessionStorage.getItem(this.pendingKey);
      if (!value) return;
      const pending = JSON.parse(value) as Partial<PendingBooking>;
      if (!pending.date || !pending.duration || !pending.startTime || !pending.endTime) {
        sessionStorage.removeItem(this.pendingKey);
        return;
      }
      this.pendingBooking = {
        date: pending.date,
        startTime: pending.startTime,
        endTime: pending.endTime,
        duration: pending.duration,
        price: pending.price ?? null,
        players: pending.players ?? 4
      };
      this.date = this.pendingBooking.date;
      this.duration = this.pendingBooking.duration;
      this.players = this.pendingBooking.players;
    } catch {
      sessionStorage.removeItem(this.pendingKey);
    }
  }

  private resumePendingConfirmation() {
    if (!this.pendingBooking || !this.auth.user()) return;
    const pending = this.pendingBooking;
    const slot = this.availableSlots.find(item => item.startTime === pending.startTime && item.endTime === pending.endTime);
    sessionStorage.removeItem(this.pendingKey);
    this.router.navigate(['/reservar'], { replaceUrl: true });
    if (slot) {
      this.openConfirmation(slot, pending);
    } else {
      this.pendingBooking = null;
      this.message = 'Ese horario ya no está disponible. Elegí otro turno.';
    }
  }
}