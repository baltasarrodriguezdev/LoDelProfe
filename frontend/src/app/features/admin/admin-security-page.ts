import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Api } from '../../core/api';

type AuditLog = { id: string; action: string; entityType: string; entityId?: string | null; details?: unknown; createdAt: string };

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="admin-title"><span class="eyebrow">SEGURIDAD</span><h1>Accesos y actividad</h1><p>El email se confirma automáticamente y la recuperación ya no requiere aprobación administrativa.</p></section>
    <section class="security-layout">
      <div class="security-main"><div class="section-heading"><div><span class="eyebrow">AUDITORÍA</span><h2>Actividad reciente</h2></div></div>
        <div class="audit-list">
          @for (entry of auditLogs; track entry.id) { <article class="audit-row"><div><strong>{{ auditLabel(entry.action) }}</strong><p>{{ entry.entityType }} {{ entry.entityId || '' }}</p></div><time>{{ entry.createdAt | date:'dd/MM/yyyy HH:mm' }}</time></article> }
          @empty { <div class="empty">No hay actividad para mostrar.</div> }
        </div>
      </div>
      <aside class="safety-note"><strong>Los administradores ya no validan cuentas ni recuperaciones.</strong><p>Cada persona confirma su email mediante un enlace de un solo uso. Los bloqueos, roles y auditoría siguen administrándose desde Clientes.</p></aside>
    </section>
  `
})
export class AdminSecurityPage implements OnInit {
  private api = inject(Api);
  auditLogs: AuditLog[] = [];
  ngOnInit() { this.api.get<AuditLog[]>('/admin/audit-logs', { limit: 50 }, { noCache: true }).subscribe({ next: value => this.auditLogs = Array.isArray(value) ? value : [] }); }
  auditLabel(action: string) {
    return ({ USER_REGISTERED: 'Usuario registrado', USER_EMAIL_VERIFIED: 'Email confirmado', USER_ACCESS_MIGRATED: 'Acceso actualizado', USER_PASSWORD_RESET: 'Contraseña restablecida', USER_BLOCKED: 'Usuario bloqueado', USER_UNBLOCKED: 'Usuario desbloqueado', BOOKING_BOT_CREATED: 'Reserva creada por WhatsApp', BOOKING_WEB_CREATED: 'Reserva creada desde la web' } as Record<string, string>)[action] ?? action;
  }
}
