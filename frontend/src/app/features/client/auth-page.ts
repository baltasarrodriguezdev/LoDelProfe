import { Component, inject } from '@angular/core';
import { signal } from '@angular/core';
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
          <p>{{ registerMode ? 'Creá tu cuenta y reservá tu próximo partido.' : 'Reservá tu próximo turno en segundos.' }}</p>
        </div>
      </div>

      <div class="auth-form-side">
        <form class="panel auth-card" novalidate (ngSubmit)="submit()">
          <span class="eyebrow">LO DEL PROFE</span>
          <h2>{{ registerMode ? 'Crear cuenta' : legacyMode ? 'Cuenta anterior' : 'Ingresar' }}</h2>
          @if (authMessage) { <p class="auth-message">{{ authMessage }}</p> }
          @if (legacyMode) { <p>Entrá con tu teléfono y contraseña de siempre. Después agregás un email para los próximos ingresos.</p> }
          @if (registerMode) {
            <div class="two">
              <label>Nombre<input required minlength="2" [(ngModel)]="form.firstName" name="firstName">@if (fieldErrors.firstName) { <small class="field-error">{{ fieldErrors.firstName }}</small> }</label>
              <label>Apellido<input required minlength="2" [(ngModel)]="form.lastName" name="lastName">@if (fieldErrors.lastName) { <small class="field-error">{{ fieldErrors.lastName }}</small> }</label>
            </div>
          }
          @if (legacyMode) { <label>Teléfono
            <span class="phone-control">
              <span class="phone-country" aria-label="País Argentina, código más 54"><span aria-hidden="true">AR</span><span class="phone-country-name">Argentina</span> +54</span>
              <input required inputmode="numeric" autocomplete="tel-national" [ngModel]="form.phone" (ngModelChange)="onPhoneInput($event)" name="phone" placeholder="Ej: 3515551234" maxlength="17">
            </span>
            <small>Ingresá los 10 dígitos, con código de área y sin 0 ni 15.</small>
            @if (fieldErrors.phone) { <small class="field-error">{{ fieldErrors.phone }}</small> }
          </label> } @else { <label>Email<input required type="email" autocomplete="email" [(ngModel)]="form.email" name="email" placeholder="tu@email.com">@if (fieldErrors.email) { <small class="field-error">{{ fieldErrors.email }}</small> }</label> }
          <label>Contraseña<span class="password-control"><input required minlength="8" [type]="showPassword() ? 'text' : 'password'" [autocomplete]="registerMode ? 'new-password' : 'current-password'" [(ngModel)]="form.password" name="password"><button type="button" class="password-reveal" [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'" [attr.aria-pressed]="showPassword()" (click)="showPassword.set(!showPassword())">{{ showPassword() ? 'Ocultar' : 'Mostrar' }}</button></span>@if (registerMode) { <small>Mínimo 8 caracteres.</small> }@if (fieldErrors.password) { <small class="field-error">{{ fieldErrors.password }}</small> }</label>
          @if (registerMode) { <label>Repetir contraseña<input required [type]="showPassword() ? 'text' : 'password'" autocomplete="new-password" [(ngModel)]="form.confirmation" name="confirmation">@if (fieldErrors.confirmation) { <small class="field-error">{{ fieldErrors.confirmation }}</small> }</label> }
          @if (error) { <p class="error">{{ error }}</p> }
          <button type="submit" class="btn primary full" [disabled]="loading()">{{ loading() ? 'Procesando...' : registerMode ? 'Crear cuenta' : 'Ingresar' }}</button>
          @if (!registerMode) { <p class="switch"><a routerLink="/recuperar-contrasena">Olvidé mi contraseña</a></p> }
          @if (!registerMode && !legacyMode) { <p class="switch"><a routerLink="/ingresar-anterior">Ya tenía una cuenta con teléfono</a></p> }
          @if (legacyMode) { <p class="switch"><a routerLink="/ingresar">Ingresar con email</a></p> }
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
  legacyMode = !this.registerMode && this.router.url.includes('ingresar-anterior');
  authMessage = this.route.snapshot.queryParamMap.get('authRequired') === '1' ? 'Tenés que iniciar sesión para continuar.' : '';
  form: any = {};
  error = '';
  fieldErrors: { firstName?: string; lastName?: string; phone?: string; email?: string; password?: string; confirmation?: string } = {};
  loading = signal(false);
  showPassword = signal(false);

  onPhoneInput(value: string) { this.form.phone = String(value ?? '').replace(/\D/g, ''); }

  submit() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error = '';
    this.fieldErrors = {};
    const phone = this.validateForm();
    if (Object.keys(this.fieldErrors).length) { this.loading.set(false); return; }
    const payload = this.legacyMode ? { phone, password: this.form.password } : { ...this.form, email: String(this.form.email ?? '').trim().toLowerCase() };
    const call = this.registerMode ? this.auth.register(payload) : this.auth.login(payload);
    call.subscribe({
      next: value => {
        this.loading.set(false);
        const requested = this.route.snapshot.queryParamMap.get('returnUrl');
        const requestedUrl = requested?.startsWith('/') && !requested.startsWith('//') ? requested : null;
        if (this.registerMode || !value.user.emailVerifiedAt) {
          this.router.navigate([value.user.legacyAccount ? '/completar-email' : '/confirmar-email'], { queryParams: requestedUrl ? { returnUrl: requestedUrl } : undefined });
        } else {
          this.router.navigateByUrl(['ADMIN', 'SUPERADMIN'].includes(value.user.role) ? '/admin' : requestedUrl || '/reservar');
        }
      },
      error: response => {
        const fields = response.error?.errors as Record<string, string[] | undefined> | undefined;
        this.fieldErrors = Object.fromEntries(Object.entries(fields ?? {}).map(([field, messages]) => [field, messages?.[0] ?? 'Dato inválido'])) as typeof this.fieldErrors;
        this.error = Object.keys(this.fieldErrors).length ? '' : this.registrationError(response);
        this.loading.set(false);
      }
    });
  }

  private validateForm() {
    const phone = normalizeArgentinaPhone(this.form.phone);
    if (this.registerMode) {
      if (String(this.form.firstName ?? '').trim().length < 2) this.fieldErrors.firstName = 'El nombre debe tener al menos 2 caracteres.';
      if (String(this.form.lastName ?? '').trim().length < 2) this.fieldErrors.lastName = 'El apellido debe tener al menos 2 caracteres.';
      if (String(this.form.password ?? '').length < 8 || String(this.form.password ?? '').length > 72) this.fieldErrors.password = 'La contraseña debe tener entre 8 y 72 caracteres.';
      if (this.form.password !== this.form.confirmation) this.fieldErrors.confirmation = 'Las contraseñas no coinciden.';
    } else if (!this.form.password) this.fieldErrors.password = 'Ingresá tu contraseña.';
    if (this.legacyMode && !phone) this.fieldErrors.phone = 'Ingresá un teléfono argentino válido, por ejemplo 3515551234.';
    if (!this.legacyMode && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(this.form.email ?? '').trim())) this.fieldErrors.email = 'Ingresá un email válido.';
    return phone;
  }

  private registrationError(response: any) {
    if (response.status === 409) return 'Ese teléfono ya está registrado';
    if (response.status === 400) return response.error?.message ?? 'Revisá los datos ingresados.';
    if (response.status === 403) return response.error?.message ?? 'No tenés permisos para continuar.';
    return response.error?.message ?? 'No pudimos continuar.';
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
