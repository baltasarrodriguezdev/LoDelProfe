import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, merge } from 'rxjs';
import { Api } from '../../core/api';
import { RealtimeEvent, RealtimeService } from '../../core/realtime';
import type { LeagueMatch, LeaguePayload } from './league.models';
import type { InstagramFormat, InstagramManifest, InstagramTemplate } from './instagram-content.models';

type LeagueSummary = { id: number; name: string; seasonYear: number; status: string };

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="instagram-admin page-shell">
      <header class="instagram-head">
        <div>
          <span class="eyebrow">LIGA SUMA 12 · HERRAMIENTAS DE COMUNICACIÓN</span>
          <h1>Contenido para Instagram</h1>
          <p>Elegí la publicación. Los nombres, horarios, estados, resultados y posiciones vienen de La Liga.</p>
        </div>
        <button type="button" class="refresh-button" [disabled]="loading()" (click)="regenerate()">
          <span aria-hidden="true">↻</span> Regenerar con datos actuales
        </button>
      </header>

      @if (notice()) {
        <div class="instagram-notice" [class.error]="noticeError()" role="status">{{ notice() }}</div>
      }

      <div class="studio-layout">
        <aside class="studio-controls" aria-label="Configuración de la placa">
          <section class="control-block">
            <span class="control-number">01</span>
            <div><strong>Fuente de datos</strong><small>No se vuelve a escribir información deportiva.</small></div>
            <label>Temporada
              <select [(ngModel)]="selectedLeagueId" (ngModelChange)="selectLeague($event)">
                @for (league of leagues(); track league.id) {
                  <option [ngValue]="league.id">{{ league.name }} {{ league.seasonYear }} · {{ league.status }}</option>
                }
              </select>
            </label>
          </section>

          <section class="control-block">
            <span class="control-number">02</span>
            <div><strong>Tipo de placa</strong><small>Una familia visual, distintos momentos de la competencia.</small></div>
            <div class="template-list">
              @for (option of templateOptions; track option.id) {
                <button type="button" [class.active]="template === option.id" (click)="selectTemplate(option.id)">
                  <span>{{ option.label }}</span><small>{{ option.help }}</small>
                </button>
              }
            </div>
          </section>

          <section class="control-block">
            <span class="control-number">03</span>
            <div><strong>Datos vinculados</strong><small>Las opciones cambian según la plantilla.</small></div>
            @if (showZoneSelector()) {
              <label>Zona
                <select [(ngModel)]="zoneId" (ngModelChange)="selectionChanged()">
                  @for (zone of leagueData()?.zones ?? []; track zone.id) { <option [ngValue]="zone.id">{{ zone.name }} · {{ zone.regularDay || 'Día variable' }}</option> }
                </select>
              </label>
            }
            @if (showMatchdaySelector()) {
              <label>Fecha o ronda
                <select [(ngModel)]="matchday" (ngModelChange)="selectionChanged()">
                  @for (round of availableMatchdays(); track round) { <option [ngValue]="round">Fecha {{ round }}</option> }
                </select>
              </label>
            }
            @if (template === 'today' || template === 'today_results') {
              <label>Día de los partidos
                <select [(ngModel)]="scheduledDate" (ngModelChange)="selectionChanged()">
                  @for (date of dailyDates(); track date) { <option [ngValue]="date">{{ dailyDateLabel(date) }}</option> }
                </select>
                <small>{{ template === 'today_results' ? 'Usa el día real del partido y sólo resultados cargados.' : 'Cada partido muestra su propia fecha, zona y horario, aunque el día mezcle jornadas.' }}</small>
              </label>
            }
            @if (showMatchSelector()) {
              <label>Partido
                <select [(ngModel)]="matchId" (ngModelChange)="selectionChanged()">
                  @for (match of selectableMatches(); track match.id) {
                    <option [ngValue]="match.id">{{ matchLabel(match) }}</option>
                  }
                </select>
              </label>
            }
          </section>

          <section class="control-block compact">
            <span class="control-number">04</span>
            <div><strong>Formato</strong><small>Medidas exactas para Instagram.</small></div>
            <div class="format-switch" role="group" aria-label="Formato de exportación">
              <button type="button" [class.active]="format === 'feed'" (click)="setFormat('feed')"><b>Feed</b><small>1080 × 1350 · 4:5</small></button>
              <button type="button" [class.active]="format === 'story'" (click)="setFormat('story')"><b>Historia</b><small>1080 × 1920 · 9:16</small></button>
            </div>
          </section>
        </aside>

        <main class="studio-preview">
          <header class="preview-head">
            <div><span class="eyebrow">VISTA PREVIA FIEL</span><h2>{{ currentTemplateLabel() }}</h2></div>
            @if (manifest(); as currentManifest) {
              <span>{{ currentManifest.width }} × {{ currentManifest.height }} px</span>
            }
          </header>

          @if (manifest()?.pages?.length) {
            <nav class="page-tabs" aria-label="Páginas de la publicación">
              @for (page of manifest()!.pages; track page.id) {
                <button type="button" [class.active]="pageIndex() === page.index" (click)="selectPage(page.index)">
                  <b>{{ page.index + 1 }}</b>{{ page.label }}
                </button>
              }
            </nav>
          }

          <div class="artboard-stage" [class.story]="format === 'story'">
            @if (previewUrl()) {
              <img [src]="previewUrl()" [alt]="'Vista previa ' + currentTemplateLabel()" (load)="previewLoaded.set(true)">
            } @else if (loading()) {
              <div class="preview-state"><span class="loader"></span><b>Generando la placa</b><small>Esperando fuentes, logo y datos.</small></div>
            } @else {
              <div class="preview-state"><b>{{ previewError() ? 'No se pudo generar' : 'Sin vista previa' }}</b><small>{{ previewError() || 'Elegí los datos requeridos por la plantilla.' }}</small></div>
            }
            @if (loading() && previewUrl()) { <div class="preview-refreshing">Actualizando…</div> }
          </div>

          @if (currentWarnings().length) {
            <div class="fit-warnings" role="status">
              <strong>Revisión de contenido</strong>
              @for (warning of currentWarnings(); track warning) { <span>{{ warning }}</span> }
            </div>
          }

          <div class="download-actions">
            <button type="button" class="btn primary" [disabled]="!previewUrl() || downloading()" (click)="downloadPng()">{{ downloading() ? 'Preparando…' : 'Descargar PNG' }}</button>
            @if (manifest()?.zipFileName) {
              <button type="button" class="btn secondary" [disabled]="downloading()" (click)="downloadZip()">Descargar carrusel ZIP</button>
            }
          </div>

          <section class="caption-editor">
            <header><div><span class="eyebrow">DESCRIPCIÓN SUGERIDA</span><h3>Texto para la publicación</h3></div><button type="button" (click)="copyCaption()">{{ copied() ? 'Copiado' : 'Copiar texto' }}</button></header>
            <textarea [(ngModel)]="caption" rows="7" aria-label="Descripción editable para Instagram"></textarea>
            <small>Podés editar este texto antes de copiarlo. No modifica los datos de la liga.</small>
          </section>
        </main>
      </div>
    </section>
  `,
  styles: [`
    :host{display:block}.instagram-admin{padding-bottom:80px}.instagram-head{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:30px}.instagram-head h1{max-width:780px;margin:6px 0 7px;font-size:4.7rem;line-height:.9}.instagram-head p{max-width:700px;margin:0}.refresh-button{display:flex;align-items:center;gap:9px;border:1px solid var(--color-brand-border);border-radius:999px;padding:12px 18px;background:var(--color-brand-paper);color:var(--color-brand-dark);font-weight:800}.refresh-button span{font-size:1.3rem}.instagram-notice{margin-bottom:18px;border-left:4px solid var(--color-brand-green);border-radius:8px;padding:12px 15px;background:#e7efe2;color:var(--color-brand-dark);font-size:.78rem;font-weight:700}.instagram-notice.error{border-left-color:var(--color-brand-danger);background:#fae5df;color:#7b2c23}.studio-layout{display:grid;grid-template-columns:minmax(300px,390px) minmax(0,1fr);gap:24px;align-items:start}.studio-controls{display:grid;gap:12px;position:sticky;top:132px}.control-block{display:grid;grid-template-columns:38px 1fr;gap:13px;border:1px solid var(--color-brand-border);border-radius:16px;padding:17px;background:var(--color-brand-paper);box-shadow:0 10px 35px rgba(24,43,29,.05)}.control-block>label,.control-block>.template-list,.control-block>.format-switch{grid-column:1/-1}.control-block label{display:grid;gap:6px;font-size:.68rem;font-weight:850;letter-spacing:.02em}.control-block select{width:100%}.control-block>div>strong{display:block;color:var(--color-brand-dark);font-size:.82rem}.control-block>div>small{display:block;margin-top:3px;color:var(--color-brand-muted);font-size:.66rem;line-height:1.4}.control-number{display:grid;width:34px;height:34px;place-content:center;border-radius:50%;background:var(--color-brand-dark);color:var(--color-brand-cream);font-family:var(--font-display);font-size:.78rem}.template-list{display:grid;grid-template-columns:1fr 1fr;gap:7px}.template-list button{display:grid;gap:3px;min-height:67px;border:1px solid var(--color-brand-border);border-radius:10px;padding:10px;background:#faf8ef;text-align:left}.template-list button.active{border-color:var(--color-brand-green);background:#e9eee4;box-shadow:inset 3px 0 var(--color-brand-green)}.template-list span{color:var(--color-brand-dark);font-size:.71rem;font-weight:850}.template-list small{color:var(--color-brand-muted);font-size:.57rem;line-height:1.25}.format-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px}.format-switch button{display:grid;gap:2px;border:1px solid var(--color-brand-border);border-radius:11px;padding:11px;background:#faf8ef;color:var(--color-brand-dark);text-align:left}.format-switch button.active{border-color:var(--color-brand-green);background:var(--color-brand-dark);color:var(--color-brand-paper)}.format-switch small{font-size:.58rem;opacity:.7}.studio-preview{min-width:0;border:1px solid var(--color-brand-border);border-radius:20px;padding:24px;background:#ede9dc}.preview-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px}.preview-head h2{margin:4px 0 0;font-size:2.4rem}.preview-head>span{border-radius:999px;padding:8px 12px;background:var(--color-brand-paper);color:var(--color-brand-green);font-size:.67rem;font-weight:850}.page-tabs{display:flex;gap:7px;overflow-x:auto;margin-bottom:14px;padding-bottom:2px}.page-tabs button{display:flex;align-items:center;gap:7px;flex:0 0 auto;border:1px solid var(--color-brand-border);border-radius:999px;padding:7px 12px 7px 7px;background:var(--color-brand-paper);font-size:.67rem;font-weight:800}.page-tabs b{display:grid;width:25px;height:25px;place-content:center;border-radius:50%;background:#e4e7dc;color:var(--color-brand-green)}.page-tabs button.active{border-color:var(--color-brand-green);background:var(--color-brand-dark);color:#fff}.page-tabs button.active b{background:var(--color-brand-gold);color:#fff}.artboard-stage{display:grid;position:relative;min-height:620px;place-items:center;border-radius:16px;padding:22px;background:#17251b;overflow:hidden}.artboard-stage:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px);background-size:28px 28px}.artboard-stage img{display:block;position:relative;width:auto;max-width:100%;height:auto;max-height:720px;box-shadow:0 22px 65px rgba(0,0,0,.34)}.artboard-stage.story img{max-height:780px}.preview-state{display:grid;position:relative;place-items:center;gap:8px;color:#fff;text-align:center}.preview-state small{color:#aebaaf}.loader{width:35px;height:35px;border:3px solid rgba(255,255,255,.2);border-top-color:#bedf32;border-radius:50%;animation:spin .8s linear infinite}.preview-refreshing{position:absolute;right:14px;bottom:14px;border-radius:999px;padding:7px 11px;background:rgba(20,40,27,.88);color:#fff;font-size:.64rem;font-weight:800}.fit-warnings{display:grid;gap:5px;margin-top:13px;border-left:4px solid #bf8e26;border-radius:8px;padding:12px 14px;background:#fff2cd;color:#675019;font-size:.7rem}.fit-warnings strong{font-size:.75rem}.download-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.caption-editor{margin-top:17px;border-radius:14px;padding:18px;background:var(--color-brand-paper)}.caption-editor header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}.caption-editor h3{margin:3px 0;font-size:1.55rem}.caption-editor header button{border:0;border-radius:999px;padding:9px 13px;background:#e5eadf;color:var(--color-brand-green);font-size:.66rem;font-weight:850}.caption-editor textarea{width:100%;resize:vertical;line-height:1.55}.caption-editor>small{display:block;margin-top:7px;color:var(--color-brand-muted);font-size:.64rem}@keyframes spin{to{transform:rotate(360deg)}}
    @media(max-width:1050px){.studio-layout{grid-template-columns:1fr}.studio-controls{grid-template-columns:repeat(2,minmax(0,1fr));position:static}.control-block:nth-child(2){grid-row:span 2}.instagram-head{align-items:flex-start;flex-direction:column}.instagram-head h1{font-size:4rem}}
    @media(max-width:700px){.instagram-admin{padding-top:23px}.instagram-head h1{font-size:3.15rem}.instagram-head p{font-size:.78rem}.refresh-button{width:100%;justify-content:center}.studio-controls{grid-template-columns:1fr}.control-block:nth-child(2){grid-row:auto}.template-list{grid-template-columns:1fr 1fr}.studio-preview{margin-inline:-13px;border-radius:15px;padding:14px}.preview-head{align-items:flex-start;flex-direction:column}.preview-head h2{font-size:2rem}.artboard-stage{min-height:460px;padding:10px}.artboard-stage img,.artboard-stage.story img{max-height:620px}.download-actions{display:grid}.caption-editor header{align-items:flex-start;flex-direction:column}.caption-editor header button{width:100%}}
  `]
})
export class InstagramContentPage implements OnInit, OnDestroy {
  private readonly api = inject(Api);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly leagues = signal<LeagueSummary[]>([]);
  readonly leagueData = signal<LeaguePayload | null>(null);
  readonly manifest = signal<InstagramManifest | null>(null);
  readonly loading = signal(false);
  readonly downloading = signal(false);
  readonly copied = signal(false);
  readonly notice = signal('');
  readonly noticeError = signal(false);
  readonly pageIndex = signal(0);
  readonly previewUrl = signal('');
  readonly previewLoaded = signal(false);
  readonly previewError = signal('');
  private requestId = 0;
  private requestAbort: AbortController | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  selectedLeagueId: number | null = null;
  template: InstagramTemplate = 'weekly_fixture';
  format: InstagramFormat = 'feed';
  zoneId: number | null = null;
  matchday: number | null = null;
  matchId: number | null = null;
  scheduledDate: string | null = null;
  caption = '';

  readonly templateOptions: Array<{ id: InstagramTemplate; label: string; help: string }> = [
    { id: 'zones', label: 'Zonas', help: 'Portada + una página por zona' },
    { id: 'next_matchday', label: 'Próxima fecha', help: 'Fixture individual de una zona' },
    { id: 'weekly_fixture', label: 'Carrusel semanal', help: 'Portada + fechas de ambas zonas' },
    { id: 'today', label: 'Partidos por día', help: 'Hoy, mañana o el próximo día elegido' },
    { id: 'today_results', label: 'Resultados del día', help: 'Marcadores con la fecha real en Historia' },
    { id: 'featured_match', label: 'Partido destacado', help: 'Una previa individual con día y horario' },
    { id: 'rescheduled_match', label: 'Partido reprogramado', help: 'Comunica el nuevo día y horario' },
    { id: 'matchday_progress', label: 'Así va la fecha', help: 'Resultados cargados y partidos pendientes' },
    { id: 'individual_result', label: 'Resultado individual', help: 'Marcador completo de un partido' },
    { id: 'matchday_results', label: 'Resultados', help: 'Todos los partidos de la fecha' },
    { id: 'standings', label: 'Posiciones', help: 'Ocho filas legibles y actualizadas' },
    { id: 'results_standings', label: 'Fecha finalizada', help: 'Pack de resultados + tabla actualizada' },
    { id: 'bracket', label: 'Eliminatorias', help: 'Cruces y avance de parejas' },
    { id: 'champions', label: 'Campeones', help: 'Disponible tras la final oficial' }
  ];

  readonly availableMatchdays = computed(() => {
    const data = this.leagueData();
    if (!data) return [];
    const zoneId = this.zoneId ?? data.zones[0]?.id;
    return [...new Set(data.matches.filter(match => match.stage === 'GROUP_STAGE' && match.zone?.id === zoneId && match.matchday).map(match => match.matchday!))].sort((a, b) => a - b);
  });
  readonly resultMatches = computed(() => this.leagueData()?.matches.filter(match => match.result && match.homePair && match.awayPair) ?? []);
  readonly upcomingMatches = computed(() => this.leagueData()?.matches.filter(match => ['SCHEDULED', 'LIVE', 'RESCHEDULED'].includes(match.status) && match.homePair && match.awayPair) ?? []);
  readonly rescheduledMatches = computed(() => this.leagueData()?.matches.filter(match => match.status === 'RESCHEDULED' && match.homePair && match.awayPair) ?? []);
  readonly availableScheduledDates = computed(() => [...new Set(
    (this.leagueData()?.matches ?? []).filter(match => match.status !== 'SUSPENDED').map(match => match.scheduledDate).filter((date): date is string => Boolean(date))
  )].sort());
  readonly availableResultDates = computed(() => [...new Set(
    (this.leagueData()?.matches ?? []).filter(match => match.status === 'FINISHED' && Boolean(match.result)).map(match => match.scheduledDate).filter((date): date is string => Boolean(date))
  )].sort());
  readonly currentWarnings = computed(() => this.manifest()?.pages.find(page => page.index === this.pageIndex())?.warnings ?? []);

  ngOnInit() {
    this.loadLeagues();
    merge(this.realtime.listen(['LEAGUE_CHANGED']), this.realtime.resync$).pipe(
      debounceTime(180), takeUntilDestroyed(this.destroyRef)
    ).subscribe(change => {
      if (typeof change === 'object') {
        const event = change as RealtimeEvent;
        if (event.resource.leagueId && event.resource.leagueId !== this.selectedLeagueId) return;
      }
      if (this.selectedLeagueId) this.loadLeague(this.selectedLeagueId, true);
    });
  }

  ngOnDestroy() {
    ++this.requestId;
    this.requestAbort?.abort();
    this.revokePreview();
    if (this.copyTimer) clearTimeout(this.copyTimer);
  }

  loadLeagues() {
    this.loading.set(true);
    this.api.get<LeagueSummary[]>('/admin/leagues', undefined, { noCache: true }).subscribe({
      next: leagues => {
        this.leagues.set(leagues);
        const active = leagues.find(league => league.status === 'ACTIVE') ?? leagues[0];
        this.selectedLeagueId = active?.id ?? null;
        if (this.selectedLeagueId) this.loadLeague(this.selectedLeagueId);
        else { this.loading.set(false); this.showError('No hay temporadas configuradas.'); }
      },
      error: error => { this.loading.set(false); this.showError(error.error?.message ?? 'No se pudieron cargar las temporadas.'); }
    });
  }

  selectLeague(value: number) { if (value) this.loadLeague(Number(value)); }

  loadLeague(leagueId: number, preserveSelection = false) {
    this.loading.set(true);
    this.notice.set('');
    this.noticeError.set(false);
    this.previewError.set('');
    this.api.get<LeaguePayload>(`/admin/leagues/${leagueId}`, undefined, { noCache: true }).subscribe({
      next: data => {
        this.leagueData.set(data);
        if (!preserveSelection || !data.zones.some(zone => zone.id === this.zoneId)) this.zoneId = data.zones[0]?.id ?? null;
        this.normalizeSelection();
        this.loadManifest();
      },
      error: error => { this.loading.set(false); this.showError(error.error?.message ?? 'No se pudo cargar la temporada.'); }
    });
  }

  selectTemplate(value: InstagramTemplate) {
    this.template = value;
    if (['today', 'today_results', 'featured_match', 'rescheduled_match', 'matchday_progress'].includes(value)) this.format = 'story';
    if (value === 'champions' || value === 'individual_result') this.pageIndex.set(0);
    this.normalizeSelection();
    this.loadManifest();
  }

  setFormat(value: InstagramFormat) { this.format = value; this.pageIndex.set(0); this.loadManifest(); }
  selectionChanged() { this.normalizeSelection(); this.pageIndex.set(0); this.loadManifest(); }
  selectPage(index: number) { this.pageIndex.set(index); this.loadPreview(); }
  regenerate() { if (this.selectedLeagueId) this.loadLeague(this.selectedLeagueId, true); }

  showZoneSelector() { return ['next_matchday', 'matchday_progress', 'matchday_results', 'standings', 'results_standings'].includes(this.template); }
  showMatchdaySelector() { return ['next_matchday', 'weekly_fixture', 'matchday_progress', 'matchday_results', 'results_standings'].includes(this.template); }
  showMatchSelector() { return ['individual_result', 'featured_match', 'rescheduled_match'].includes(this.template); }
  currentTemplateLabel() { return this.templateOptions.find(option => option.id === this.template)?.label ?? 'Placa'; }
  matchLabel(match: LeagueMatch) { return `${match.zone?.name ?? this.stageLabel(match.stage)} · ${match.matchday ? `F${match.matchday}` : match.code} · ${match.homePair?.displayName} vs ${match.awayPair?.displayName}`; }
  dateLabel(value: string) { return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`)); }
  dailyDates() { return this.template === 'today_results' ? this.availableResultDates() : this.availableScheduledDates(); }
  dailyDateLabel(value: string) {
    const matches = (this.leagueData()?.matches ?? []).filter(match => match.scheduledDate === value && (this.template !== 'today_results' || (match.status === 'FINISHED' && Boolean(match.result))));
    const matchdays = [...new Set(matches.map(match => match.matchday).filter((round): round is number => Boolean(round)))].sort((a, b) => a - b);
    const zones = [...new Set(matches.map(match => match.zone?.name).filter((zone): zone is string => Boolean(zone)))];
    const roundsLabel = matchdays.length ? ` · ${matchdays.map(round => `F${round}`).join('/')}` : '';
    const zonesLabel = zones.length ? ` · ${zones.join('/')}` : '';
    return `${this.dateLabel(value)} · ${matches.length} ${matches.length === 1 ? 'partido' : 'partidos'}${roundsLabel}${zonesLabel}`;
  }
  selectableMatches() {
    if (this.template === 'rescheduled_match') return this.rescheduledMatches();
    if (this.template === 'featured_match') return this.upcomingMatches();
    return this.resultMatches();
  }

  private normalizeSelection() {
    const data = this.leagueData();
    if (!data) return;
    this.zoneId ??= data.zones[0]?.id ?? null;
    const rounds = this.availableMatchdays();
    if (!this.matchday || !rounds.includes(this.matchday)) this.matchday = rounds[0] ?? null;
    const matches = this.selectableMatches();
    if (!this.matchId || !matches.some(match => match.id === this.matchId)) this.matchId = matches[0]?.id ?? null;
    const dates = this.dailyDates();
    if (!this.scheduledDate || !dates.includes(this.scheduledDate)) {
      const today = new Intl.DateTimeFormat('en-CA').format(new Date());
      this.scheduledDate = this.template === 'today_results'
        ? [...dates].reverse().find(date => date <= today) ?? dates.at(-1) ?? null
        : dates.find(date => date >= today) ?? dates.at(-1) ?? null;
    }
  }

  private params(includePage = false) {
    const params: Record<string, string | number> = { template: this.template, format: this.format };
    if (this.showZoneSelector() && this.zoneId) params['zoneId'] = this.zoneId;
    if (this.showMatchdaySelector() && this.matchday) params['matchday'] = this.matchday;
    if (this.showMatchSelector() && this.matchId) params['matchId'] = this.matchId;
    if ((this.template === 'today' || this.template === 'today_results') && this.scheduledDate) params['scheduledDate'] = this.scheduledDate;
    if (includePage) params['page'] = this.pageIndex();
    return params;
  }

  private loadManifest() {
    const leagueId = this.selectedLeagueId;
    if (!leagueId) return;
    const requestId = ++this.requestId;
    this.requestAbort?.abort();
    const abort = new AbortController();
    this.requestAbort = abort;
    this.loading.set(true);
    this.notice.set('');
    this.api.get<InstagramManifest>(`/admin/leagues/${leagueId}/instagram/manifest`, this.params(), { noCache: true, abortSignal: abort.signal }).subscribe({
      next: manifest => {
        if (requestId !== this.requestId) return;
        this.manifest.set(manifest);
        if (!manifest.pages.some(page => page.index === this.pageIndex())) this.pageIndex.set(0);
        this.caption = manifest.description;
        this.loadPreview(requestId, abort);
      },
      error: async error => {
        if (requestId !== this.requestId || abort.signal.aborted) return;
        this.loading.set(false);
        this.manifest.set(null);
        this.revokePreview();
        const message = await this.errorMessage(error, 'No se pudo preparar esta plantilla con los datos seleccionados.');
        if (requestId !== this.requestId || abort.signal.aborted) return;
        this.previewError.set(message);
        this.showError(message);
      }
    });
  }

  private loadPreview(parentRequestId = ++this.requestId, parentAbort?: AbortController) {
    const leagueId = this.selectedLeagueId;
    if (!leagueId || !this.manifest()) return;
    const abort = parentAbort ?? new AbortController();
    if (!parentAbort) { this.requestAbort?.abort(); this.requestAbort = abort; }
    this.loading.set(true);
    this.previewLoaded.set(false);
    this.previewError.set('');
    this.api.getBlob(`/admin/leagues/${leagueId}/instagram/render`, this.params(true), { noCache: true, abortSignal: abort.signal, timeoutMs: 45000 }).subscribe({
      next: blob => {
        if (parentRequestId !== this.requestId || abort.signal.aborted) return;
        this.revokePreview();
        this.previewUrl.set(URL.createObjectURL(blob));
        this.loading.set(false);
      },
      error: async error => {
        if (parentRequestId !== this.requestId || abort.signal.aborted) return;
        this.loading.set(false);
        const message = await this.errorMessage(error, 'No se pudo renderizar la vista previa.');
        if (parentRequestId !== this.requestId || abort.signal.aborted) return;
        this.previewError.set(message);
        this.showError(message);
      }
    });
  }

  downloadPng() {
    const leagueId = this.selectedLeagueId;
    const page = this.manifest()?.pages.find(item => item.index === this.pageIndex());
    if (!leagueId || !page) return;
    this.downloading.set(true);
    this.api.getBlob(`/admin/leagues/${leagueId}/instagram/render`, { ...this.params(true), download: 1 }, { noCache: true, timeoutMs: 45000 }).subscribe({
      next: blob => { this.saveBlob(blob, page.fileName); this.downloading.set(false); },
      error: error => { this.downloading.set(false); this.showError(error.error?.message ?? 'No se pudo descargar el PNG.'); }
    });
  }

  downloadZip() {
    const leagueId = this.selectedLeagueId;
    const fileName = this.manifest()?.zipFileName;
    if (!leagueId || !fileName) return;
    this.downloading.set(true);
    this.api.getBlob(`/admin/leagues/${leagueId}/instagram/carousel.zip`, this.params(), { noCache: true, timeoutMs: 90000 }).subscribe({
      next: blob => { this.saveBlob(blob, fileName); this.downloading.set(false); },
      error: error => { this.downloading.set(false); this.showError(error.error?.message ?? 'No se pudo descargar el carrusel.'); }
    });
  }

  async copyCaption() {
    try {
      await navigator.clipboard.writeText(this.caption);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = this.caption;
      textarea.style.position = 'fixed'; textarea.style.opacity = '0';
      document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
    }
    this.copied.set(true);
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copied.set(false), 1800);
  }

  private saveBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = fileName; link.rel = 'noopener';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private revokePreview() {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set('');
  }

  private async errorMessage(error: any, fallback: string) {
    const body = error?.error;
    if (body instanceof Blob) {
      try {
        const text = await body.text();
        const parsed = JSON.parse(text);
        if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message;
      } catch {
        // La respuesta puede ser texto o un blob vacío; se conserva el mensaje estándar.
      }
    }
    return typeof body?.message === 'string' && body.message.trim() ? body.message : fallback;
  }

  private showError(message: string) { this.notice.set(message); this.noticeError.set(true); }
  private stageLabel(stage: string) { return ({ ROUND_OF_16: 'Octavos', QUARTERFINAL: 'Cuartos', SEMIFINAL: 'Semifinal', FINAL: 'Final' } as Record<string, string>)[stage] ?? stage; }
}
