import { Routes } from '@angular/router';
import { AuthPage } from './features/client/auth-page';
import { HomePage } from './features/client/home-page';
import { AvailabilityPage } from './features/client/availability-page';
import { BookingsPage } from './features/client/bookings-page';
import { AdminDashboardPage } from './features/admin/admin-dashboard-page';
import { AdminStatsPage } from './features/admin/admin-stats-page';
import { AdminBookingFormPage } from './features/admin/admin-booking-form-page';
import { AdminClientsPage } from './features/admin/admin-clients-page';
import { InstagramStoriesPage } from './features/admin/instagram-stories-page';
import { AdminAgendaPage } from './features/admin/admin-agenda-page';
import { AdminSettingsPage } from './features/admin/admin-settings-page';
import { adminGuard, authGuard, superAdminGuard } from './core/api';
import { PhoneVerificationPage } from './features/client/phone-verification-page';
import { PasswordRecoveryPage } from './features/client/password-recovery-page';
import { AdminSecurityPage } from './features/admin/admin-security-page';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'ingresar', component: AuthPage },
  { path: 'login', redirectTo: 'ingresar', pathMatch: 'full' },
  { path: 'registro', component: AuthPage },
  { path: 'validar-telefono', component: PhoneVerificationPage, canActivate: [authGuard] },
  { path: 'recuperar-contrasena', component: PasswordRecoveryPage },
  { path: 'restablecer-contrasena', component: PasswordRecoveryPage },
  { path: 'reservar', component: AvailabilityPage },
  { path: 'la-liga', loadComponent: () => import('./features/league/league-page').then(module => module.LeaguePage) },
  { path: 'confirmar-reserva', component: AvailabilityPage, canActivate: [authGuard] },
  { path: 'mis-turnos', component: BookingsPage, canActivate: [authGuard] },
  { path: 'historial', component: BookingsPage, canActivate: [authGuard] },
  { path: 'admin', component: AdminDashboardPage, canActivate: [adminGuard] },
  { path: 'admin/estadisticas', component: AdminStatsPage, canActivate: [superAdminGuard] },
  { path: 'admin/agenda-diaria', component: AdminAgendaPage, canActivate: [adminGuard] },
  { path: 'admin/agenda-semanal', component: AdminAgendaPage, canActivate: [adminGuard] },
  { path: 'admin/turno', component: AdminBookingFormPage, canActivate: [adminGuard] },
  { path: 'admin/turnos-fijos', component: AdminSettingsPage, canActivate: [superAdminGuard] },
  { path: 'admin/precios', component: AdminSettingsPage, canActivate: [superAdminGuard] },
  { path: 'admin/horarios', component: AdminSettingsPage, canActivate: [superAdminGuard] },
  { path: 'admin/politicas', component: AdminSettingsPage, canActivate: [superAdminGuard] },
  { path: 'admin/caja', component: AdminSettingsPage, canActivate: [superAdminGuard] },
  { path: 'admin/clientes', component: AdminClientsPage, canActivate: [superAdminGuard] },
  { path: 'admin/seguridad', component: AdminSecurityPage, canActivate: [superAdminGuard] },
  { path: 'admin/marketing/historias-instagram', component: InstagramStoriesPage, canActivate: [adminGuard] },
  { path: 'admin/la-liga', loadComponent: () => import('./features/league/admin-league-page').then(module => module.AdminLeaguePage), canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
