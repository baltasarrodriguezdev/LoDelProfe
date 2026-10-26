import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api, Auth } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="recovery">
      <section class="recovery-copy"><span class="eyebrow">LO DEL PROFE · TU CUENTA</span><h1>{{ legacy && !codeSent ? 'Un dato más y seguimos.' : 'Revisá tu correo.' }}</h1><p>{{ legacy && !codeSent ? 'Agregá tu email para ingresar con él y tu contraseña de siempre. Conservás tus turnos y tu teléfono habilitado.' : 'Ingresá el código de 6 dígitos que te enviamos para confirmar tu email.' }}</p></section>
      <section class="recovery-form"><div class="recovery-card">
        @if (initializing()) { <p>Preparando tu cuenta...</p> }
        @if (success) { <p class="recovery-success" role="status">{{ success }}</p> }
        @if (error) { <p class="recovery-error" role="alert">{{ error }}</p> }
        @if (initializing()) { }
        @else if (confirmed) { <a class="btn primary full" [routerLink]="auth.user() ? '/reservar' : '/ingresar'">{{ auth.user() ? 'Continuar' : 'Ir a ingresar' }}</a> }
        @else if (auth.user() && !codeSent) {
          <form (ngSubmit)="requestCode()">
            <h2>{{ legacy ? 'Agregá tu email' : 'Confirmá tu cuenta' }}</h2>
            <label>Email<input type="email" required autocomplete="email" name="email" [(ngModel)]="email"></label>
            @if (legacy) { <label>Tu contraseña actual<input type="password" required autocomplete="current-password" name="password" [(ngModel)]="password"></label> }
            <button class="btn primary full" type="submit" [disabled]="loading()">{{ loading() ? 'Enviando...' : 'Enviar código' }}</button>
          </form>
        } @else if (auth.user()) {
          <form (ngSubmit)="confirmCode()">
            <h2>Confirmá tu email</h2>
            <p>Ingresá el código de <strong>{{ email }}</strong>. Vence en 10 minutos. Si recibiste un enlace anterior, pedí un código nuevo.</p>
            <label>Código de 6 dígitos<input type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required name="code" [(ngModel)]="code" placeholder="000000"></label>
            <button class="btn primary full" type="submit" [disabled]="loading()">{{ loading() ? 'Comprobando...' : 'Confirmar email' }}</button>
          </form>
          <button class="recovery-back" type="button" [disabled]="loading()" (click)="requestCode()">Reenviar código</button>
          <button class="recovery-back" type="button" [disabled]="loading()" (click)="editEmail()">Corregir email</button>
        } @else { <a class="btn primary full" routerLink="/ingresar">Ir a ingresar</a> }
      </div></section>
    </main>
  `
})
export class EmailOnboardingPage implements OnInit {
  readonly auth = inject(Auth);
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly loading = signal(false);
  legacy = this.router.url.includes('completar-email');
  email = this.auth.user()?.email ?? '';
  codeSent = Boolean(this.email);
  code = '';
  password = '';
  success = '';
  error = '';
  confirmed = false;
  readonly initializing = signal(true);

  async ngOnInit() {
    await this.auth.refreshSession();
    if (!this.email && this.auth.user()?.email) {
      this.email = this.auth.user()!.email!;
      this.codeSent = true;
    }
    this.initializing.set(false);
    const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('token');
    if (!token) return;
    history.replaceState({}, document.title, location.pathname + location.search);
    this.loading.set(true);
    this.api.post<any>('/auth/email-verification/confirm', { token }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => void this.finishConfirmation(),
      error: response => this.error = response.error?.message ?? 'El enlace no es válido. Pedí uno nuevo.'
    });
  }

  requestCode() {
    if (this.loading()) return;
    this.error = ''; this.success = '';
    this.loading.set(true);
    this.api.post<any>('/auth/email-verification/request', { email: this.email, password: this.legacy ? this.password : undefined }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: async response => {
        this.success = response.message;
        this.codeSent = true;
        this.code = '';
        await this.auth.refreshSession(true);
      },
      error: response => this.error = response.error?.message ?? 'No pudimos enviar el correo.'
    });
  }

  confirmCode() {
    if (this.loading()) return;
    this.error = ''; this.success = '';
    if (!/^\d{6}$/.test(this.code)) { this.error = 'Ingresá los 6 dígitos del código.'; return; }
    this.loading.set(true);
    this.api.post<any>('/auth/email-verification/confirm', { email: this.email, code: this.code }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: () => void this.finishConfirmation(),
      error: response => this.error = response.error?.message ?? 'El código no es válido. Pedí uno nuevo.'
    });
  }

  editEmail() { this.codeSent = false; this.code = ''; this.password = ''; this.error = ''; this.success = ''; }

  private async finishConfirmation() {
    this.confirmed = true;
    this.success = 'Email confirmado. Ya podés continuar.';
    await this.auth.refreshSession(true);
    if (this.auth.user()) {
      const requested = this.route.snapshot.queryParamMap.get('returnUrl');
      const safe = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/reservar';
      void this.router.navigateByUrl(this.auth.isAdmin() ? '/admin' : safe);
    }
  }
}
