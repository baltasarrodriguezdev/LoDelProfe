import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Api } from '../../core/api';
import { AsyncStatus } from '../../shared/async-state';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

type ClientStatus = 'pending' | 'confirmed' | 'inactive' | 'blocked' | 'all';
type Client = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  active: boolean;
  phoneVerified: boolean;
  isBlocked: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: { bookings?: number };
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialogComponent],
  template: `
    <section class="admin-shell clients-admin-shell">
      <aside class="admin-nav">
        <span class="eyebrow">PANEL DEL CLUB</span>
        <h2>Administración</h2>
        <small class="admin-nav-label">USO DIARIO</small>
        <a routerLink="/admin">Hoy</a>
        <a routerLink="/admin/agenda-diaria">Agenda diaria</a>
        <a routerLink="/admin/agenda-semanal">Agenda semanal</a>
        <a routerLink="/admin/turno">Agregar turno</a>
        <a routerLink="/admin/turno" [queryParams]="{mode:'block'}">Bloquear horario</a>
        <small class="admin-nav-label advanced">MARKETING</small>
        <a routerLink="/admin/marketing/historias-instagram">Historias Instagram</a>
        <small class="admin-nav-label advanced">CONFIGURACIÓN</small>
        <a routerLink="/admin/precios">Precios</a>
        <a routerLink="/admin/horarios">Horarios</a>
        <a routerLink="/admin/politicas">Políticas</a>
        <a routerLink="/admin/turnos-fijos">Turnos fijos</a>
        <a routerLink="/admin/clientes" class="active">Clientes</a>
        <a routerLink="/admin/seguridad">Seguridad y accesos</a>
        <a routerLink="/admin/caja">Caja</a>
        <a routerLink="/admin/estadisticas">Estadísticas</a>
      </aside>

      <div class="admin-content clients-admin-content">
        <header class="clients-header">
          <div>
            <span class="eyebrow">CLIENTES</span>
            <h1>Gestión de clientes</h1>
            <p>Alta, validación y estado de las cuentas que reservan en la cancha.</p>
          </div>
          <button type="button" class="btn primary" (click)="openCreate()">Agregar cliente</button>
        </header>

        @if (notice) { <p class="notice" [class.error-notice]="noticeError">{{ notice }}</p> }

        <section class="clients-toolbar panel">
          <label class="clients-search">Buscar cliente<input type="search" name="clientSearch" autocomplete="off" placeholder="Nombre, apellido o teléfono…" [(ngModel)]="search"></label>
          <div class="client-tabs" role="group" aria-label="Filtrar clientes por estado">
            @for (tab of tabs; track tab.id) {
              <button type="button" [class.active]="activeTab === tab.id" [attr.aria-pressed]="activeTab === tab.id" (click)="activeTab = tab.id">
                <span class="client-tab-label">{{ tab.label }}</span>
                <b class="client-tab-count">{{ count(tab.id) }}</b>
              </button>
            }
          </div>
        </section>

        @if (showForm) {
          <form class="panel client-form" (ngSubmit)="saveForm()">
            <div class="form-section-title"><span>{{ editingClient ? '02' : '01' }}</span><div><h2>{{ editingClient ? 'Editar cliente' : 'Agregar cliente' }}</h2><p>{{ editingClient ? 'Actualizá el nombre visible del cliente.' : 'La cuenta quedará pendiente hasta comprobar el teléfono desde Seguridad.' }}</p></div></div>
            <div class="form-grid clients-form-grid">
              <label>Nombre<input name="firstName" required minlength="2" [(ngModel)]="form.firstName"></label>
              <label>Apellido<input name="lastName" required minlength="2" [(ngModel)]="form.lastName"></label>
              @if (!editingClient) {
                <label>Teléfono<input name="phone" required inputmode="tel" placeholder="Ej. 3576 468131" [(ngModel)]="form.phone"></label>
                <label>Contraseña inicial<input name="password" required minlength="8" type="password" [(ngModel)]="form.password"></label>
              }
            </div>
            @if (formError) { <p class="error client-form-error">{{ formError }}</p> }
            <div class="client-form-actions">
              <button type="button" class="btn ghost" [disabled]="saving()" (click)="closeForm()">Cancelar</button>
              <button type="submit" class="btn primary" [disabled]="saving()">{{ saving() ? 'Guardando...' : editingClient ? 'Guardar cambios' : 'Agregar cliente' }}</button>
            </div>
          </form>
        }

        <section class="clients-list" aria-live="polite">
          @if (clientsStatus() === 'loading') {
            <div class="empty">Cargando clientes...</div>
          } @else if (clientsStatus() === 'success') {
            @for (client of filteredClients; track client.id) {
              <article class="client-row" [class.inactive]="!client.active" [class.blocked]="client.isBlocked">
                <div class="client-avatar" aria-hidden="true">{{ initials(client) }}</div>
                <div class="client-main">
                  <div class="client-title-row">
                    <h2>{{ client.firstName }} {{ client.lastName }}</h2>
                    <span [class]="'client-status ' + statusClass(client)">{{ statusLabel(client) }}</span>
                  </div>
                  <p>{{ client.phone }} · Alta {{ client.createdAt ? (client.createdAt | date:'dd/MM/yyyy') : 'sin fecha' }}</p>
                </div>
                <div class="client-actions">
                  @if (!client.phoneVerified && client.active && !client.isBlocked) {
                    <a class="small-action" routerLink="/admin/seguridad">Comprobar identidad</a>
                    <button type="button" class="small-action danger-action" (click)="askCancelPending(client)">Cancelar registro</button>
                  } @else {
                    <button type="button" class="small-action" (click)="openEdit(client)">Editar</button>
                    @if (client.active && !client.isBlocked) { <button type="button" class="small-action" (click)="setBlocked(client, true)">Bloquear</button> }
                    @if (client.isBlocked) { <button type="button" class="small-action" (click)="setBlocked(client, false)">Desbloquear</button> }
                    @if (client.active) { <button type="button" class="small-action danger-action" (click)="askDeactivate(client)">Desactivar cliente</button> }
                    @if (!client.active) { <button type="button" class="small-action pay-action" (click)="setActive(client, true)">Reactivar</button> }
                    @if (!client.active) { <button type="button" class="small-action danger-action" (click)="askReleasePhone(client)">Liberar número</button> }
                  }
                </div>
              </article>
            } @empty {
              <div class="empty">No hay clientes para este filtro.</div>
            }
          }
        </section>
      </div>
    </section>

    @if (confirmDialog; as dialog) {
      <app-confirm-dialog
        [title]="dialog.title"
        [message]="dialog.message"
        [secondaryMessage]="dialog.secondaryMessage"
        [confirmText]="dialog.confirmText"
        cancelText="Volver"
        [loadingText]="dialog.loadingText"
        variant="danger"
        [loading]="confirmLoading()"
        [error]="confirmError"
        (cancel)="closeConfirmDialog()"
        (confirm)="confirmDialogConfirmed()"
      />
    }
  `,
})
export class AdminClientsPage implements OnInit, OnDestroy {
  private api = inject(Api);

