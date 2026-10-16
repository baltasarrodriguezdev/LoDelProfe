import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="recovery">
      <section class="recovery-copy"><span class="eyebrow">CUENTA SEGURA</span><h1>{{ token ? 'Elegí una clave nueva.' : 'Volvé a entrar.' }}</h1><p>{{ token ? 'Este enlace personal funciona una sola vez.' : 'Si la cuenta existe, vas a recibir un enlace seguro por email.' }}</p></section>
      <section class="recovery-form"><form class="recovery-card" (ngSubmit)="submit()">
        @if (success) { <h2>Listo.</h2><p class="recovery-success">{{ success }}</p><a class="btn primary full" routerLink="/ingresar">Ir a ingresar</a> }
        @else if (token) {
          <span class="eyebrow">RESTABLECER CONTRASEÑA</span><h2>Nueva contraseña</h2>
          <label>Contraseña<input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="72" required [(ngModel)]="password"><small>Mínimo 8 caracteres.</small></label>
          <label>Repetir contraseña<input type="password" name="confirmation" autocomplete="new-password" required [(ngModel)]="confirmation"></label>
          @if (error) { <p class="recovery-error">{{ error }}</p> }<button class="btn primary full" type="submit" [disabled]="loading()">{{ loading() ? 'Guardando...' : 'Guardar contraseña' }}</button>
        } @else {
          <span class="eyebrow">RECUPERAR ACCESO</span><h2>¿Olvidaste tu contraseña?</h2><p>Ingresá el email de tu cuenta.</p>
          <label>Email<input type="email" inputmode="email" autocomplete="email" name="email" required [(ngModel)]="email" placeholder="nombre@ejemplo.com"></label>
          @if (error) { <p class="recovery-error">{{ error }}</p> }<button class="btn primary full" type="submit" [disabled]="loading()">{{ loading() ? 'Enviando...' : 'Enviar enlace' }}</button>
          <a class="recovery-back" routerLink="/ingresar">Volver a ingresar</a>
        }
      </form></section>
    </main>
  `
})
export class PasswordRecoveryPage implements OnInit {
  private api = inject(Api);
  readonly loading = signal(false);
  token = ''; email = ''; password = ''; confirmation = ''; error = ''; success = '';

  ngOnInit() {
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
    this.token = fragment.get('token') ?? '';
    if (this.token) history.replaceState({}, document.title, location.pathname);
  }

  submit() {
    if (this.loading()) return;
    this.error = '';
    if (this.token && (this.password.length < 8 || this.password.length > 72)) { this.error = 'La contraseña debe tener entre 8 y 72 caracteres.'; return; }
    if (this.token && this.password !== this.confirmation) { this.error = 'Las contraseñas no coinciden.'; return; }
    if (!this.token && !this.email.trim()) { this.error = 'Ingresá tu email.'; return; }
    this.loading.set(true);
    const request = this.token
      ? this.api.post<any>('/auth/password-reset', { token: this.token, password: this.password })
      : this.api.post<any>('/auth/password-reset-requests', { email: this.email });
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: response => this.success = response.message,
      error: response => this.error = response.error?.message ?? 'No pudimos completar la solicitud.'
    });
  }
}
