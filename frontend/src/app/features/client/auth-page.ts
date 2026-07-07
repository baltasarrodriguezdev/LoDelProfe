import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-wrap branded-auth">
      <div class="auth-side">
        <img class="auth-side__image" src="assets/logos/fotoIngresar.jpg" alt="Cancha de pádel Lo del Profe">
        <div class="auth-side__overlay" aria-hidden="true"></div>
        <div class="auth-side__copy">
          <span class="eyebrow">LO DEL PROFE</span>
          <h1>{{ registerMode ? 'Sumate a jugar.' : 'Volvé a la cancha.' }}</h1>
          <p>{{ registerMode ? 'Creá tu cuenta y reservá tu próximo partido.' : 'Reservá tu próximo turno en segundos.' }}</p>
        </div>
      </div>

      <div class="auth-form-side">
        <form class="panel auth-card" novalidate (ngSubmit)="submit()">
          <span class="eyebrow">LO DEL PROFE</span>
          <h2>{{ verificationStep ? 'Verificá tu teléfono' : registerMode ? 'Crear cuenta' : 'Ingresar' }}</h2>
          @if (authMessage) { <p class="auth-message">{{ authMessage }}</p> }
          @if (verificationStep) {
            <p>Enviamos un código por SMS a <strong>{{ form.phone }}</strong>.</p>
            <label>Código de verificación<input required inputmode="numeric" autocomplete="one-time-code" [(ngModel)]="verificationCode" name="verificationCode" placeholder="Código SMS">@if (fieldErrors.code) { <small class="field-error">{{ fieldErrors.code }}</small> }</label>
          } @else if (registerMode) {
            <div class="two">
              <label>Nombre<input required minlength="2" [(ngModel)]="form.firstName" name="firstName">@if (fieldErrors.firstName) { <small class="field-error">{{ fieldErrors.firstName }}</small> }</label>
              <label>Apellido<input required minlength="2" [(ngModel)]="form.lastName" name="lastName">@if (fieldErrors.lastName) { <small class="field-error">{{ fieldErrors.lastName }}</small> }</label>
            </div>
          }
          @if (!verificationStep) {
            <label>Teléfono<input required inputmode="tel" autocomplete="tel" [(ngModel)]="form.phone" name="phone" placeholder="Ej. +5493515551234"><small>Usá formato internacional: +54, código de área y número.</small>@if (fieldErrors.phone) { <small class="field-error">{{ fieldErrors.phone }}</small> }</label>
            <label>Contraseña<input required minlength="8" type="password" autocomplete="current-password" [(ngModel)]="form.password" name="password"><small>Mínimo 8 caracteres.</small>@if (fieldErrors.password) { <small class="field-error">{{ fieldErrors.password }}</small> }</label>
          }
          @if (error) { <p class="error">{{ error }}</p> }
          <button class="btn primary full" [disabled]="loading">{{ loading ? 'Procesando...' : verificationStep ? 'Verificar código' : registerMode ? 'Enviar código por SMS' : 'Ingresar' }}</button>
          @if (verificationStep) { <button type="button" class="btn ghost full" [disabled]="loading" (click)="resendCode()">Reenviar código</button> }
          <p class="switch">
            {{ registerMode ? '¿Ya tenés cuenta?' : '¿Todavía no tenés cuenta?' }}
            <a [routerLink]="registerMode ? '/ingresar' : '/registro'">{{ registerMode ? 'Ingresá' : 'Registrate' }}</a>
          </p>
        </form>
      </div>
    </section>
  `
})
export class AuthPage {
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  registerMode = this.router.url.includes('registro');
  authMessage = this.route.snapshot.queryParamMap.get('authRequired') === '1'
    ? 'Tenés que iniciar sesión para continuar.'
    : '';
  form: any = {};
  error = '';
  fieldErrors: { firstName?: string; lastName?: string; phone?: string; password?: string; code?: string } = {};
  loading = false;
  verificationStep = false;
  verificationCode = '';

  submit() {
    this.loading = true;
    this.error = '';
    this.fieldErrors = {};
    if (this.verificationStep) { this.verifyCode(); return; }
    if (!this.validateForm()) { this.loading = false; return; }
    const call = this.registerMode ? this.auth.register(this.form) : this.auth.login(this.form);
    call.subscribe({
      next: value => {
        if (this.registerMode) {
          this.verificationStep = true;
          this.loading = false;
          return;
        }
        const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const destination = ['ADMIN', 'SUPERADMIN'].includes(value.user.role)
          ? '/admin'
          : requestedUrl || '/reservar';
        this.router.navigateByUrl(destination);
      },
      error: error => {
        const fields = error.error?.errors as Record<string, string[] | undefined> | undefined;
        this.fieldErrors = Object.fromEntries(Object.entries(fields ?? {}).map(([field, messages]) => [field, messages?.[0] ?? 'Dato inválido'])) as typeof this.fieldErrors;
        this.error = Object.keys(this.fieldErrors).length ? '' : error.error?.message ?? 'No pudimos continuar';
        this.loading = false;
      }
    });
  }

  private validateForm() {
    const phone = String(this.form.phone ?? '').trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (this.registerMode) {
      if (String(this.form.firstName ?? '').trim().length < 2) this.fieldErrors.firstName = 'El nombre debe tener al menos 2 caracteres.';
      if (String(this.form.lastName ?? '').trim().length < 2) this.fieldErrors.lastName = 'El apellido debe tener al menos 2 caracteres.';
      if (!/^\+[1-9]\d{9,14}$/.test(phone)) this.fieldErrors.phone = 'Ingresá el teléfono en formato internacional, por ejemplo +5493515551234.';
      if (String(this.form.password ?? '').length < 8) this.fieldErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    } else {
      if (!phoneDigits) this.fieldErrors.phone = 'Ingresá tu teléfono.';
      if (!this.form.password) this.fieldErrors.password = 'Ingresá tu contraseña.';
    }
    return Object.keys(this.fieldErrors).length === 0;
  }

  private verifyCode() {
    if (!/^\d{4,10}$/.test(this.verificationCode.trim())) {
      this.fieldErrors.code = 'Ingresá el código numérico que recibiste por SMS.';
      this.loading = false;
      return;
    }
    this.auth.verifyRegistration({ phone: this.form.phone, code: this.verificationCode.trim() }).subscribe({
      next: () => this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/reservar'),
      error: response => {
        const fields = response.error?.errors as Record<string, string[] | undefined> | undefined;
        this.fieldErrors.code = fields?.['code']?.[0];
        this.error = this.fieldErrors.code ? '' : response.error?.message ?? 'No pudimos verificar el código.';
        this.loading = false;
      }
    });
  }

  resendCode() {
    this.loading = true;
    this.error = '';
    this.fieldErrors = {};
    this.verificationCode = '';
    this.auth.register(this.form).subscribe({
      next: () => {
        this.authMessage = 'Te enviamos un nuevo código por SMS.';
        this.loading = false;
      },
      error: response => {
        this.error = response.error?.message ?? 'No pudimos reenviar el código.';
        this.loading = false;
      }
    });
  }
}
