import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../core/api';
import { RealtimeService } from '../../core/realtime';
import { InstagramContentPage } from './instagram-content-page';

const leaguePayload: any = {
  league: { id: 1, name: 'Liga Suma 12', seasonYear: 2026, updatedAt: '2026-08-14T12:00:00Z' },
  zones: [
    { id: 10, code: 'A', name: 'Zona A', regularDay: 'LUNES', pairs: [] },
    { id: 20, code: 'B', name: 'Zona B', regularDay: 'JUEVES', pairs: [] }
  ],
  matches: [
    { id: 101, code: 'A-F1-M1', stage: 'GROUP_STAGE', matchday: 1, scheduledDate: '2026-08-19', zone: { id: 10, code: 'A', name: 'Zona A' }, homePair: { displayName: 'Apellido Largo - Otro Apellido' }, awayPair: { displayName: 'Tercero - Cuarto' }, result: null },
    { id: 201, code: 'B-F1-M1', stage: 'GROUP_STAGE', matchday: 1, scheduledDate: '2026-08-20', zone: { id: 20, code: 'B', name: 'Zona B' }, homePair: { displayName: 'Quinto - Sexto' }, awayPair: { displayName: 'Séptimo - Octavo' }, result: null }
  ],
  standings: [], bracket: [], summary: {}, rules: {}
};

describe('InstagramContentPage', () => {
  let fixture: ComponentFixture<InstagramContentPage>;
  let api: { get: ReturnType<typeof vi.fn>; getBlob: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    api = {
      get: vi.fn((path: string) => {
        if (path === '/admin/leagues') return of([{ id: 1, name: 'Liga Suma 12', seasonYear: 2026, status: 'ACTIVE' }]);
        if (path === '/admin/leagues/1') return of(leaguePayload);
        if (path.endsWith('/instagram/manifest')) return of({
          template: 'weekly_fixture', format: 'feed', width: 1080, height: 1350,
          description: 'Liga Suma 12 · Fecha 1\nTexto editable', zipFileName: 'liga-suma12-fecha-1-carrusel.zip',
          sourceUpdatedAt: '2026-08-14T12:00:00Z',
          pages: [{ index: 0, id: 'portada', label: 'Portada', fileName: '01-portada.png', warnings: [] }]
        });
        return of(null);
      }),
      getBlob: vi.fn(() => of(new Blob(['png'], { type: 'image/png' })))
    };
    await TestBed.configureTestingModule({
      imports: [InstagramContentPage],
      providers: [
        provideZonelessChangeDetection(), provideRouter([]),
        { provide: Api, useValue: api },
        { provide: RealtimeService, useValue: { listen: () => NEVER, resync$: NEVER } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(InstagramContentPage);
  });

  afterEach(() => { fixture?.destroy(); vi.restoreAllMocks(); });

  it('carga la temporada activa y previsualiza el PNG generado por el backend', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(component.selectedLeagueId).toBe(1);
    expect(component.matchday).toBe(1);
    expect(component.caption).toContain('Texto editable');
    expect(component.previewUrl()).toBe('blob:preview');
    expect(api.getBlob).toHaveBeenCalledWith(
      '/admin/leagues/1/instagram/render',
      expect.objectContaining({ template: 'weekly_fixture', format: 'feed', matchday: 1, page: 0 }),
      expect.anything()
    );
    expect(fixture.nativeElement.textContent).toContain('Contenido para Instagram');
    expect(fixture.nativeElement.textContent).toContain('Descargar carrusel ZIP');
  });

  it('cambia a Historia y vuelve a pedir una salida 1080 × 1920', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.setFormat('story');
    await fixture.whenStable();
    expect(api.get).toHaveBeenLastCalledWith(
      '/admin/leagues/1/instagram/manifest',
      expect.objectContaining({ format: 'story' }),
      expect.anything()
    );
  });

  it('Hoy juegan envía el día elegido sin limitar por zona ni número de fecha', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.selectTemplate('today');
    await fixture.whenStable();

    expect(component.showZoneSelector()).toBe(false);
    expect(component.showMatchdaySelector()).toBe(false);
    expect(api.get).toHaveBeenLastCalledWith(
      '/admin/leagues/1/instagram/manifest',
      expect.objectContaining({ template: 'today', format: 'story', scheduledDate: component.scheduledDate }),
      expect.anything()
    );
  });

  it('muestra el motivo real cuando el backend no puede generar la vista previa', async () => {
    api.getBlob.mockReturnValue(throwError(() => ({
      error: new Blob([JSON.stringify({ message: 'No hay partidos cargados para la fecha seleccionada.' })], { type: 'application/json' })
    })));

    fixture.detectChanges();
    await fixture.whenStable();

    await vi.waitFor(() => expect(fixture.componentInstance.previewError()).toBe('No hay partidos cargados para la fecha seleccionada.'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No se pudo generar');
    expect(fixture.nativeElement.textContent).toContain('No hay partidos cargados para la fecha seleccionada.');
  });

  it('descarga PNG y ZIP con los nombres del manifiesto y copia la descripción editable', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const saveBlob = vi.spyOn(component as any, 'saveBlob').mockImplementation(() => undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    component.downloadPng();
    component.downloadZip();
    await component.copyCaption();

    expect(api.getBlob).toHaveBeenCalledWith(
      '/admin/leagues/1/instagram/render',
      expect.objectContaining({ page: 0, download: 1 }),
      expect.anything()
    );
    expect(api.getBlob).toHaveBeenCalledWith(
      '/admin/leagues/1/instagram/carousel.zip',
      expect.objectContaining({ template: 'weekly_fixture', format: 'feed' }),
      expect.anything()
    );
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), '01-portada.png');
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'liga-suma12-fecha-1-carrusel.zip');
    expect(writeText).toHaveBeenCalledWith('Liga Suma 12 · Fecha 1\nTexto editable');
    expect(component.copied()).toBe(true);
  });
});
