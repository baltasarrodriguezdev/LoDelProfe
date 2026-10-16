import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../core/api';
import { RealtimeService } from '../../core/realtime';
import { LeaguePage } from './league-page';

const payload: any = {
  league: {
    id: 1, slug: 'liga-suma-12-2026', name: 'Liga Suma 12', seasonYear: 2026, status: 'ACTIVE', currentStage: 'ROUND_OF_16',
    court: null, timezone: 'America/Argentina/Cordoba', bestOfSets: 3, fullThirdSet: true, allPairsAdvance: true,
    registrationFee: 60000, firstPrize: 'Efectivo + Trofeos', secondPrize: 'Efectivo + Trofeos',
    ballAvailabilityNote: 'Pelotas disponibles en cantina.', scheduleNote: 'Zona A los lunes y Zona B los jueves.',
    activeFrom: '2026-08-17', activeUntil: null, createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-10-16T00:00:00Z'
  },
  zones: [], matches: [], standings: [],
  bracket: [{
    stage: 'ROUND_OF_16', matches: [{
      id: 1, code: 'P1', stage: 'ROUND_OF_16', matchday: null, zone: null, scheduledDate: '2026-10-03', scheduledTime: '14:00',
      status: 'SCHEDULED', official: false, officialAt: null, homePair: null, awayPair: null,
      homePlaceholder: '1.º Zona A', awayPlaceholder: '8.º Zona B', sets: [], result: null, scoringPending: false,
      rescheduleNote: null, updatedAt: '2026-10-16T00:00:00Z'
    }]
  }],
  summary: { nextMatchday: null, upcomingMatches: [], latestResults: [] },
  rules: {
    scoring: {
      straightSetsWinPoints: 3, threeSetsWinPoints: 2, threeSetsLossPoints: 1, straightSetsLossPoints: 0,
      gamesPositiveDefinition: 'Games a favor − games en contra'
    },
    tieBreakCriteria: ['Puntos', 'Partido entre sí', 'Sets a favor'],
    pending: ['Walkover o ausencia.']
  }
};

describe('LeaguePage', () => {
  let fixture: ComponentFixture<LeaguePage>;

  beforeEach(async () => {
    vi.stubGlobal('scrollTo', vi.fn());
    await TestBed.configureTestingModule({
      imports: [LeaguePage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: Api, useValue: { get: () => of(payload) } },
        { provide: RealtimeService, useValue: { listen: () => NEVER, poll$: () => NEVER } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(LeaguePage);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => { fixture.destroy(); vi.unstubAllGlobals(); });

  it('muestra los cruces eliminatorios definidos por posición de zona', async () => {
    fixture.componentInstance.openTab('bracket');
    fixture.detectChanges();
    await fixture.whenStable();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Cruces eliminatorios');
    expect(text).toContain('1.º Zona A');
    expect(text).toContain('8.º Zona B');
  });

  it('publica el cronograma final y los pases directos por abandono', () => {
    const page = fixture.componentInstance;
    const match = (code: string, stage: string): any => ({ code, stage, homePair: null, awayPair: null });

    expect(page.matchScheduleLabel(match('P4', 'ROUND_OF_16'))).toBe('Desde el 18/10 hasta el 31/10');
    expect(page.matchScheduleLabel(match('C2', 'QUARTERFINAL'))).toBe('Desde el 18/10 hasta el 31/10');
    expect(page.matchScheduleLabel(match('S1', 'SEMIFINAL'))).toBe('1/11 · 19:00');
    expect(page.matchScheduleLabel(match('S2', 'SEMIFINAL'))).toBe('1/11 · 20:00');
    expect(page.matchScheduleLabel(match('F1', 'FINAL'))).toBe('1/11 · 21:00');
    expect(page.isWithdrawnPair('Auger - Martinez')).toBe(true);
    expect(page.isWithdrawnPair('Prunesti - Britos')).toBe(true);
    expect(page.bracketPairLabel(match('C2', 'QUARTERFINAL'), 'AWAY')).toBe('Vaca - Arrieta');
    expect(page.bracketPairLabel(match('C3', 'QUARTERFINAL'), 'HOME')).toBe('Rodriguez Teruel - Ponce');
  });
});