  clients: Client[] = [];
  activeTab: ClientStatus = 'pending';
  search = '';
  readonly clientsStatus = signal<AsyncStatus>('idle');
  readonly savingClientId = signal<number | null>(null);
  readonly saving = signal(false);
  notice = '';
  noticeError = false;
  showForm = false;
  editingClient: Client | null = null;
  form: any = { firstName: '', lastName: '', phone: '', password: '' };
  formError = '';
  confirmDialog: { type: 'cancelPending' | 'deactivate' | 'releasePhone'; target: Client; title: string; message: string; secondaryMessage: string; confirmText: string; loadingText: string } | null = null;
  readonly confirmLoading = signal(false);
  confirmError = '';
  private clientsRequestId = 0;
  private clientsAbort: AbortController | null = null;

  readonly tabs: Array<{ id: ClientStatus; label: string }> = [
    { id: 'pending', label: 'Pendientes' },
    { id: 'confirmed', label: 'Confirmados' },
    { id: 'inactive', label: 'Desactivados' },
    { id: 'blocked', label: 'Bloqueados' },
    { id: 'all', label: 'Todos' }
  ];

  ngOnInit() { this.loadClients(); }
  ngOnDestroy() { this.clientsAbort?.abort(); }

  get clientRows() { return this.clients.filter(client => client.role === 'CLIENT'); }

  get filteredClients() {
    const term = this.search.trim().toLowerCase();
    return this.clientRows.filter(client => this.matchesTab(client, this.activeTab)).filter(client => {
      if (!term) return true;
      return `${client.firstName} ${client.lastName} ${client.phone}`.toLowerCase().includes(term);
    });
  }

  loadClients() {
    const requestId = ++this.clientsRequestId;
    this.clientsAbort?.abort();
    const abortController = new AbortController();
    this.clientsAbort = abortController;
    this.clientsStatus.set('loading');
    this.api.get<unknown>('/admin/users', { search: this.search }, { noCache: true, abortSignal: abortController.signal }).pipe(
      finalize(() => {
        if (requestId === this.clientsRequestId) {
          if (this.clientsStatus() === 'loading') this.clientsStatus.set('error');
          this.clientsAbort = null;
        }
      })
    ).subscribe({
      next: response => {
        if (requestId !== this.clientsRequestId) return;
        const value = response as any;
        const clients = Array.isArray(response) ? response : value?.users ?? value?.data?.users ?? [];
        this.clients = Array.isArray(clients) ? clients : [];
        this.clientsStatus.set('success');
      },
      error: error => {
        if (requestId !== this.clientsRequestId) return;
        console.error('[clientes] load error', error);
        this.clientsStatus.set('error');
        this.showNotice(error.error?.message ?? 'No pudimos cargar los clientes.', true);
      }
    });
  }

