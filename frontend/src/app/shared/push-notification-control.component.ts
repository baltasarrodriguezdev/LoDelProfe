import { Component, computed, inject } from '@angular/core';
import { PushNotificationsService } from '../core/push-notifications';

@Component({
  selector: 'app-push-notification-control',
  standalone: true,
  template: `
    <div class="push-control" [class.is-active]="push.status() === 'active'">
      <button
        type="button"
        [disabled]="disabled()"
        [attr.aria-pressed]="push.status() === 'active'"
        [attr.title]="detail()"
        (click)="toggle()"
      >
        <span class="push-bell" aria-hidden="true"><i></i></span>
        <span><small>AVISOS</small><strong>{{ label() }}</strong></span>
      </button>
      <span class="sr-only" aria-live="polite">{{ detail() }}</span>
    </div>
  `,
  styles: [`
    :host { display: flex; align-items: center; margin-left: auto; padding: 6px 5px; }
    .push-control { display: flex; }
    button {
      display: inline-flex; min-height: 42px; align-items: center; gap: 9px;
      border: 1px solid rgb(255 255 255 / 18%); border-radius: 999px; padding: 5px 13px 5px 9px;
      background: rgb(255 255 255 / 7%); color: #eef2eb; cursor: pointer;
      transition: border-color .18s ease, background .18s ease, transform .18s ease;
    }
    button:hover:not(:disabled) { border-color: var(--color-brand-gold); background: rgb(255 255 255 / 12%); transform: translateY(-1px); }
    button:focus-visible { outline: 3px solid rgb(212 183 103 / 38%); outline-offset: 2px; }
    button:disabled { cursor: not-allowed; opacity: .6; }
    button > span:last-child { display: grid; gap: 1px; text-align: left; }
    small { color: #b8c5b4; font-size: .58rem; font-weight: 700; letter-spacing: .13em; line-height: 1; }
    strong { color: inherit; font-size: .74rem; font-weight: 700; line-height: 1.15; white-space: nowrap; }
    .push-bell { position: relative; display: block; width: 23px; height: 23px; border-radius: 50%; background: rgb(255 255 255 / 9%); }
    .push-bell::before {
      content: ''; position: absolute; left: 7px; top: 5px; width: 9px; height: 10px;
      border: 1.8px solid currentColor; border-bottom: 0; border-radius: 7px 7px 3px 3px;
    }
    .push-bell::after { content: ''; position: absolute; left: 6px; top: 15px; width: 11px; height: 2px; border-radius: 2px; background: currentColor; }
    .push-bell i { position: absolute; left: 10px; top: 18px; width: 3px; height: 2px; border-radius: 0 0 3px 3px; background: currentColor; }
    .is-active button { border-color: rgb(212 183 103 / 60%); background: rgb(212 183 103 / 14%); color: #fff8db; }
    .is-active .push-bell::after { box-shadow: 8px -12px 0 -2px #d4b767; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 900px) {
      :host { width: 100%; margin: 0; padding: 7px 4px 3px; }
      .push-control, button { width: 100%; }
      button { justify-content: flex-start; border-radius: 7px; padding: 9px 12px; }
    }
  `]
})
export class PushNotificationControlComponent {
  readonly push = inject(PushNotificationsService);

  readonly disabled = computed(() => ['checking', 'subscribing', 'unsubscribing', 'blocked', 'unsupported'].includes(this.push.status()));

  readonly label = computed(() => ({
    checking: 'Comprobando…',
    available: 'Activar',
    subscribing: 'Activando…',
    active: 'Activadas',
    unsubscribing: 'Desactivando…',
    blocked: 'Bloqueadas',
    unsupported: 'No disponibles',
    unconfigured: 'Configurar servidor',
    error: 'Reintentar'
  })[this.push.status()]);

  readonly detail = computed(() => {
    if (this.push.error()) return this.push.error();
    return ({
      checking: 'Comprobando las notificaciones de este dispositivo.',
      available: 'Activá avisos automáticos de reservas, cancelaciones y usuarios pendientes.',
      subscribing: 'El navegador está activando los avisos.',
      active: 'Este dispositivo recibe avisos automáticos. Tocá para desactivarlos.',
      unsubscribing: 'Desactivando los avisos de este dispositivo.',
      blocked: 'Las notificaciones están bloqueadas en la configuración del navegador.',
      unsupported: 'Las notificaciones requieren la versión instalada y segura del sitio.',
      unconfigured: 'Faltan las claves de notificaciones en el servidor.',
      error: 'No se pudo completar la operación. Tocá para reintentar.'
    })[this.push.status()];
  });

  toggle() {
    if (this.push.status() === 'active') void this.push.deactivate();
    else void this.push.activate();
  }
}
