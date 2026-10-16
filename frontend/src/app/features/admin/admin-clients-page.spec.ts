import { NEVER, of } from 'rxjs';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../../core/api';
import { RealtimeService } from '../../core/realtime';
import { AdminClientsPage } from './admin-clients-page';

describe('AdminClientsPage con email', () => {
  it('distingue email pendiente sin ofrecer aprobación manual', async () => {
    const clients = [{ id: 1, firstName: 'Ana', lastName: 'Pérez', phone: '3576000000', email: 'ana@example.com', emailVerifiedAt: null, active: true, isBlocked: false, role: 'CLIENT' }];
    const api = { get: vi.fn(() => of(clients)), patch: vi.fn(() => of({})), post: vi.fn(() => of({})), delete: vi.fn(() => of({})) };
    await TestBed.configureTestingModule({ imports: [AdminClientsPage], providers: [provideZonelessChangeDetection(), provideRouter([]), { provide: Api, useValue: api }, { provide: RealtimeService, useValue: { listen: () => NEVER, poll$: () => NEVER } }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminClientsPage); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Email pendiente');
    expect(fixture.nativeElement.textContent).not.toContain('Comprobar identidad');
    expect(fixture.nativeElement.textContent).not.toContain('Agregar cliente');
  });
});
