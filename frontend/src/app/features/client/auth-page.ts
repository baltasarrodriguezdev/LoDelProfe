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
        <form class="panel auth-card" (ngSubmit)="submit()">
          <span class="eyebrow">LO DEL PROFE</span>
          <h2>{{ registerMode ? 'Crear cuenta' : 'Ingresar' }}</h2>
          @if (authMessage) { <p class="auth-message">{{ authMessage }}</p> }
          @if (registerMode) {
            <div class="two">
              <label>Nombre<input required [(ngModel)]="form.firstName" name="firstName"></label>
              <label>Apellido<input required [(ngModel)]="form.lastName" name="lastName"></label>
            </div>
          }
          <label>Teléfono<input required inputmode="tel" [(ngModel)]="form.phone" name="phone" placeholder="Ej. 351 555 1234"></label>
          <label>Contraseña<input required minlength="8" type="password" [(ngModel)]="form.password" name="password"></label>
          @if (error) { <p class="error">{{ error }}</p> }
          <button class="btn primary full" [disabled]="loading">{{ loading ? 'Procesando...' : registerMode ? 'Registrarme' : 'Ingresar' }}</button>
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
  loading = false;

  submit() {
    this.loading = true;
    this.error = '';
    const call = this.registerMode ? this.auth.register(this.form) : this.auth.login(this.form);
    call.subscribe({
      next: value => {
        const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const destination = ['ADMIN', 'SUPERADMIN'].includes(value.user.role)
          ? '/admin'
          : requestedUrl || '/reservar';
        this.router.navigateByUrl(destination);
      },
      error: error => {
        this.error = error.error?.message ?? 'No pudimos continuar';
        this.loading = false;
      }
    });
  }
}