  count(status: ClientStatus) { return this.clientRows.filter(client => this.matchesTab(client, status)).length; }

  matchesTab(client: Client, status: ClientStatus) {
    if (status === 'all') return true;
    if (status === 'pending') return client.active && !client.phoneVerified && !client.isBlocked;
    if (status === 'confirmed') return client.active && client.phoneVerified && !client.isBlocked;
    if (status === 'inactive') return !client.active;
    if (status === 'blocked') return client.isBlocked;
    return true;
  }

  statusLabel(client: Client) {
    if (!client.active) return 'Desactivado';
    if (client.isBlocked) return 'Bloqueado';
    if (!client.phoneVerified) return 'Pendiente';
    return 'Confirmado';
  }

  statusClass(client: Client) {
    if (!client.active) return 'inactive';
    if (client.isBlocked) return 'blocked';
    if (!client.phoneVerified) return 'pending';
    return 'confirmed';
  }

  initials(client: Client) { return `${client.firstName?.[0] ?? ''}${client.lastName?.[0] ?? ''}`.toUpperCase() || 'CL'; }

  openCreate() {
    this.editingClient = null;
    this.form = { firstName: '', lastName: '', phone: '', password: '' };
    this.formError = '';
    this.showForm = true;
  }

  openEdit(client: Client) {
    this.editingClient = client;
    this.form = { firstName: client.firstName, lastName: client.lastName };
    this.formError = '';
    this.showForm = true;
  }

  closeForm() {
    if (this.saving()) return;
    this.showForm = false;
    this.editingClient = null;
    this.formError = '';
  }

