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
  styles: [`
    .verification-page{min-height:calc(100vh - 82px);display:grid;place-items:center;padding:42px 18px;background:radial-gradient(circle at 85% 10%,#d8e5c9,transparent 30%)}
    .verification-card{width:min(720px,100%);padding:clamp(28px,5vw,55px);background:var(--white);border:1px solid var(--line);border-radius:18px;box-shadow:14px 16px 0 var(--lime)}
    h1{font-size:clamp(3rem,7vw,5rem);margin:10px 0 16px}.verification-code{margin:25px 0;padding:20px;border:1px dashed var(--green);border-radius:12px;background:#edf3e7;display:grid;gap:6px}.verification-code span{font-size:.68rem;letter-spacing:.16em;color:var(--muted)}.verification-code strong{font-size:2rem;letter-spacing:.08em}.steps{display:grid;gap:10px;margin:25px 0}.steps div{display:grid;grid-template-columns:34px 1fr;gap:12px;align-items:center}.steps b{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:var(--ink);color:white}.steps p{margin:0}.actions{display:flex;flex-wrap:wrap;margin-bottom:0}.error{color:var(--danger)}
  `],
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
          <div class="steps"><div><b>1</b><p>Abrí WhatsApp con el botón.</p></div><div><b>2</b><p>Enviá el mensaje sin cambiar el teléfono ni el código.</p></div><div><b>3</b><p>La cancha revisará y aprobará tu cuenta.</p></div></div>
          @if (error) { <p class="error">{{ error }}</p> }
          <div class="actions">
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
