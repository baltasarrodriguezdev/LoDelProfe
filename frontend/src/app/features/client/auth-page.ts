import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../core/api';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth-wrap branded-auth">
      <div class="auth-side">
        <img class="auth-side-image" src="assets/logos/fotoIngresar.jpg" width="736" height="1308" alt="Cancha de pádel Lo del Profe">
        <div class="auth-side-overlay" aria-hidden="true"></div>
        <div class="auth-side-copy">
          <span class="eyebrow">LO DEL PROFE</span>
          <h1>{{ registerMode ? 'Sumate a jugar.' : 'Volvé a la cancha.' }}</h1>
          <p>{{ registerMode ? 'Creá tu cuenta, confirmá tu email y reservá.' : 'Ingresá con tu email para organizar el próximo partido.' }}</p>
        </div>
      </div>

      <div class="auth-form-side">
        <form class="panel auth-card" novalidate (ngSubmit)="submit()">
          <span class="eyebrow">LO DEL PROFE</span>
          <h2>{{ registerMode ? 'Crear cuenta' : 'Ingresar' }}</h2>
          @if (authMessage) { <p class="auth-message">{{ authMessage }}</p> }
          @if (registerMode) {
            <div class="two">
              <label>Nombre<input required minlength="2" autocomplete="given-name" [(ngModel)]="form.firstName" name="firstName">@if (fieldErrors.firstName) { <small class="field-error">{{ fieldErrors.firstName }}</small> }</label>
              <label>Apellido<input required minlength="2" autocomplete="family-name" [(ngModel)]="form.lastName" name="lastName">@if (fieldErrors.lastName) { <small class="field-error">{{ fieldErrors.lastName }}</small> }</label>
            </div>
          }
          <label>Email<input required type="email" autocomplete="email" inputmode="email" [(ngModel)]="form.email" name="email" placeholder="nombre@ejemplo.com">@if (fieldErrors.email) { <small class="field-error">{{ fieldErrors.email }}</small> }</label>
          @if (registerMode) {
            <label>Teléfono de contacto
              <span class="phone-control"><span class="phone-country" aria-label="País Argentina, código más 54"><span aria-hidden="true">AR</span><span class="phone-country-name">Argentina</span> +54</span><input required inputmode="numeric" autocomplete="tel-national" [ngModel]="form.phone" (ngModelChange)="onPhoneInput($event)" name="phone" placeholder="Ej: 3515551234" maxlength="17"></span>
              <small>10 dígitos, con código de área y sin 0 ni 15.</small>
              @if (fieldErrors.phone) { <small class="field-error">{{ fieldErrors.phone }}</small> }
            </label>
          }
          <label>Contraseña
            <span class="password-control"><input required minlength="8" [type]="showPassword ? 'text' : 'password'" [autocomplete]="registerMode ? 'new-password' : 'current-password'" [(ngModel)]="form.password" name="password"><button type="button" class="link" (click)="showPassword = !showPassword">{{ showPassword ? 'Ocultar' : 'Mostrar' }}</button></span>
            @if (registerMode) { <small>Usá al menos 8 caracteres; podés pegar una frase larga.</small> }
            @if (fieldErrors.password) { <small class="field-error">{{ fieldErrors.password }}</small> }
          </label>
          @if (error) { <p class="error">{{ error }}</p> }
          <button type="submit" class="btn primary full" [disabled]="loading()">{{ loading() ? 'Procesando...' : registerMode ? 'Crear cuenta' : 'Ingresar' }}</button>
          @if (!registerMode) { <p class="switch"><a routerLink="/recuperar-contrasena">Olvidé mi contraseña</a></p> }
          <p class="switch">{{ registerMode ? '¿Ya tenés cuenta?' : '¿Todavía no tenés cuenta?' }} <a [routerLink]="registerMode ? '/ingresar' : '/registro'">{{ registerMode ? 'Ingresá' : 'Registrate' }}</a></p>
          <p class="switch legacy-access"><a routerLink="/actualizar-acceso">Ya era cliente: actualizar mi acceso</a></p>
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
  showPassword = false;
  fieldErrors: { firstName?: string; lastName?: string; email?: string; phone?: string; password?: string } = {};
  loading = signal(false);

  onPhoneInput(value: string) { this.form.phone = String(value ?? '').replace(/\D/g, ''); }

  submit() {
    if (this.loading()) return;
    this.error = ''; this.fieldErrors = {};
    const payload = this.validPayload();
    if (!payload) return;
    this.loading.set(true);
    (this.registerMode ? this.auth.register(payload) : this.auth.login(payload)).subscribe({
      next: value => {
        this.loading.set(false);
        if (this.registerMode) {
          this.router.navigate(['/revisar-email'], { queryParams: { email: this.form.email } });
          return;
        }
        const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(['ADMIN', 'SUPERADMIN'].includes(value.user.role) ? '/admin' : requestedUrl || '/reservar');
      },
      error: response => {
        this.loading.set(false);
        const fields = response.error?.errors as Record<string, string[] | undefined> | undefined;
        this.fieldErrors = Object.fromEntries(Object.entries(fields ?? {}).map(([field, messages]) => [field, messages?.[0] ?? 'Dato inválido'])) as typeof this.fieldErrors;
        if (response.error?.code === 'EMAIL_NOT_VERIFIED') {
          this.router.navigate(['/revisar-email'], { queryParams: { email: this.form.email } });
          return;
        }
        this.error = Object.keys(this.fieldErrors).length ? '' : response.error?.message ?? 'No pudimos continuar.';
      }
    });
  }

  private validPayload() {
    const email = String(this.form.email ?? '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) this.fieldErrors['email'] = 'Ingresá un email válido.';
    if (!this.form.password) this.fieldErrors['password'] = 'Ingresá tu contraseña.';
    if (this.registerMode) {
      if (String(this.form.firstName ?? '').trim().length < 2) this.fieldErrors['firstName'] = 'El nombre debe tener al menos 2 caracteres.';
      if (String(this.form.lastName ?? '').trim().length < 2) this.fieldErrors['lastName'] = 'El apellido debe tener al menos 2 caracteres.';
      if (String(this.form.password ?? '').length < 8) this.fieldErrors['password'] = 'La contraseña debe tener al menos 8 caracteres.';
      const phone = normalizeArgentinaPhone(this.form.phone);
      if (!phone) this.fieldErrors['phone'] = 'Ingresá un teléfono argentino válido.';
      if (Object.keys(this.fieldErrors).length) return null;
      return { ...this.form, email, phone };
    }
    return Object.keys(this.fieldErrors).length ? null : { email, password: this.form.password };
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
  return /^\d{10}$/.test(digits) ? `+54${digits}` : null;
}
