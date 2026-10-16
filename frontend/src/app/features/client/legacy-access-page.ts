import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="recovery legacy-access-page">
      <section class="recovery-copy"><span class="eyebrow">CLIENTES EXISTENTES</span><h1>Conservá tu cuenta de siempre.</h1><p>Usá una vez tu teléfono y contraseña anteriores. Vamos a sumar el email sin cambiar tu historial, reservas ni permisos.</p></section>
      <section class="recovery-form"><form class="recovery-card" (ngSubmit)="submit()">
        <span class="eyebrow">ACTUALIZAR ACCESO</span><h2>Vinculá tu email</h2>
        @if (success) { <p class="recovery-success">{{ success }}</p><a class="btn primary full" [routerLink]="['/revisar-email']" [queryParams]="{email}">Revisar mi email</a> }
        @else {
          <label>Teléfono anterior<input inputmode="numeric" autocomplete="tel-national" name="phone" required [(ngModel)]="phone"></label>
          <label>Contraseña actual<input type="password" autocomplete="current-password" name="password" required [(ngModel)]="password"></label>
          <label>Email<input type="email" autocomplete="email" name="email" required [(ngModel)]="email"></label>
          @if (error) { <p class="recovery-error">{{ error }}</p> }
          <button class="btn primary full" type="submit" [disabled]="loading()">{{ loading() ? 'Verificando...' : 'Actualizar mi acceso' }}</button>
          <a class="recovery-back" routerLink="/ingresar">Volver a ingresar</a>
        }
      </form></section>
    </main>
  `
})
export class LegacyAccessPage {
  private api = inject(Api);
  readonly loading = signal(false);
  phone = ''; password = ''; email = ''; error = ''; success = '';
  submit() {
    if (this.loading()) return;
    if (!this.phone.trim() || !this.password || !this.email.trim()) { this.error = 'Completá los tres datos.'; return; }
    this.loading.set(true); this.error = '';
    this.api.post<any>('/auth/legacy-access', { phone: this.phone, password: this.password, email: this.email }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: response => this.success = response.message,
      error: response => this.error = response.error?.message ?? 'No pudimos actualizar el acceso.'
    });
  }
}
