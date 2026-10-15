import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { PrivacyPolicyPage } from './privacy-policy-page';

describe('PrivacyPolicyPage', () => {
  it('expone la política completa y los datos del responsable', async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPolicyPage],
      providers: [provideZonelessChangeDetection(), provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(PrivacyPolicyPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const content = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('h1').getAttribute('aria-label')).toBe('Política de Privacidad');
    expect(content).toContain('Adrián Rodríguez Teruel');
    expect(content).toContain('Liga Suma 12');
    expect(content).toContain('WhatsApp');
    expect(content).toContain('15 de octubre de 2026');
    expect(fixture.nativeElement.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Política de Privacidad · Lo del Profe');

    fixture.destroy();
  });

  it('está registrada como ruta pública sin guard de autenticación', () => {
    const route = routes.find(item => item.path === 'politica-de-privacidad');
    expect(route).toBeDefined();
    expect(route?.canActivate).toBeUndefined();
    expect(route?.loadComponent).toBeTypeOf('function');
  });
});