  saveForm() {
    this.formError = '';
    if (!this.form.firstName?.trim() || !this.form.lastName?.trim()) {
      this.formError = 'Completá nombre y apellido.';
      return;
    }
    if (!this.editingClient && (!this.form.phone?.trim() || !this.form.password || this.form.password.length < 8)) {
      this.formError = 'Completá teléfono y una contraseña de al menos 8 caracteres.';
      return;
    }
    this.saving.set(true);
    const request = this.editingClient
      ? this.api.patch<Client>(`/admin/users/${this.editingClient.id}`, { firstName: this.form.firstName.trim(), lastName: this.form.lastName.trim() })
      : this.api.post<Client>('/admin/users', { firstName: this.form.firstName.trim(), lastName: this.form.lastName.trim(), phone: this.form.phone.trim(), password: this.form.password });
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: client => {
        const wasEditing = !!this.editingClient;
        if (wasEditing) this.clients = this.clients.map(item => item.id === client.id ? client : item);
        else this.clients = [client, ...this.clients];
        this.showForm = false;
        this.editingClient = null;
        this.activeTab = 'confirmed';
        this.showNotice(wasEditing ? 'Cliente actualizado correctamente.' : 'Cliente agregado correctamente.');
      },
      error: error => { this.formError = error.error?.message ?? 'No pudimos guardar el cliente.'; }
    });
  }

  verifyClient(client: Client) {
    if (!client.id || this.savingClientId() !== null) return;
    this.savingClientId.set(client.id);
    this.api.patch<Client>(`/admin/users/${client.id}/verify`, {}).pipe(
      finalize(() => this.savingClientId.set(null))
    ).subscribe({
      next: updated => { this.replaceClient({ ...client, ...updated, phoneVerified: true }); this.showNotice('Usuario verificado.'); },
      error: error => this.showNotice(error.error?.message ?? 'No se pudo verificar el usuario.', true)
    });
  }

  setActive(client: Client, active: boolean) {
    if (!client.id || this.savingClientId() !== null) return;
    this.savingClientId.set(client.id);
    this.api.patch<Client>(`/admin/users/${client.id}`, { active }).pipe(
      finalize(() => this.savingClientId.set(null))
    ).subscribe({
      next: updated => { this.replaceClient({ ...client, ...updated, active }); this.showNotice(active ? 'Cliente reactivado.' : 'Cliente desactivado. Conservamos su historial.'); },
      error: error => this.showNotice(error.error?.message ?? 'No pudimos actualizar el cliente. Intentá nuevamente.', true)
    });
  }

  setBlocked(client: Client, isBlocked: boolean) {
    if (!client.id || this.savingClientId() !== null) return;
    this.savingClientId.set(client.id);
    this.api.patch<Client>(`/admin/users/${client.id}`, { isBlocked }).pipe(
      finalize(() => this.savingClientId.set(null))
    ).subscribe({
      next: updated => { this.replaceClient({ ...client, ...updated, isBlocked }); this.showNotice(isBlocked ? 'Cliente bloqueado.' : 'Cliente desbloqueado.'); },
      error: error => this.showNotice(error.error?.message ?? 'No pudimos actualizar el cliente. Intentá nuevamente.', true)
    });
  }

  askCancelPending(client: Client) {
    this.confirmDialog = {
      type: 'cancelPending',
      target: client,
      title: 'Cancelar usuario pendiente',
      message: `¿Querés cancelar el registro pendiente de ${client.firstName} ${client.lastName}?`,
      secondaryMessage: 'El número quedará disponible para que otra persona pueda registrarse.',
      confirmText: 'Sí, cancelar',
      loadingText: 'Cancelando...'
    };
    this.confirmError = '';
  }

  askDeactivate(client: Client) {
    this.confirmDialog = {
      type: 'deactivate',
      target: client,
      title: 'Desactivar cliente',
      message: `¿Querés desactivar a ${client.firstName} ${client.lastName}?`,
      secondaryMessage: 'No se borra su historial ni sus turnos. La cuenta no podrá iniciar sesión hasta reactivarla.',
      confirmText: 'Sí, desactivar',
      loadingText: 'Desactivando...'
    };
    this.confirmError = '';
  }

  askReleasePhone(client: Client) {
    this.confirmDialog = {
      type: 'releasePhone',
      target: client,
      title: 'Liberar número',
      message: `¿Querés cerrar la cuenta de ${client.firstName} ${client.lastName} y liberar su número?`,
      secondaryMessage: 'La cuenta será anonimizada, conservará su historial y no podrá reactivarse. Después se podrá registrar una cuenta nueva con ese número.',
      confirmText: 'Sí, liberar número',
      loadingText: 'Liberando...'
    };
    this.confirmError = '';
  }

  closeConfirmDialog() {
    if (this.confirmLoading()) return;
    this.confirmDialog = null;
    this.confirmError = '';
  }

  confirmDialogConfirmed() {
    if (!this.confirmDialog || this.confirmLoading()) return;
    if (this.confirmDialog.type === 'cancelPending') this.confirmCancelPending(this.confirmDialog.target);
    else if (this.confirmDialog.type === 'releasePhone') this.confirmReleasePhone(this.confirmDialog.target);
    else this.confirmDeactivate(this.confirmDialog.target);
  }

  private confirmCancelPending(client: Client) {
    this.confirmLoading.set(true);
    this.confirmError = '';
    this.api.delete<any>(`/admin/users/${client.id}/pending-verification`).pipe(
      finalize(() => this.confirmLoading.set(false))
    ).subscribe({
      next: () => {
        this.clients = this.clients.filter(item => item.id !== client.id);
        this.confirmDialog = null;
        this.showNotice('Usuario pendiente cancelado. El número ya está disponible.');
      },
      error: () => { this.confirmError = 'No pudimos cancelar el usuario pendiente. Intentá nuevamente.'; }
    });
  }

  private confirmDeactivate(client: Client) {
    this.confirmLoading.set(true);
    this.confirmError = '';
    this.api.patch<Client>(`/admin/users/${client.id}`, { active: false }).pipe(
      finalize(() => this.confirmLoading.set(false))
    ).subscribe({
      next: updated => {
        this.replaceClient({ ...client, ...updated, active: false });
        this.confirmDialog = null;
        this.showNotice('Cliente desactivado. Conservamos su historial.');
      },
      error: () => { this.confirmError = 'No pudimos actualizar el cliente. Intentá nuevamente.'; }
    });
  }

  private confirmReleasePhone(client: Client) {
    this.confirmLoading.set(true);
    this.confirmError = '';
    this.api.post<any>(`/admin/users/${client.id}/release-phone`, { confirmation: 'LIBERAR' }).pipe(
      finalize(() => this.confirmLoading.set(false))
    ).subscribe({
      next: () => {
        this.clients = this.clients.filter(item => item.id !== client.id);
        this.confirmDialog = null;
        this.showNotice('Cuenta cerrada. El número ya está disponible para un registro nuevo.');
      },
      error: error => { this.confirmError = error.error?.message ?? 'No pudimos liberar el número.'; }
    });
  }

  private replaceClient(client: Client) { this.clients = this.clients.map(item => item.id === client.id ? client : item); }

  private showNotice(message: string, error = false) {
    this.notice = message;
    this.noticeError = error;
  }
}
