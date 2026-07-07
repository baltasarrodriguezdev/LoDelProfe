import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  styles: [`
    .phone-control { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: stretch; }
    .phone-country { display: flex; align-items: center; gap: .45rem; padding: 0 .85rem; border: 1px solid var(--line, #d8d8d8); border-right: 0; border-radius: .65rem 0 0 .65rem; white-space: nowrap; background: #f5f2ed; font-weight: 700; }
    .phone-control input { min-width: 0; border-radius: 0 .65rem .65rem 0; }
    @media (max-width: 420px) { .phone-country__name { display: none; } }
  `],
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
            <p>Enviamos un código por SMS a <strong>{{ normalizedPhone }}</strong>.</p>
            <label>Código de verificación<input required inputmode="numeric" autocomplete="one-time-code" [(ngModel)]="verificationCode" name="verificationCode" placeholder="Código SMS">@if (fieldErrors.code) { <small class="field-error">{{ fieldErrors.code }}</small> }</label>
          } @else if (registerMode) {
            <div class="two">
              <label>Nombre<input required minlength="2" [(ngModel)]="form.firstName" name="firstName">@if (fieldErrors.firstName) { <small class="field-error">{{ fieldErrors.firstName }}</small> }</label>
              <label>Apellido<input required minlength="2" [(ngModel)]="form.lastName" name="lastName">@if (fieldErrors.lastName) { <small class="field-error">{{ fieldErrors.lastName }}</small> }</label>
            </div>
          }
          @if (!verificationStep) {
            <label>Teléfono
              <span class="phone-control">
                <span class="phone-country" aria-label="País Argentina, código más 54"><span aria-hidden="true">🇦🇷</span><span class="phone-country__name">Argentina</span> +54</span>
                <input required inputmode="numeric" autocomplete="tel-national" [ngModel]="form.phone" (ngModelChange)="onPhoneInput($event)" name="phone" placeholder="Ej: 3515551234" maxlength="17">
              </span>
              <small>Ingresá los 10 dígitos, con código de área y sin 0 ni 15.</small>
              @if (fieldErrors.phone) { <small class="field-error">{{ fieldErrors.phone }}</small> }
            </label>
            <label>Contraseña<input required minlength="8" type="password" [autocomplete]="registerMode ? 'new-password' : 'current-password'" [(ngModel)]="form.password" name="password"><small>Mínimo 8 caracteres.</small>@if (fieldErrors.password) { <small class="field-error">{{ fieldErrors.password }}</small> }</label>
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
  authMessage = this.route.snapshot.queryParamMap.get('authRequired') === '1' ? 'Tenés que iniciar sesión para continuar.' : '';
  form: any = {};
  error = '';
  fieldErrors: { firstName?: string; lastName?: string; phone?: string; password?: string; code?: string } = {};
  loading = false;
  verificationStep = false;
  verificationCode = '';
  normalizedPhone = '';

  onPhoneInput(value: string) { this.form.phone = String(value ?? '').replace(/\D/g, ''); }

  submit() {
    this.loading = true;
    this.error = '';
    this.fieldErrors = {};
    if (this.verificationStep) { this.verifyCode(); return; }
    const phone = this.validateForm();
    if (!phone) { this.loading = false; return; }
    this.normalizedPhone = phone;
    const payload = { ...this.form, phone };
    const call = this.registerMode ? this.auth.register(payload) : this.auth.login(payload);
    call.subscribe({
      next: value => {
        if (this.registerMode) { this.verificationStep = true; this.loading = false; return; }
        const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(['ADMIN', 'SUPERADMIN'].includes(value.user.role) ? '/admin' : requestedUrl || '/reservar');
      },
      error: response => {
        const fields = response.error?.errors as Record<string, string[] | undefined> | undefined;
        this.fieldErrors = Object.fromEntries(Object.entries(fields ?? {}).map(([field, messages]) => [field, messages?.[0] ?? 'Dato inválido'])) as typeof this.fieldErrors;
        this.error = Object.keys(this.fieldErrors).length ? '' : response.error?.message ?? 'No pudimos continuar';
        this.loading = false;
      }
    });
  }

  private validateForm() {
    const phone = normalizeArgentinaPhone(this.form.phone);
    if (this.registerMode) {
      if (String(this.form.firstName ?? '').trim().length < 2) this.fieldErrors.firstName = 'El nombre debe tener al menos 2 caracteres.';
      if (String(this.form.lastName ?? '').trim().length < 2) this.fieldErrors.lastName = 'El apellido debe tener al menos 2 caracteres.';
      if (String(this.form.password ?? '').length < 8) this.fieldErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    } else if (!this.form.password) this.fieldErrors.password = 'Ingresá tu contraseña.';
    if (!phone) this.fieldErrors.phone = 'Ingresá un teléfono argentino válido, por ejemplo 3515551234.';
    return Object.keys(this.fieldErrors).length === 0 ? phone : null;
  }

  private verifyCode() {
    if (!/^\d{4,10}$/.test(this.verificationCode.trim())) {
      this.fieldErrors.code = 'Ingresá el código numérico que recibiste por SMS.';
      this.loading = false;
      return;
    }
    this.auth.verifyRegistration({ phone: this.normalizedPhone, code: this.verificationCode.trim() }).subscribe({
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
    this.auth.register({ ...this.form, phone: this.normalizedPhone }).subscribe({
      next: () => { this.authMessage = 'Te enviamos un nuevo código por SMS.'; this.loading = false; },
      error: response => { this.error = response.error?.message ?? 'No pudimos reenviar el código.'; this.loading = false; }
    });
  }
}

function normalizeArgentinaPhone(input: unknown): string | null {
  let digits = String(input ?? '').replace(/\D/g, '');
  const hadCountryCode = digits.startsWith('54');
  if (hadCountryCode) digits = digits.slice(2);
  if (digits.startsWith('9') && (hadCountryCode || digits.length === 11)) digits = digits.slice(1);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 12) {
    const candidates = [2, 3, 4].filter(position => digits.slice(position, position + 2) === '15').map(position => digits.slice(0, position) + digits.slice(position + 2));
    if (candidates.length === 1) digits = candidates[0];
  }
  return /^\d{10}$/.test(digits) ? `+549${digits}` : null;
}
