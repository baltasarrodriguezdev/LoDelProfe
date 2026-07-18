import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../../core/api';
import { AdminStatsPage } from './admin-stats-page';
import { InstagramStoriesPage } from './instagram-stories-page';

registerLocaleData(localeEsAr);

describe('estados administrativos zoneless', () => {
  it('actualiza las tres cargas del panel de estadísticas', async () => {
    const dashboardResponse = new Subject<any>();
    const availabilityResponse = new Subject<any>();
    const agendaResponse = new Subject<any>();
    const api = {
      get: vi.fn((path: string) => {
        if (path === '/admin/dashboard') return dashboardResponse.asObservable();
        if (path === '/availability') return availabilityResponse.asObservable();
        return agendaResponse.asObservable();
      })
    };

    await TestBed.configureTestingModule({
      imports: [AdminStatsPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Api, useValue: api }
      ]
    }).compileComponents();

    const fixture: ComponentFixture<AdminStatsPage> = TestBed.createComponent(AdminStatsPage);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.loading()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Calculando estadísticas...');

    dashboardResponse.next({
      summary: {
        totalBookings: 0,
        activeBookings: 0,
        occupancyRate: 0,
        cancelledCount: 0,
        cancellationRate: 0,
        noShowCount: 0,
        blockedHours: 0,
        newClients: 0
      },
      finance: {
        income: 0,
        expense: 0,
        balance: 0,
        pendingPaymentCount: 0,
        pendingAmount: 0,
        partialPaymentCount: 0
      },
      byDay: [],
      byStatus: [],
      popularHours: [],
      durations: []
    });
    dashboardResponse.complete();
    availabilityResponse.next({ slots: [] });
    availabilityResponse.complete();
    agendaResponse.next([]);
    agendaResponse.complete();
    await fixture.whenStable();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.dashboardStatus()).toBe('success');
    expect(fixture.componentInstance.availabilityStatus()).toBe('success');
    expect(fixture.componentInstance.agendaStatus()).toBe('success');
    expect(fixture.nativeElement.textContent).not.toContain('Calculando estadísticas...');
  });

  it('sale de Preparando cuando termina la descarga de una historia', async () => {
    await TestBed.configureTestingModule({
      imports: [InstagramStoriesPage],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: Api, useValue: { get: vi.fn(() => of({ slots: [] })) } }
      ]
    }).compileComponents();

    const fixture: ComponentFixture<InstagramStoriesPage> = TestBed.createComponent(InstagramStoriesPage);
    const component = fixture.componentInstance;
    let finishDrawing!: () => void;
    const drawing = new Promise<void>(resolve => { finishDrawing = resolve; });
    const canvas = { toDataURL: vi.fn(() => 'data:image/png;base64,test') };
    (component as any).storyCanvas = { nativeElement: canvas };
    vi.spyOn(component as any, 'drawStory').mockReturnValue(drawing);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    component.downloadStory();
    expect(component.downloading()).toBe(true);
    finishDrawing();
    await drawing;
    await fixture.whenStable();

    expect(component.downloading()).toBe(false);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
  });
});
