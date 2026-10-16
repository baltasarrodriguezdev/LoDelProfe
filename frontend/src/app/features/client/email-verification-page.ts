import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <main class="verification-page">
      <section class="verification-card email-verification-card">
        <span class="eyebrow">CUENTA SEGURA</span>
        @if (confirmed) {
          <h1>Email confirmado.</h1><p class="notice">{{ message }}</p><a class="btn primary" routerLink="/ingresar">Ingresar</a>
        } @else if (token) {
          <h1>Confirmá tu email.</h1>
          <p>El enlace no se consume al abrir esta página. Confirmalo con el botón para terminar.</p>
          @if (error) { <p class="verification-error">{{ error }}</p> }
          <button class="btn primary" type="button" [disabled]="loading()" (click)="confirm()">{{ loading() ? 'Confirmando...' : 'Confirmar mi email' }}</button>
        } @else {
          <h1>Revisá tu correo.</h1>
          <p>Enviamos un enlace de un solo uso a <strong>{{ maskedEmail }}</strong>. Vence en 30 minutos.</p>
          <label>Email<input type="email" autocomplete="email" [(ngModel)]="email" name="email"></label>
          @if (message) { <p class="notice">{{ message }}</p> }
          @if (error) { <p class="verification-error">{{ error }}</p> }
          <div class="actions"><button class="btn ghost" type="button" [disabled]="loading()" (click)="resend()">Reenviar email</button><a class="btn ghost" routerLink="/actualizar-acceso">Corregir email</a><a class="btn primary" routerLink="/ingresar">Volver a ingresar</a></div>
        }
      </section>
    </main>
  `
})
export class EmailVerificationPage implements OnInit {
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  readonly loading = signal(false);
  token = ''; email = ''; message = ''; error = ''; confirmed = false;
  get maskedEmail() {
    const [local, domain] = this.email.split('@');
    return local && domain ? `${local.slice(0, 2)}${'•'.repeat(Math.max(2, local.length - 2))}@${domain}` : 'tu email';
  }
  ngOnInit() {
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
    this.token = fragment.get('token') ?? '';
    if (this.token) history.replaceState({}, document.title, location.pathname);
  }
  confirm() {
    if (this.loading()) return;
    this.loading.set(true); this.error = '';
    this.api.post<any>('/auth/email-verification/confirm', { token: this.token }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: response => { this.confirmed = true; this.message = response.message; this.token = ''; },
      error: response => this.error = response.error?.message ?? 'No pudimos confirmar el email.'
    });
  }
  resend() {
    if (this.loading() || !this.email.trim()) { this.error = 'Ingresá tu email.'; return; }
    this.loading.set(true); this.error = ''; this.message = '';
    this.api.post<any>('/auth/email-verification/resend', { email: this.email }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: response => this.message = response.message,
      error: response => this.error = response.error?.message ?? 'No pudimos reenviar el email.'
    });
  }
}
