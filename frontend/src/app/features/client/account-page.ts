import { Component, inject, OnInit, signal } from '@angular/core';
import { Api, Auth } from '../../core/api';
import { VENUE } from '../../shared/venue';

type LinkStatus = { linked: boolean; phone: string | null; pending: boolean; pendingPhone: string | null };

@Component({
  standalone: true,
  template: `
    <section class="page-head"><span class="eyebrow">MI CUENTA</span><h1>Tu acceso y WhatsApp.</h1><p>El email protege tu cuenta. WhatsApp se conecta por separado y nunca reemplaza tu contraseña.</p></section>
    <section class="panel account-panel">
      <div><span class="eyebrow">EMAIL</span><h2>{{ auth.user()?.email }}</h2><p>{{ auth.user()?.emailVerified ? 'Email confirmado' : 'Email pendiente de confirmación' }}</p></div>
      <div class="account-divider"></div>
      <div><span class="eyebrow">WHATSAPP</span>
        @if (status()?.linked) { <h2>WhatsApp conectado</h2><p>Número vinculado: {{ status()?.phone }}</p> }
        @else { <h2>Conectá tu número una sola vez</h2><p>El bot debe recibir el desafío desde el remitente autenticado por el proveedor. Escribir un número no alcanza.</p> }
        @if (error) { <p class="notice error-notice">{{ error }}</p> }
        @if (challenge) {
          <div class="verification-code"><span>DESAFÍO TEMPORAL</span><strong>{{ challenge }}</strong></div>
          <div class="actions"><a class="btn primary" [href]="whatsappUrl" target="_blank" rel="noopener">Abrir el bot</a><button class="btn ghost" type="button" [disabled]="loading()" (click)="refresh()">Ya envié el mensaje</button></div>
        } @else if (!status()?.linked) { <button class="btn primary" type="button" [disabled]="loading()" (click)="start()">Conectar WhatsApp</button> }
        @if (status()?.pending) { <p>El bot reconoció {{ status()?.pendingPhone }}.</p><button class="btn primary" type="button" [disabled]="loading()" (click)="confirm()">Confirmar vinculación</button> }
      </div>
    </section>
  `
})
export class AccountPage implements OnInit {
  private api = inject(Api);
  readonly auth = inject(Auth);
  readonly loading = signal(false);
  readonly status = signal<LinkStatus | null>(null);
  challenge = ''; error = '';
  get whatsappUrl() { return `https://wa.me/${VENUE.whatsapp}?text=${encodeURIComponent(`VINCULAR ${this.challenge}`)}`; }
  ngOnInit() { this.refresh(); }
  refresh() {
    this.loading.set(true); this.error = '';
    this.api.get<LinkStatus>('/auth/whatsapp-link', undefined, { noCache: true }).subscribe({ next: value => { this.status.set(value); this.loading.set(false); }, error: response => { this.error = response.error?.message ?? 'No pudimos consultar la vinculación.'; this.loading.set(false); } });
  }
  start() {
    this.loading.set(true); this.error = '';
    this.api.post<any>('/auth/whatsapp-link/challenges', {}).subscribe({ next: value => { this.challenge = value.challenge; this.loading.set(false); }, error: response => { this.error = response.error?.message ?? 'No pudimos iniciar la vinculación.'; this.loading.set(false); } });
  }
  confirm() {
    this.loading.set(true); this.error = '';
    this.api.post<LinkStatus>('/auth/whatsapp-link/confirm', {}).subscribe({ next: value => { this.status.set(value); this.challenge = ''; this.loading.set(false); }, error: response => { this.error = response.error?.message ?? 'No pudimos confirmar la vinculación.'; this.loading.set(false); } });
  }
}
