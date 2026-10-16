import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Auth } from '../../core/api';
import { AuthPage } from './auth-page';

describe('AuthPage zoneless', () => {
  it('rehabilita el botón y muestra el error después de un login rechazado', async () => {
    const response = new Subject<any>();
    const auth = {
      login: vi.fn(() => response.asObservable()),
      register: vi.fn(() => response.asObservable())
    };
    const router = { url: '/ingresar', navigateByUrl: vi.fn(), navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AuthPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } }
        }
      ]
    }).compileComponents();

    const fixture: ComponentFixture<AuthPage> = TestBed.createComponent(AuthPage);
    fixture.componentInstance.form = { email: 'ana@example.com', password: 'incorrecta' };
    fixture.detectChanges();

    fixture.componentInstance.submit();
    await fixture.whenStable();
    let submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    expect(submitButton.textContent).toContain('Procesando...');

    response.error({ status: 401, error: { message: 'Email o contraseña incorrectos' } });
    await fixture.whenStable();

    submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(submitButton.disabled).toBe(false);
    expect(submitButton.textContent).toContain('Ingresar');
    expect(fixture.nativeElement.textContent).toContain('Email o contraseña incorrectos');
  });
});
