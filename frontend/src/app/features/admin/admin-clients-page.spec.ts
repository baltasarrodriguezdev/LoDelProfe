import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../../core/api';
import { AdminClientsPage } from './admin-clients-page';

describe('AdminClientsPage zoneless', () => {
  it('rehabilita Guardar y presenta el error después de una respuesta fallida', async () => {
    const saveResponse = new Subject<any>();
    const api = {
      get: vi.fn(() => of([])),
      post: vi.fn(() => saveResponse.asObservable()),
      patch: vi.fn(() => saveResponse.asObservable()),
      delete: vi.fn(() => of({}))
    };

    await TestBed.configureTestingModule({
      imports: [AdminClientsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Api, useValue: api }
      ]
    }).compileComponents();

    const fixture: ComponentFixture<AdminClientsPage> = TestBed.createComponent(AdminClientsPage);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.openCreate();
    fixture.componentInstance.form = {
      firstName: 'Ana',
      lastName: 'Pérez',
      phone: '3515551234',
      password: 'clave-segura'
    };
    fixture.detectChanges();
    fixture.componentInstance.saveForm();
    await fixture.whenStable();

    let saveButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(fixture.componentInstance.saving()).toBe(true);
    expect(saveButton.disabled).toBe(true);
    expect(saveButton.textContent).toContain('Guardando...');

    saveResponse.error({ error: { message: 'No se pudo crear el cliente.' } });
    await fixture.whenStable();

    saveButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(fixture.componentInstance.saving()).toBe(false);
    expect(saveButton.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('No se pudo crear el cliente.');
  });

  it('rehabilita el diálogo de confirmación cuando falla la operación', async () => {
    const deleteResponse = new Subject<any>();
    const api = {
      get: vi.fn(() => of([])),
      post: vi.fn(() => of({})),
      patch: vi.fn(() => of({})),
      delete: vi.fn(() => deleteResponse.asObservable())
    };

    await TestBed.configureTestingModule({
      imports: [AdminClientsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Api, useValue: api }
      ]
    }).compileComponents();

    const fixture: ComponentFixture<AdminClientsPage> = TestBed.createComponent(AdminClientsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.confirmDialog = {
      type: 'cancelPending',
      target: { id: 9 } as any,
      title: 'Cancelar usuario',
      message: 'Confirmar cancelación',
      secondaryMessage: '',
      confirmText: 'Cancelar',
      loadingText: 'Cancelando...'
    };
    fixture.detectChanges();

    fixture.componentInstance.confirmDialogConfirmed();
    await fixture.whenStable();
    expect(fixture.componentInstance.confirmLoading()).toBe(true);

    deleteResponse.error({ status: 500 });
    await fixture.whenStable();

    expect(fixture.componentInstance.confirmLoading()).toBe(false);
    expect(fixture.componentInstance.confirmError).toContain('No pudimos cancelar');
  });

  it('distingue desactivar de liberar el número y exige la confirmación explícita', async () => {
    const api = {
      get: vi.fn(() => of([])),
      post: vi.fn(() => of({ message: 'Número disponible' })),
      patch: vi.fn(() => of({})),
      delete: vi.fn(() => of({}))
    };
    await TestBed.configureTestingModule({
      imports: [AdminClientsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Api, useValue: api }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminClientsPage);
    const client = { id: 18, firstName: 'Ana', lastName: 'Pérez', active: false } as any;
    fixture.componentInstance.clients = [client];
    fixture.componentInstance.askReleasePhone(client);
    fixture.componentInstance.confirmDialogConfirmed();
    await fixture.whenStable();

    expect(api.post).toHaveBeenCalledWith('/admin/users/18/release-phone', { confirmation: 'LIBERAR' });
    expect(fixture.componentInstance.clients).toEqual([]);
  });
});
