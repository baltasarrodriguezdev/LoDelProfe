import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../core/api';
import { AdminSecurityPage } from './admin-security-page';

describe('AdminSecurityPage', () => {
  let fixture: ComponentFixture<AdminSecurityPage>;

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it('actualiza la lista cuando aparece una nueva solicitud de validación', async () => {
    let pendingUsers: any[] = [];
    const api = {
      get: vi.fn((path: string) => of(path === '/admin/users/pending-verification' ? pendingUsers : []))
    };

    await TestBed.configureTestingModule({
      imports: [AdminSecurityPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Api, useValue: api }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSecurityPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No hay usuarios pendientes');

    pendingUsers = [{
      id: 16,
      firstName: 'Baltasar',
      lastName: 'Loco',
      phone: '3576528909',
      verificationCode: 'VAL-A1B2C3D4',
      createdAt: '2026-07-25T15:48:29.976Z'
    }];
    fixture.componentInstance.loadUsers();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Baltasar Loco');
    expect(fixture.nativeElement.textContent).toContain('VAL-A1B2C3D4');
  });
});
