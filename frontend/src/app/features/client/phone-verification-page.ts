import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api, Auth } from '../../core/api';
import { VENUE } from '../../shared/venue';
import { buildAccountVerificationWhatsappUrl } from '../../shared/whatsapp-booking';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="verification-page">
      <section class="verification-card">
        <span class="eyebrow">VALIDACIÓN MANUAL SEGURA</span>
        <h1>Confirmá tu teléfono.</h1>
        @if (auth.user()?.phoneVerified) {
          <p class="notice">Tu cuenta ya está verificada.</p>
          <a class="btn primary" routerLink="/reservar">Reservar un turno</a>
        } @else {
          <p>Enviá el mensaje desde el mismo WhatsApp del número registrado. El administrador comparará el remitente y este código.</p>
          <div class="verification-code"><span>TU CÓDIGO</span><strong>{{ auth.user()?.verificationCode || 'Pendiente' }}</strong></div>
          <div class="verification-steps"><div><b>1</b><p>Abrí WhatsApp con el botón.</p></div><div><b>2</b><p>Enviá el mensaje sin cambiar el teléfono ni el código.</p></div><div><b>3</b><p>La cancha revisará y aprobará tu cuenta.</p></div></div>
          @if (error) { <p class="verification-error">{{ error }}</p> }
          <div class="actions verification-actions">
            <a class="btn primary" [href]="whatsappUrl" target="_blank" rel="noopener noreferrer">Enviar validación por WhatsApp</a>
            <button class="btn ghost" type="button" [disabled]="checking()" (click)="checkStatus()">{{ checking() ? 'Revisando...' : 'Ya me aprobaron' }}</button>
            <a class="btn ghost" routerLink="/reservar">Continuar a reservar</a>
          </div>
        }
      </section>
    </main>
  `
})
export class PhoneVerificationPage {
  readonly auth = inject(Auth);
  private api = inject(Api);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly checking = signal(false);
  error = '';

  get whatsappUrl() {
    const user = this.auth.user();
    return buildAccountVerificationWhatsappUrl(VENUE.whatsapp, {
      firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', registeredPhone: user?.phone ?? '', verificationCode: user?.verificationCode ?? ''
    });
  }

  checkStatus() {
    if (this.checking()) return;
    this.checking.set(true); this.error = '';
    this.api.get<any>('/auth/me', undefined, { noCache: true }).pipe(finalize(() => this.checking.set(false))).subscribe({
      next: user => {
        this.auth.save({ user });
        if (user.phoneVerified) this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/reservar');
        else this.error = 'La cuenta todavía figura pendiente. Si ya enviaste el mensaje, aguardá la revisión de la cancha.';
      },
      error: () => this.error = 'No pudimos revisar el estado. Intentá nuevamente.'
    });
  }
}
