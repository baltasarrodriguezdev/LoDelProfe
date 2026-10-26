import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api, Auth } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="verification-page">
      <section class="verification-card">
        <span class="eyebrow">MI CUENTA</span>
        <h1>Tus datos.</h1>
        <p>Email: <strong>{{ auth.user()?.email }}</strong></p>
        <p>Teléfono: <strong>{{ auth.user()?.phone || 'Todavía no registrado' }}</strong></p>
        <p>{{ auth.user()?.bookingApprovedAt ? 'Tu cuenta puede reservar directamente.' : 'La cancha comprobará tu teléfono cuando solicites tu primer turno.' }}</p>
        <form (ngSubmit)="changePhone()" class="modal-form">
          <h2>Cambiar teléfono</h2>
          <p>Al cambiarlo, la cancha tendrá que comprobar el número nuevo antes de que puedas reservar otra vez. Tus turnos anteriores se conservan.</p>
          <label>Nuevo teléfono<input name="phone" required inputmode="tel" autocomplete="tel-national" [(ngModel)]="phone" placeholder="3515551234"></label>
          <label>Contraseña actual<input name="password" type="password" required autocomplete="current-password" [(ngModel)]="password"></label>
          @if (error) { <p class="error" role="alert">{{ error }}</p> }
          @if (success) { <p class="notice" role="status">{{ success }}</p> }
          <button type="submit" class="btn primary" [disabled]="loading()">{{ loading() ? 'Guardando...' : 'Guardar teléfono' }}</button>
        </form>
        <a class="btn ghost" routerLink="/reservar">Volver a reservar</a>
      </section>
    </main>
  `
})
export class AccountPage {
  readonly auth = inject(Auth);
  private api = inject(Api);
  readonly loading = signal(false);
  phone = '';
  password = '';
  error = '';
  success = '';

  changePhone() {
    if (this.loading()) return;
    this.error = ''; this.success = '';
    this.loading.set(true);
    this.api.patch<any>('/auth/phone', { phone: this.phone, password: this.password }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: async response => { this.success = response.message; this.password = ''; await this.auth.refreshSession(true); },
      error: response => this.error = response.error?.message ?? 'No pudimos actualizar el teléfono.'
    });
  }
}
