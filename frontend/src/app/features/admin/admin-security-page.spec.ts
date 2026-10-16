import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../../core/api';
import { AdminSecurityPage } from './admin-security-page';

describe('AdminSecurityPage', () => {
  it('ya no presenta aprobación manual ni recuperación por WhatsApp', async () => {
    const api = { get: vi.fn(() => of([])) };
    await TestBed.configureTestingModule({ imports: [AdminSecurityPage], providers: [provideZonelessChangeDetection(), { provide: Api, useValue: api }] }).compileComponents();
    const fixture = TestBed.createComponent(AdminSecurityPage); fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('ya no validan cuentas ni recuperaciones');
    expect(fixture.nativeElement.textContent).not.toContain('Aprobar');
    expect(fixture.nativeElement.textContent).not.toContain('VAL-');
  });
});
