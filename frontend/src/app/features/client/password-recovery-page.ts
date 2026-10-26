import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, finalize, throwError } from 'rxjs';
import { Api } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="recovery">
      <section class="recovery-copy"><span class="eyebrow">CUENTA SEGURA</span><h1>{{ token ? 'Elegí una clave nueva.' : codeSent ? 'Revisá tu correo.' : 'Volvé a entrar.' }}</h1><p>{{ token ? 'Este enlace personal funciona una sola vez.' : codeSent ? 'Ingresá el código que enviamos a tu email para elegir una contraseña nueva.' : 'Te enviaremos un código al email confirmado de tu cuenta.' }}</p></section>
      <section class="recovery-form"><form class="recovery-card" (ngSubmit)="submit()">
        @if (done) { <h2>Listo.</h2><p class="recovery-success">{{ success }}</p><a class="btn primary full" routerLink="/ingresar">Ir a ingresar</a> }
        @else if (token) {
          <span class="eyebrow">RESTABLECER CONTRASEÑA</span><h2>Nueva contraseña</h2>
          <label>Contraseña<input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="72" required [(ngModel)]="password"><small>Mínimo 8 caracteres.</small></label>
          <label>Repetir contraseña<input type="password" name="confirmation" autocomplete="new-password" required [(ngModel)]="confirmation"></label>
          @if (error) { <p class="recovery-error">{{ error }}</p> }<button class="btn primary full" type="submit" [disabled]="loading()">{{ loading() ? 'Guardando...' : 'Guardar contraseña' }}</button>
        } @else if (codeSent && !legacy) {
          <h2>Ingresá el código</h2><p>Si <strong>{{ email }}</strong> corresponde a una cuenta, recibirás un código de 6 dígitos. Vence en 10 minutos.</p>
          <label>Código<input type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required name="code" [(ngModel)]="code" placeholder="000000"></label>
          <label>Contraseña nueva<input type="password" name="password" autocomplete="new-password" minlength="8" maxlength="72" required [(ngModel)]="password"><small>Mínimo 8 caracteres.</small></label>
          <label>Repetir contraseña<input type="password" name="confirmation" autocomplete="new-password" required [(ngModel)]="confirmation"></label>
          @if (success) { <p class="recovery-success" role="status">{{ success }}</p> }
          @if (error) { <p class="recovery-error" role="alert">{{ error }}</p> }
          <button class="btn primary full" type="submit" [disabled]="loading()">{{ loading() ? 'Guardando...' : 'Guardar contraseña' }}</button>
          <button type="button" class="recovery-back" [disabled]="loading()" (click)="resendCode()">Reenviar código</button>
          <button type="button" class="recovery-back" [disabled]="loading()" (click)="codeSent = false; code = ''; error = ''; success = ''">Corregir email</button>
        } @else {
          <span class="eyebrow">RECUPERAR ACCESO</span><h2>¿Olvidaste tu contraseña?</h2><p>{{ legacy ? 'Ingresá el mismo teléfono con el que creaste la cuenta.' : 'Ingresá el email confirmado de tu cuenta.' }}</p>
          @if (legacy) { <label>Teléfono de tu cuenta anterior<input inputmode="numeric" autocomplete="tel-national" name="phone" required [(ngModel)]="phone" placeholder="Ej: 3515551234"></label> }
          @else { <label>Email<input type="email" autocomplete="email" name="email" required [(ngModel)]="email" placeholder="tu@email.com"></label> }
          @if (error) { <p class="recovery-error">{{ error }}</p> }<button class="btn primary full" type="submit" [disabled]="loading()">{{ loading() ? 'Enviando...' : 'Solicitar recuperación' }}</button>
          @if (!legacy) { <button type="button" class="recovery-back" (click)="legacy = true">Todavía no agregué mi email</button> }
          <a class="recovery-back" routerLink="/ingresar">Volver a ingresar</a>
        }
      </form></section>
    </main>
  `
})
export class PasswordRecoveryPage implements OnInit {
  private api = inject(Api);
  readonly loading = signal(false);
  token = ''; phone = ''; email = ''; code = ''; password = ''; confirmation = ''; error = ''; success = ''; legacy = false; codeSent = false; done = false;

  ngOnInit() {
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
    this.token = fragment.get('token') ?? '';
    if (this.token) history.replaceState({}, document.title, location.pathname);
  }

  submit() {
    if (this.loading()) return;
    this.error = '';
    if ((this.token || this.codeSent) && (this.password.length < 8 || this.password.length > 72)) { this.error = 'La contraseña debe tener entre 8 y 72 caracteres.'; return; }
    if ((this.token || this.codeSent) && this.password !== this.confirmation) { this.error = 'Las contraseñas no coinciden.'; return; }
    if (this.codeSent && !/^\d{6}$/.test(this.code)) { this.error = 'Ingresá los 6 dígitos del código.'; return; }
    if (!this.token && !this.codeSent && !(this.legacy ? this.phone.trim() : this.email.trim())) { this.error = 'Ingresá el dato de tu cuenta.'; return; }
    this.loading.set(true);
    const request = this.token
      ? this.api.post<any>('/auth/email-password-reset/confirm', { token: this.token, password: this.password }).pipe(catchError(response => response.status === 400
        ? this.api.post<any>('/auth/password-reset', { token: this.token, password: this.password })
        : throwError(() => response)))
      : this.codeSent ? this.api.post<any>('/auth/email-password-reset/confirm', { email: this.email, code: this.code, password: this.password })
      : this.legacy ? this.api.post<any>('/auth/password-reset-requests', { phone: this.phone })
        : this.api.post<any>('/auth/email-password-reset/request', { email: this.email });
    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: response => {
        this.success = response.message;
        if (!this.token && !this.legacy && !this.codeSent) this.codeSent = true;
        else this.done = true;
      },
      error: response => this.error = response.error?.message ?? 'No pudimos completar la solicitud.'
    });
  }

  resendCode() {
    if (this.loading()) return;
    this.error = ''; this.success = '';
    this.loading.set(true);
    this.api.post<any>('/auth/email-password-reset/request', { email: this.email }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: response => { this.code = ''; this.success = response.message; },
      error: response => this.error = response.error?.message ?? 'No pudimos reenviar el código.'
    });
  }
}
