import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api } from '../../core/api';

type PendingUser = { id: number; firstName: string; lastName: string; phone: string; verificationCode?: string | null; createdAt: string };
type ResetRequest = { id: string; requestedAt: string; user: { id: number; firstName: string; lastName: string; phone: string } };
type AuditLog = { id: string; action: string; entityType: string; entityId?: string | null; actorId?: number | null; createdAt: string };

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="security-page">
      <header class="security-head"><div><span class="eyebrow">SEGURIDAD Y ACCESOS</span><h1>Validaciones.</h1><p>El código identifica la solicitud; el teléfono remitente demuestra que la persona controla el número registrado.</p></div><a class="btn ghost" routerLink="/admin">Volver al panel</a></header>
      @if (notice) { <p class="notice" [class.error-notice]="noticeError">{{ notice }}</p> }
      <section class="security-grid">
        <article class="security-panel">
          <header class="panel-title"><div><span class="eyebrow">CUENTAS NUEVAS</span><h2>Pendientes de validar</h2></div><div class="panel-title-actions"><button class="refresh-action" type="button" [disabled]="usersLoading()" (click)="loadUsers()">{{ usersLoading() ? 'Actualizando...' : 'Actualizar' }}</button><span class="count">{{ users.length }}</span></div></header>
          <div class="request-list">
            @for (user of users; track user.id) {
              <section class="request-card"><h3>{{ user.firstName }} {{ user.lastName }}</h3><p>Registrado: {{ user.phone }}</p><p>Solicitud: {{ user.createdAt | date:'dd/MM/yyyy HH:mm' }}</p><span class="code">{{ user.verificationCode || 'Sin código' }}</span><div class="card-actions"><button class="small-action pay-action" type="button" (click)="openVerification(user)">Comprobar y aprobar</button></div></section>
            } @empty {
              @if (usersLoading()) { <div class="empty">Buscando solicitudes pendientes...</div> }
              @else if (usersLoadError()) { <div class="empty error"><span>{{ usersLoadError() }}</span><button class="inline-retry" type="button" (click)="loadUsers()">Intentar nuevamente</button></div> }
              @else { <div class="empty">No hay usuarios pendientes. Esta lista se actualiza automáticamente.</div> }
            }
          </div>
        </article>
        <article class="security-panel">
          <header class="panel-title"><div><span class="eyebrow">CONTRASEÑAS</span><h2>Recuperaciones solicitadas</h2></div><span class="count">{{ resets.length }}</span></header>
          <div class="request-list">
            @for (request of resets; track request.id) {
              <section class="request-card"><h3>{{ request.user.firstName }} {{ request.user.lastName }}</h3><p>Destino registrado: {{ request.user.phone }}</p><p>Solicitado: {{ request.requestedAt | date:'dd/MM/yyyy HH:mm' }}</p><div class="card-actions"><button class="small-action pay-action" type="button" [disabled]="resetMutation() === request.id" (click)="authorizeReset(request)">Autorizar y abrir WhatsApp</button><button class="small-action danger-action" type="button" [disabled]="resetMutation() === request.id" (click)="cancelReset(request)">Cancelar</button></div></section>
            } @empty { <div class="empty">No hay recuperaciones pendientes.</div> }
          </div>
        </article>
        <aside class="safety-note"><strong>El destino de recuperación no se puede editar.</strong><p>El backend genera el enlace una sola vez y lo dirige al teléfono guardado. Vence a los 15 minutos y queda inutilizado cuando se cambia la contraseña.</p></aside>
        <article class="security-panel audit-panel">
          <header class="panel-title"><div><span class="eyebrow">TRAZABILIDAD</span><h2>Actividad administrativa reciente</h2></div><button class="refresh-action" type="button" (click)="loadAuditLogs()">Actualizar</button></header>
          <div class="request-list">
            @for (log of auditLogs; track log.id) {
              <section class="request-card"><h3>{{ auditLabel(log.action) }}</h3><p>{{ log.entityType }} {{ log.entityId ? '#' + log.entityId : '' }} · Administrador {{ log.actorId ? '#' + log.actorId : 'sistema' }}</p><p>{{ log.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</p></section>
            } @empty { <div class="empty">Todavía no hay actividad registrada.</div> }
          </div>
        </article>
      </section>
    </main>
    @if (verificationTarget; as user) {
      <div class="modal-backdrop" (click)="closeVerification()"><section class="booking-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()"><button class="modal-close" type="button" aria-label="Cerrar" (click)="closeVerification()">×</button><span class="eyebrow">COMPROBAR IDENTIDAD</span><h2>{{ user.firstName }} {{ user.lastName }}</h2><div class="expected"><div><span>TELÉFONO REGISTRADO</span><strong>{{ user.phone }}</strong></div><div><span>CÓDIGO ESPERADO</span><strong>{{ user.verificationCode }}</strong></div></div><form class="modal-form" (ngSubmit)="submitVerification()"><label>Método<select name="method" [(ngModel)]="verificationForm.method"><option value="WHATSAPP_MANUAL">WhatsApp recibido</option><option value="PHONE_CALL">Llamada al número registrado</option><option value="IN_PERSON">Comprobación presencial</option></select></label>@if (verificationForm.method === 'WHATSAPP_MANUAL') {<label>Número desde el que llegó el WhatsApp<input name="senderPhone" [(ngModel)]="verificationForm.senderPhone" placeholder="Pegalo o escribilo completo"></label><label>Código escrito en el mensaje<input name="code" [(ngModel)]="verificationForm.code" autocomplete="off" placeholder="VAL-XXXXXXXX"></label>} @else {<label class="confirmation"><input type="checkbox" name="confirmedIdentity" [(ngModel)]="verificationForm.confirmedIdentity"><span>Confirmo que realicé esta comprobación usando el teléfono registrado o presencialmente.</span></label>}@if (verificationError) { <p class="error">{{ verificationError }}</p> }<div class="modal-actions"><button class="btn ghost" type="button" (click)="closeVerification()">Volver</button><button class="btn primary" type="submit" [disabled]="verifying()">{{ verifying() ? 'Verificando...' : 'Aprobar y avisar' }}</button></div></form></section></div>
    }
  `
})
export class AdminSecurityPage implements OnInit, OnDestroy {
  private api = inject(Api);
  users: PendingUser[] = []; resets: ResetRequest[] = []; auditLogs: AuditLog[] = [];
  verificationTarget: PendingUser | null = null;
  verificationForm = { method: 'WHATSAPP_MANUAL', senderPhone: '', code: '', confirmedIdentity: false };
  verificationError = ''; notice = ''; noticeError = false;
  readonly verifying = signal(false); readonly resetMutation = signal<string | null>(null);
  readonly usersLoading = signal(false); readonly usersLoadError = signal('');
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() { this.loadUsers(); this.loadResets(); this.loadAuditLogs(); this.refreshTimer = setInterval(() => this.loadUsers(), 15_000); }
  ngOnDestroy() { if (this.refreshTimer) clearInterval(this.refreshTimer); }
  loadUsers() {
    if (this.usersLoading()) return;
    this.usersLoading.set(true); this.usersLoadError.set('');
    this.api.get<PendingUser[]>('/admin/users/pending-verification', undefined, { noCache: true }).pipe(
      finalize(() => this.usersLoading.set(false))
    ).subscribe({
      next: value => this.users = Array.isArray(value) ? value : [],
      error: response => {
        const message = response.error?.message ?? 'No se pudieron cargar los usuarios pendientes.';
        this.usersLoadError.set(message); this.showNotice(message, true);
      }
    });
  }
  loadResets() { this.api.get<ResetRequest[]>('/admin/password-reset-requests', undefined, { noCache: true }).subscribe({ next: value => this.resets = Array.isArray(value) ? value : [], error: () => this.showNotice('No se pudieron cargar las recuperaciones.', true) }); }
  loadAuditLogs() { this.api.get<AuditLog[]>('/admin/audit-logs', { limit: 50 }, { noCache: true }).subscribe({ next: value => this.auditLogs = Array.isArray(value) ? value : [], error: () => this.showNotice('No se pudo cargar la actividad administrativa.', true) }); }
  auditLabel(action: string) {
    return ({
      USER_VERIFIED: 'Usuario verificado',
      USER_DEACTIVATED: 'Usuario desactivado',
      USER_REACTIVATED: 'Usuario reactivado',
      USER_BLOCKED: 'Usuario bloqueado',
      USER_UNBLOCKED: 'Usuario desbloqueado',
      USER_PHONE_RELEASED: 'Número liberado',
      BOOKING_CREATED: 'Turno creado',
      BOOKING_UPDATED: 'Turno modificado',
      BOOKING_CONFIRMED: 'Turno confirmado',
      BOOKING_CANCELLED: 'Turno cancelado',
      BOOKING_PAYMENT_RECORDED: 'Pago registrado',
      BOOKING_DEPOSIT_RECORDED: 'Seña registrada',
      BUSINESS_HOURS_UPDATED: 'Horarios modificados',
      BOOKING_POLICY_UPDATED: 'Política modificada'
    } as Record<string, string>)[action] ?? action;
  }
  openVerification(user: PendingUser) { this.verificationTarget = user; this.verificationError = ''; this.verificationForm = { method: 'WHATSAPP_MANUAL', senderPhone: '', code: '', confirmedIdentity: false }; }
  closeVerification() { if (!this.verifying()) this.verificationTarget = null; }
  submitVerification() {
    const user = this.verificationTarget; if (!user || this.verifying()) return;
    const payload = this.verificationForm.method === 'WHATSAPP_MANUAL' ? { method: this.verificationForm.method, senderPhone: this.verificationForm.senderPhone, code: this.verificationForm.code } : { method: this.verificationForm.method, confirmedIdentity: this.verificationForm.confirmedIdentity };
    const popup = window.open('', '_blank'); if (!popup) { this.verificationError = 'Permití las ventanas emergentes para abrir el aviso por WhatsApp.'; return; }
    this.verifying.set(true); this.verificationError = '';
    this.api.patch<any>(`/admin/users/${user.id}/verify`, payload).pipe(finalize(() => this.verifying.set(false))).subscribe({ next: response => { this.users = this.users.filter(item => item.id !== user.id); this.verificationTarget = null; popup.location.href = response.approvalWhatsappUrl; this.showNotice('Usuario verificado. Se abrió el aviso en WhatsApp.'); }, error: response => { popup.close(); this.verificationError = response.error?.message ?? 'No se pudo verificar el usuario.'; } });
  }
  authorizeReset(request: ResetRequest) { const popup = window.open('', '_blank'); if (!popup) { this.showNotice('Permití las ventanas emergentes para abrir WhatsApp.', true); return; } this.resetMutation.set(request.id); this.api.patch<any>(`/admin/password-reset-requests/${request.id}/authorize`, {}).pipe(finalize(() => this.resetMutation.set(null))).subscribe({ next: response => { this.resets = this.resets.filter(item => item.id !== request.id); popup.location.href = response.whatsappUrl; this.showNotice('Recuperación autorizada. Enviá el mensaje abierto por WhatsApp.'); }, error: response => { popup.close(); this.showNotice(response.error?.message ?? 'No se pudo autorizar la recuperación.', true); } }); }
  cancelReset(request: ResetRequest) { if (this.resetMutation()) return; this.resetMutation.set(request.id); this.api.delete<any>(`/admin/password-reset-requests/${request.id}`).pipe(finalize(() => this.resetMutation.set(null))).subscribe({ next: response => { this.resets = this.resets.filter(item => item.id !== request.id); this.showNotice(response.message); }, error: response => this.showNotice(response.error?.message ?? 'No se pudo cancelar la solicitud.', true) }); }
  private showNotice(message: string, error = false) { this.notice = message; this.noticeError = error; }
}
