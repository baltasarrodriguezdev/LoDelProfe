import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, finalize, merge } from 'rxjs';
import { Api } from '../../core/api';
import { RealtimeService } from '../../core/realtime';
import { AsyncStatus } from '../../shared/async-state';
import type { LeagueMatch, LeaguePayload, LeagueTab } from './league.models';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="league-hero">
      <div class="league-hero-grid" aria-hidden="true"></div>
      <div class="league-hero-inner">
        <div>
          <span class="eyebrow">TEMPORADA 2026 · LO DEL PROFE</span>
          <h1>{{ data()?.league?.name || 'Liga Suma 12' }}</h1>
          <p>Fixture, resultados y posiciones de las 16 parejas, siempre al día.</p>
        </div>
      </div>
    </section>

    <nav class="league-tabs" aria-label="Secciones de La Liga">
      <div>
        @for (tab of tabs; track tab.id) {
          <button type="button" [class.active]="activeTab() === tab.id" [attr.aria-current]="activeTab() === tab.id ? 'page' : null" (click)="activeTab.set(tab.id)">{{ tab.label }}</button>
        }
      </div>
      <small class="league-tabs-hint" aria-hidden="true">Deslizá para ver todas las secciones →</small>
    </nav>

    <main class="league-content" aria-live="polite">
      @if (status() === 'loading') {
        <div class="league-loading"><span></span><strong>Cargando La Liga…</strong><p>Estamos preparando fixture y posiciones.</p></div>
      } @else if (status() === 'error') {
        <div class="empty league-error"><strong>No pudimos cargar La Liga.</strong><span>{{ error() }}</span><button type="button" class="btn primary" (click)="load()">Reintentar</button></div>
      } @else if (data(); as leagueData) {
        @if (activeTab() === 'summary') {
          <section class="league-summary">
            <div class="league-kicker-grid">
              <article><small>ETAPA ACTUAL</small><strong>{{ stageLabel(leagueData.league.currentStage) }}</strong><span>16 parejas · 2 zonas</span></article>
              <article><small>PRÓXIMA FECHA</small><strong>{{ leagueData.summary.nextMatchday ? 'Fecha ' + leagueData.summary.nextMatchday.number : 'A confirmar' }}</strong><span>{{ leagueData.summary.nextMatchday ? leagueData.summary.nextMatchday.zone.name + ' · ' + formatDate(leagueData.summary.nextMatchday.date) : 'Sin fecha de zona pendiente' }}</span></article>
              <article><small>FORMATO</small><strong>Mejor de 3 sets</strong><span>Tercer set completo</span></article>
            </div>
            <div class="league-two-columns">
              <section>
                <div class="league-section-title"><div><span class="eyebrow">AGENDA</span><h2>Próximos partidos</h2></div><button type="button" class="league-text-action" (click)="openTab('matches')">Ver fixture →</button></div>
                <div class="league-match-list">
                  @for (match of leagueData.summary.upcomingMatches; track match.id) { <ng-container [ngTemplateOutlet]="matchCard" [ngTemplateOutletContext]="{ $implicit: match }" /> }
                  @empty { <div class="empty">No hay próximos partidos con fecha confirmada.</div> }
                </div>
              </section>
              <section>
                <div class="league-section-title"><div><span class="eyebrow">MARCADOR</span><h2>Últimos resultados</h2></div><button type="button" class="league-text-action" (click)="openTab('standings')">Ver posiciones →</button></div>
                <div class="league-match-list">
                  @for (match of leagueData.summary.latestResults; track match.id) { <ng-container [ngTemplateOutlet]="matchCard" [ngTemplateOutletContext]="{ $implicit: match }" /> }
                  @empty { <div class="empty"><strong>La pelota todavía no rodó.</strong><span>Los resultados oficiales aparecerán acá.</span></div> }
                </div>
              </section>
            </div>
            <div class="league-quick-links">
              <button type="button" (click)="openTab('standings')"><span>01</span><strong>Posiciones</strong><small>Zona A y Zona B</small></button>
              <button type="button" (click)="openTab('matches')"><span>02</span><strong>Fixture completo</strong><small>Siete fechas</small></button>
              <button type="button" (click)="openTab('bracket')"><span>03</span><strong>Eliminatorias</strong><small>Camino a la final</small></button>
            </div>
          </section>
        }

        @if (activeTab() === 'zones') {
          <section>
            <header class="league-page-title"><span class="eyebrow">16 PAREJAS</span><h2>Las zonas</h2><p>Ocho parejas por zona. Todos contra todos durante siete fechas.</p></header>
            <div class="league-zones">
              @for (zone of leagueData.zones; track zone.id) {
                <article class="league-zone-card">
                  <header><div><small>{{ zone.regularDay }}</small><h3>{{ zone.name }}</h3></div><span>8 parejas</span></header>
                  <ol>
                    @for (pair of zone.pairs; track pair.id) {
                      <li><b>{{ pair.seedNumber }}</b><div><strong>{{ pair.firstPlayer.displayName }}</strong><span>+</span><strong>{{ pair.secondPlayer.displayName }}</strong></div></li>
                    }
                  </ol>
                </article>
              }
            </div>
          </section>
        }

        @if (activeTab() === 'matches') {
          <section>
            <header class="league-page-title"><span class="eyebrow">FASE DE ZONAS</span><h2>Partidos y resultados</h2><p>Filtrá el fixture por zona, fecha o estado.</p></header>
            <div class="league-filters" aria-label="Filtros de partidos">
              <label>Zona<select [value]="zoneFilter()" (change)="zoneFilter.set(valueOf($event))"><option value="ALL">Todas</option><option value="A">Zona A</option><option value="B">Zona B</option></select></label>
              <label>Fecha<select [value]="matchdayFilter()" (change)="matchdayFilter.set(valueOf($event))"><option value="ALL">Todas</option>@for (number of matchdays; track number) { <option [value]="number">Fecha {{ number }}</option> }</select></label>
              <label>Estado<select [value]="statusFilter()" (change)="statusFilter.set(valueOf($event))"><option value="ALL">Todos</option><option value="UPCOMING">Próximos</option><option value="FINISHED">Finalizados</option><option value="RESCHEDULED">Reprogramados</option></select></label>
            </div>
            <div class="league-match-grid">
              @for (match of filteredMatches(); track match.id) { <ng-container [ngTemplateOutlet]="matchCard" [ngTemplateOutletContext]="{ $implicit: match }" /> }
              @empty { <div class="empty league-wide"><strong>No hay partidos para esos filtros.</strong><span>Probá con otra zona, fecha o estado.</span></div> }
            </div>
          </section>
        }

        @if (activeTab() === 'standings') {
          <section>
            <header class="league-page-title"><span class="eyebrow">TABLA GENERAL</span><h2>Posiciones</h2><p>Las estadísticas se calculan únicamente desde resultados oficializados.</p></header>
            <aside class="league-ranking-criteria" aria-label="Criterios para definir las posiciones de cada zona">
              <div><span class="eyebrow">ORDEN DE DESEMPATE</span><strong>Para definir la zona se tendrá en cuenta</strong></div>
              <ol>
                <li><b>1º</b><span>Puntos</span></li>
                <li><b>2º</b><span>Partidos entre sí</span></li>
                <li><b>3º</b><span>Sets a favor</span></li>
                <li><b>4º</b><span>Games a favor</span></li>
                <li><b>5º</b><span>Games positivos</span></li>
                <li><b>6º</b><span>Sorteo</span></li>
              </ol>
              <small><strong>Games positivos</strong> = games a favor − games en contra.</small>
            </aside>
            <div class="league-standings-stack">
              @for (table of leagueData.standings; track table.zone.id) {
                <article class="league-standings-card">
                  <header><h3>{{ table.zone.name }}</h3></header>
                  <div class="league-table-tools">
                    <span>{{ showMobileStats() ? 'Deslizá la tabla para comparar →' : 'Vista compacta' }}</span>
                    <button type="button" (click)="toggleMobileStats()" [attr.aria-pressed]="showMobileStats()">
                      {{ showMobileStats() ? 'Ocultar estadísticas' : 'Ver estadísticas' }}
                    </button>
                  </div>
                  <p class="league-table-hint" [id]="'standings-scroll-hint-' + table.zone.code">Deslizá la tabla para consultar todas las estadísticas →</p>
                  <div class="league-table-scroll" [class.show-all-stats]="showMobileStats()" tabindex="0" [attr.aria-describedby]="'standings-scroll-hint-' + table.zone.code" [attr.aria-label]="'Tabla de posiciones ' + table.zone.name">
                    <table>
                      <thead><tr><th>POS</th><th>PAREJA</th><th>PJ</th><th>PG</th><th>PP</th><th>SF</th><th>SC</th><th>DS</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead>
                      <tbody>
                        @for (row of table.rows; track row.pairId) {
                          <tr [class.league-top-position]="row.position <= 3"><td>{{ row.position }}</td><th scope="row">{{ row.pair }}</th><td>{{ row.played }}</td><td>{{ row.won }}</td><td>{{ row.lost }}</td><td>{{ row.setsFor }}</td><td>{{ row.setsAgainst }}</td><td>{{ signed(row.setDifference) }}</td><td>{{ row.gamesFor }}</td><td>{{ row.gamesAgainst }}</td><td>{{ signed(row.gameDifference) }}</td><td><strong>{{ row.points === null ? 'Pend.' : row.points }}</strong></td></tr>
                        } @empty {
                          <tr><td colspan="12">Todavía no hay parejas en esta zona.</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <p class="league-abbreviations"><strong>PJ</strong> partidos jugados · <strong>PG/PP</strong> partidos ganados/perdidos · <strong>SF/SC</strong> sets a favor/en contra · <strong>DS</strong> diferencia de sets · <strong>GF/GC</strong> games a favor/en contra · <strong>DG</strong> diferencia de games · <strong>PTS</strong> puntos.</p>
                </article>
              }
            </div>
          </section>
        }

        @if (activeTab() === 'bracket') {
          <section>
            <header class="league-page-title"><span class="eyebrow">FASE FINAL</span><h2>El camino al título</h2><p>Los nombres reemplazarán automáticamente las referencias cuando queden definidos oficialmente.</p></header>
            <div class="league-bracket-scroll" tabindex="0" aria-label="Cuadro eliminatorio">
              <div class="league-bracket">
                @for (round of leagueData.bracket; track round.stage) {
                  <section class="bracket-round"><header><small>{{ round.matches.length }} {{ round.matches.length === 1 ? 'PARTIDO' : 'PARTIDOS' }}</small><h3>{{ stageLabel(round.stage) }}</h3></header><div>
                    @for (match of round.matches; track match.id) {
                      <article class="bracket-match"><span>{{ match.code }} · {{ match.scheduledDate ? formatDate(match.scheduledDate) : 'Fecha a confirmar' }} · {{ match.scheduledTime || 'Hora a confirmar' }}</span><div [class.winner]="match.result?.winnerSide === 'HOME'"><strong>{{ match.homePair?.displayName || match.homePlaceholder }}</strong><b>{{ match.result?.homeSets ?? '—' }}</b></div><div [class.winner]="match.result?.winnerSide === 'AWAY'"><strong>{{ match.awayPair?.displayName || match.awayPlaceholder }}</strong><b>{{ match.result?.awaySets ?? '—' }}</b></div></article>
                    }
                  </div></section>
                }
              </div>
            </div>
          </section>
        }

      }
    </main>

    <ng-template #matchCard let-match>
      <article class="league-match-card">
        <header><div><span>{{ match.zone?.name || stageLabel(match.stage) }}{{ match.matchday ? ' · Fecha ' + match.matchday : ' · ' + match.code }}</span><time>{{ match.scheduledDate ? formatDate(match.scheduledDate) : 'Fecha a confirmar' }} · {{ match.scheduledTime || 'Hora a confirmar' }}</time></div><b [attr.data-status]="match.status">{{ statusLabel(match.status) }}</b></header>
        <div class="league-score-row" [class.winner]="match.result?.winnerSide === 'HOME'"><strong>{{ match.homePair?.displayName || match.homePlaceholder || 'Pareja a confirmar' }}</strong><span class="set-scores">@for (set of match.sets; track set.setNumber) { <i>{{ set.homeGames }}</i> }</span><em>{{ match.result?.homeSets ?? '—' }}</em></div>
        <div class="league-score-row" [class.winner]="match.result?.winnerSide === 'AWAY'"><strong>{{ match.awayPair?.displayName || match.awayPlaceholder || 'Pareja a confirmar' }}</strong><span class="set-scores">@for (set of match.sets; track set.setNumber) { <i>{{ set.awayGames }}</i> }</span><em>{{ match.result?.awaySets ?? '—' }}</em></div>
        @if (match.sets.length && !match.official) { <footer>Resultado cargado · pendiente de confirmación oficial</footer> }
        @if (match.scoringPending) { <footer class="pending-score">Puntaje de la derrota 0–2 pendiente de definición</footer> }
        @if (match.rescheduleNote) { <footer>{{ match.rescheduleNote }}</footer> }
      </article>
    </ng-template>
  `,
  styles: [`
    :host{display:block;background:var(--color-brand-cream);min-height:70vh}.league-hero{position:relative;overflow:hidden;background:var(--color-brand-dark);color:var(--color-brand-paper);border-bottom:4px solid var(--color-brand-gold)}.league-hero-grid{position:absolute;inset:0;opacity:.12;background-image:linear-gradient(rgba(255,255,255,.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.4) 1px,transparent 1px);background-size:64px 64px;transform:perspective(500px) rotateX(58deg) scale(1.4);transform-origin:bottom}.league-hero-inner{position:relative;display:flex;align-items:end;justify-content:space-between;gap:30px;width:min(calc(100% - 48px),1200px);margin:auto;padding:64px 0 52px}.league-hero h1{margin:8px 0 12px;font-size:clamp(4rem,9vw,7rem);color:var(--color-brand-paper)}.league-hero p{margin:0;color:#dce3d8;font-size:1.05rem}.league-live{display:flex;align-items:center;gap:12px;min-width:210px;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:13px 16px;background:rgba(0,0,0,.15)}.league-live>span{width:10px;height:10px;border-radius:50%;background:#d8a749}.league-live.online>span{background:#8ecb73;box-shadow:0 0 0 5px rgba(142,203,115,.12)}.league-live div{display:grid}.league-live small{font-family:var(--font-display);font-size:.62rem;letter-spacing:.15em;color:#a8b5aa}.league-live strong{font-size:.9rem}.league-tabs{position:sticky;top:76px;z-index:20;overflow-x:auto;border-bottom:1px solid var(--color-brand-border);background:rgba(255,253,245,.96);backdrop-filter:blur(12px)}.league-tabs>div{display:flex;width:max-content;min-width:100%;max-width:1200px;margin:auto;padding:0 24px}.league-tabs button{min-height:58px;border:0;border-bottom:3px solid transparent;padding:0 17px;background:none;color:var(--color-brand-muted);font-size:.82rem}.league-tabs button.active{border-bottom-color:var(--color-brand-gold);color:var(--color-brand-dark)}.league-content{width:min(calc(100% - 48px),1200px);margin:auto;padding:48px 0 76px}.league-loading{display:grid;min-height:360px;place-content:center;justify-items:center;text-align:center}.league-loading span{width:42px;height:42px;border:3px solid #d8ddcf;border-top-color:var(--color-brand-green);border-radius:50%;animation:league-spin .8s linear infinite}.league-loading p{margin:4px 0}.league-error{min-height:280px}.league-error .btn{margin-top:15px}.league-kicker-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.league-kicker-grid article{display:grid;gap:6px;border:1px solid var(--color-brand-border);border-radius:14px;padding:22px;background:var(--color-brand-paper);box-shadow:0 10px 30px rgba(34,53,38,.05)}.league-kicker-grid small,.league-zone-card header small,.bracket-round header small{font-family:var(--font-display);font-weight:700;letter-spacing:.13em;color:var(--color-brand-gold)}.league-kicker-grid strong{font-size:1.35rem}.league-kicker-grid span{color:var(--color-brand-muted);font-size:.8rem}.league-two-columns{display:grid;grid-template-columns:1fr 1fr;gap:38px;margin-top:48px}.league-section-title{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:17px}.league-section-title h2{margin:4px 0 0;font-size:2rem}.league-text-action{border:0;background:none;color:var(--color-brand-green);font-size:.78rem;font-weight:700}.league-match-list{display:grid;gap:12px}.league-match-card{overflow:hidden;border:1px solid var(--color-brand-border);border-radius:13px;background:var(--color-brand-paper);box-shadow:0 8px 28px rgba(34,53,38,.045)}.league-match-card>header{display:flex;align-items:start;justify-content:space-between;gap:12px;border-bottom:1px solid var(--color-brand-border);padding:11px 14px;background:#f2efe4}.league-match-card>header div{display:grid;gap:2px}.league-match-card>header span{font-family:var(--font-display);font-size:.68rem;font-weight:700;letter-spacing:.1em;color:var(--color-brand-green)}.league-match-card time{font-size:.73rem;color:var(--color-brand-muted)}.league-match-card>header b{border-radius:99px;padding:5px 8px;background:#e3eadf;color:var(--color-brand-green);font-size:.59rem;letter-spacing:.07em}.league-match-card>header b[data-status=RESCHEDULED],.league-match-card>header b[data-status=SUSPENDED]{background:#f8e7c4;color:#765717}.league-match-card>header b[data-status=FINISHED]{background:var(--color-brand-dark);color:#fff}.league-score-row{display:grid;grid-template-columns:minmax(0,1fr) auto 28px;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid rgba(31,51,38,.08)}.league-score-row strong{font-family:var(--font-body);font-size:.82rem}.league-score-row.winner strong,.league-score-row.winner em{font-weight:800;color:var(--color-brand-green)}.set-scores{display:flex;gap:5px}.set-scores i{display:grid;width:23px;height:23px;place-content:center;border-radius:4px;background:#e9e7df;font-style:normal;font-size:.73rem}.league-score-row em{font-family:var(--font-display);font-size:1.15rem;font-style:normal;text-align:center}.league-match-card footer{padding:8px 14px;background:#f7f3e7;color:var(--color-brand-muted);font-size:.68rem}.league-match-card footer.pending-score{border-top:1px solid #ead4a1;color:#755815;background:#fff4d9}.league-quick-links{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:42px}.league-quick-links button{display:grid;grid-template-columns:auto 1fr;gap:2px 14px;border:1px solid var(--color-brand-dark);border-radius:12px;padding:18px;text-align:left;background:transparent}.league-quick-links span{grid-row:1/3;font-family:var(--font-display);font-size:1.8rem;color:var(--color-brand-gold)}.league-quick-links strong{font-size:1.05rem}.league-quick-links small{color:var(--color-brand-muted)}.league-page-title{max-width:720px;margin-bottom:34px}.league-page-title h2{margin:8px 0;font-size:clamp(3rem,6vw,5rem);line-height:.95;text-transform:uppercase}.league-page-title p{margin:0;font-size:1rem}.league-zones{display:grid;grid-template-columns:1fr 1fr;gap:22px}.league-zone-card{overflow:hidden;border:1px solid var(--color-brand-border);border-radius:16px;background:var(--color-brand-paper);box-shadow:0 14px 40px rgba(34,53,38,.06)}.league-zone-card>header{display:flex;align-items:center;justify-content:space-between;padding:24px;background:var(--color-brand-dark);color:#fff}.league-zone-card h3{margin:2px 0 0;font-size:2.35rem}.league-zone-card>header>span{border:1px solid rgba(255,255,255,.3);border-radius:99px;padding:6px 10px;font-size:.7rem}.league-zone-card ol{list-style:none;margin:0;padding:7px 22px 18px}.league-zone-card li{display:grid;grid-template-columns:38px 1fr;align-items:center;border-bottom:1px solid var(--color-brand-border);padding:13px 0}.league-zone-card li:last-child{border:0}.league-zone-card li>b{font-size:1.35rem;color:var(--color-brand-gold)}.league-zone-card li div{display:flex;flex-wrap:wrap;gap:7px}.league-zone-card li div span{color:var(--color-brand-gold)}.league-filters{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;border:1px solid var(--color-brand-border);border-radius:14px;padding:16px;background:var(--color-brand-paper)}.league-filters label{display:grid;gap:6px;font-size:.72rem;font-weight:700}.league-match-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.league-wide{grid-column:1/-1}.league-standings-stack{display:grid;gap:28px}.league-standings-card{overflow:hidden;border:1px solid var(--color-brand-border);border-radius:16px;background:var(--color-brand-paper)}.league-standings-card>header{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;background:var(--color-brand-dark);color:#fff}.league-standings-card h3{margin:0;font-size:2rem}.league-standings-card>header span{border-radius:99px;padding:6px 10px;background:#e1ebda;color:var(--color-brand-green);font-size:.7rem;font-weight:800}.league-standings-card>header span.pending{background:#dfe8dc;color:var(--color-brand-green)}.league-warning{margin:14px 18px 0;border-left:4px solid #789071;padding:10px 12px;background:#edf2eb;color:var(--color-brand-dark);font-size:.78rem}.league-table-scroll{overflow-x:auto}.league-table-scroll table{width:100%;min-width:820px;border-collapse:collapse}.league-table-scroll th,.league-table-scroll td{border-bottom:1px solid var(--color-brand-border);padding:13px 12px;text-align:center;font-size:.76rem}.league-table-scroll thead th{background:#ece9dd;font-family:var(--font-display);letter-spacing:.06em;color:var(--color-brand-muted)}.league-table-scroll th:nth-child(1),.league-table-scroll td:nth-child(1){position:sticky;left:0;z-index:2;width:58px;background:var(--color-brand-paper)}.league-table-scroll th:nth-child(2){position:sticky;left:58px;z-index:2;min-width:210px;background:var(--color-brand-paper);text-align:left}.league-table-scroll thead th:nth-child(1),.league-table-scroll thead th:nth-child(2){z-index:3;background:#ece9dd}.league-table-scroll tr.ranking-pending td:first-child{color:var(--color-brand-muted)}.league-abbreviations{margin:0;padding:14px 18px;background:#f5f2e8;font-size:.7rem}.league-bracket-scroll{overflow-x:auto;padding-bottom:12px}.league-bracket{display:grid;grid-template-columns:repeat(4,minmax(250px,1fr));align-items:center;gap:24px;min-width:1100px}.bracket-round>header{margin-bottom:14px;border-bottom:2px solid var(--color-brand-gold);padding-bottom:9px}.bracket-round h3{margin:2px 0;font-size:1.65rem;text-transform:uppercase}.bracket-round>div{display:grid;gap:12px}.bracket-round:nth-child(2)>div{gap:50px}.bracket-round:nth-child(3)>div{gap:125px}.bracket-match{position:relative;border:1px solid var(--color-brand-border);border-radius:11px;background:var(--color-brand-paper);box-shadow:5px 5px 0 rgba(154,151,79,.16)}.bracket-match>span{display:block;border-bottom:1px solid var(--color-brand-border);padding:7px 10px;background:#f0ede3;color:var(--color-brand-muted);font-size:.61rem}.bracket-match>div{display:grid;grid-template-columns:1fr 24px;gap:8px;padding:9px 10px;border-bottom:1px solid rgba(31,51,38,.08)}.bracket-match>div:last-child{border:0}.bracket-match strong{font-family:var(--font-body);font-size:.7rem}.bracket-match div.winner{box-shadow:inset 3px 0 var(--color-brand-green);color:var(--color-brand-green)}.league-rules-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.league-rules-grid article{position:relative;border:1px solid var(--color-brand-border);border-radius:14px;padding:25px;background:var(--color-brand-paper)}.league-rules-grid article>span{position:absolute;top:18px;right:20px;font-family:var(--font-display);font-size:2.1rem;color:rgba(154,151,79,.42)}.league-rules-grid h3{margin:0 0 14px;font-size:1.45rem}.league-rules-grid ul,.league-rules-grid ol{display:grid;gap:8px;margin:0;padding-left:20px;color:var(--color-brand-muted);font-size:.86rem}.league-rules-grid p{font-size:.78rem}.league-rules-grid .league-pending-rules{grid-column:1/-1;border-color:#d0a13d;background:#fff4d9}.league-pending-rules li{color:#6d541c}@keyframes league-spin{to{transform:rotate(360deg)}}
    @media(max-width:900px){.league-hero-inner{align-items:start;flex-direction:column}.league-tabs{top:68px}.league-two-columns,.league-zones{grid-template-columns:1fr}.league-match-grid{grid-template-columns:1fr}}
    @media(max-width:680px){.league-hero-inner,.league-content{width:calc(100% - 32px)}.league-hero-inner{padding:45px 0 38px}.league-hero h1{font-size:3.8rem}.league-live{width:100%}.league-tabs>div{padding:0 16px}.league-tabs button{padding:0 13px}.league-content{padding-top:32px}.league-kicker-grid,.league-quick-links,.league-filters{grid-template-columns:1fr}.league-two-columns{gap:32px;margin-top:36px}.league-page-title h2{font-size:3.1rem}.league-zone-card>header{padding:20px}.league-zone-card ol{padding-right:17px;padding-left:17px}.league-score-row{grid-template-columns:minmax(0,1fr) auto 24px;gap:8px}.league-section-title{align-items:start;flex-direction:column}.league-standings-card>header{align-items:start;flex-direction:column;gap:8px}}
  `,
  `
    .league-ranking-criteria{display:grid;gap:18px;margin:-8px 0 28px;border:1px solid var(--color-brand-border);border-left:5px solid var(--color-brand-gold);border-radius:12px;padding:20px 22px;background:var(--color-brand-paper);box-shadow:0 10px 28px rgba(34,53,38,.045)}
    .league-ranking-criteria>div{display:grid;gap:3px}.league-ranking-criteria>div strong{font-size:1.05rem}
    .league-ranking-criteria ol{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
    .league-ranking-criteria li{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:8px;min-height:48px;border-radius:8px;padding:8px 10px;background:#f2efe4;font-size:.72rem}
    .league-ranking-criteria li b{font-family:var(--font-display);font-size:1.05rem;color:var(--color-brand-gold)}
    .league-ranking-criteria small{color:var(--color-brand-muted);font-size:.68rem}
    @media(max-width:900px){.league-ranking-criteria ol{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:560px){.league-ranking-criteria{padding:17px}.league-ranking-criteria ol{grid-template-columns:repeat(2,1fr)}}
  `,
  `
    .league-live small,.league-match-card>header span,.league-score-row em,.league-table-scroll thead th,.league-ranking-criteria li b{font-family:var(--font-body);font-weight:600}
    .league-tabs{overscroll-behavior-inline:contain;scrollbar-width:thin}
    .league-table-scroll tr.ranking-pending td:first-child{color:#9c741b}
    .league-tabs>div{scroll-snap-type:x proximity}
    .league-tabs button{scroll-snap-align:start}
    .league-tabs-hint{display:none}

    .league-table-tools{display:none}
    .league-table-hint{display:none;margin:0;border-bottom:1px solid var(--color-brand-border);padding:9px 18px;background:#fff6d9;color:#6f551a;font-size:.7rem;font-weight:750}
    .league-table-scroll{overscroll-behavior-inline:contain;scrollbar-gutter:stable;scrollbar-width:thin;touch-action:pan-x pan-y}
    .league-table-scroll table{min-width:1020px;font-variant-numeric:tabular-nums}
    .league-table-scroll th:nth-child(2){width:240px;max-width:240px;box-shadow:7px 0 10px -10px rgba(20,40,27,.8);white-space:normal;overflow-wrap:anywhere}
    .league-table-scroll th:last-child,.league-table-scroll td:last-child{position:sticky;right:0;z-index:2;min-width:68px;background:var(--color-brand-paper);box-shadow:-7px 0 10px -10px rgba(20,40,27,.8)}
    .league-table-scroll thead th:last-child{z-index:3;background:#ece9dd}
    .league-table-scroll td:last-child strong{font-size:.94rem;color:var(--color-brand-green)}
    .league-table-scroll td,.league-table-scroll th{font-variant-numeric:tabular-nums}

    @media(min-width:721px) and (max-width:1100px){.league-table-hint{display:block}}
    @media(max-width:720px){
      .league-table-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid var(--color-brand-border);padding:8px 10px;background:#f5f2e8}
      .league-table-tools span{color:var(--color-brand-muted);font-size:.62rem}
      .league-table-tools button{min-height:34px;border:1px solid var(--color-brand-green);border-radius:999px;padding:6px 11px;background:transparent;color:var(--color-brand-green);font-size:.62rem;font-weight:800;white-space:nowrap}
      .league-table-tools button[aria-pressed=true]{background:var(--color-brand-dark);color:#fff}
      .league-table-scroll{display:block;max-width:100%;overflow-x:auto}
      .league-table-scroll table{width:100%;min-width:100%;table-layout:fixed}
      .league-table-scroll th,.league-table-scroll td{height:42px;padding:7px 3px;font-size:.66rem;line-height:1.2}
      .league-table-scroll thead th{height:34px;padding-top:6px;padding-bottom:6px;font-size:.58rem}
      .league-table-scroll th:nth-child(1),.league-table-scroll td:nth-child(1),.league-table-scroll th:nth-child(2){position:static;width:auto;min-width:0;max-width:none;box-shadow:none}
      .league-table-scroll th:nth-child(1),.league-table-scroll td:nth-child(1){width:34px}
      .league-table-scroll th:nth-child(2){width:auto;padding-right:5px;padding-left:5px;line-height:1.25;overflow-wrap:anywhere}
      .league-table-scroll th:nth-child(3),.league-table-scroll td:nth-child(3),.league-table-scroll th:nth-child(6),.league-table-scroll td:nth-child(6),.league-table-scroll th:nth-child(7),.league-table-scroll td:nth-child(7){width:29px}
      .league-table-scroll th:nth-child(8),.league-table-scroll td:nth-child(8){width:34px}
      .league-table-scroll th:nth-child(12),.league-table-scroll td:nth-child(12){position:static;width:41px;min-width:0;box-shadow:none}
      .league-table-scroll th:nth-child(4),.league-table-scroll td:nth-child(4),.league-table-scroll th:nth-child(5),.league-table-scroll td:nth-child(5),.league-table-scroll th:nth-child(9),.league-table-scroll td:nth-child(9),.league-table-scroll th:nth-child(10),.league-table-scroll td:nth-child(10),.league-table-scroll th:nth-child(11),.league-table-scroll td:nth-child(11){display:none}
      .league-table-scroll tbody tr:nth-child(even)>*{background:#f7f5ec}
      .league-table-scroll tbody tr.league-top-position td:first-child{border-left:3px solid var(--color-brand-gold);color:var(--color-brand-green);font-weight:900}
      .league-table-scroll thead th:last-child{background:var(--color-brand-dark);color:#fff}
      .league-table-scroll tbody td:last-child{background:#e3eadf;color:var(--color-brand-dark)}
      .league-table-scroll tbody tr:nth-child(even) td:last-child{background:#dce5d8}
      .league-table-scroll td:last-child strong{font-size:.8rem;color:var(--color-brand-dark)}
      .league-table-scroll.show-all-stats table{min-width:760px;table-layout:auto}
      .league-table-scroll.show-all-stats th:nth-child(4),.league-table-scroll.show-all-stats td:nth-child(4),.league-table-scroll.show-all-stats th:nth-child(5),.league-table-scroll.show-all-stats td:nth-child(5),.league-table-scroll.show-all-stats th:nth-child(9),.league-table-scroll.show-all-stats td:nth-child(9),.league-table-scroll.show-all-stats th:nth-child(10),.league-table-scroll.show-all-stats td:nth-child(10),.league-table-scroll.show-all-stats th:nth-child(11),.league-table-scroll.show-all-stats td:nth-child(11){display:table-cell}
      .league-table-scroll.show-all-stats th:nth-child(1),.league-table-scroll.show-all-stats td:nth-child(1){position:sticky;left:0;z-index:3;width:42px;min-width:42px;background:var(--color-brand-paper)}
      .league-table-scroll.show-all-stats th:nth-child(2){position:sticky;left:42px;z-index:3;width:180px;min-width:180px;background:var(--color-brand-paper);box-shadow:7px 0 10px -10px rgba(20,40,27,.8)}
      .league-table-scroll.show-all-stats thead th:nth-child(1),.league-table-scroll.show-all-stats thead th:nth-child(2){z-index:4;background:#ece9dd}
      .league-table-scroll.show-all-stats tbody tr:nth-child(even)>td:first-child,.league-table-scroll.show-all-stats tbody tr:nth-child(even)>th:nth-child(2){background:#f7f5ec}
      .league-table-scroll.show-all-stats th:last-child,.league-table-scroll.show-all-stats td:last-child{position:sticky;right:0;z-index:3;width:50px;min-width:50px}
      .league-table-scroll.show-all-stats thead th:last-child{z-index:4}
      .league-warning{margin:12px 12px 0;font-size:.7rem}
    }
    @media(max-width:340px){
      .league-table-scroll:not(.show-all-stats) th:nth-child(6),.league-table-scroll:not(.show-all-stats) td:nth-child(6),.league-table-scroll:not(.show-all-stats) th:nth-child(7),.league-table-scroll:not(.show-all-stats) td:nth-child(7){display:none}
    }
    @media(max-width:680px){
      .league-hero h1{font-size:clamp(3rem,15vw,3.8rem);line-height:.95}
      .league-tabs-hint{position:sticky;left:0;display:block;width:100%;border-top:1px solid var(--color-brand-border);padding:5px 16px;background:#f5f1e5;color:var(--color-brand-muted);font-size:.62rem;text-align:right}
    }
    @media(prefers-reduced-motion:reduce){.league-loading span{animation:none}}
  `]
})
export class LeaguePage implements OnInit {
  private readonly api = inject(Api);
  readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly status = signal<AsyncStatus>('idle');
  readonly error = signal('');
  readonly data = signal<LeaguePayload | null>(null);
  readonly activeTab = signal<LeagueTab>('summary');
  readonly showMobileStats = signal(false);
  readonly zoneFilter = signal('ALL');
  readonly matchdayFilter = signal('ALL');
  readonly statusFilter = signal('ALL');
  private requestId = 0;
  readonly matchdays = [1, 2, 3, 4, 5, 6, 7];
  readonly tabs: Array<{ id: LeagueTab; label: string }> = [
    { id: 'summary', label: 'Resumen' }, { id: 'zones', label: 'Zonas' }, { id: 'matches', label: 'Partidos' },
    { id: 'standings', label: 'Posiciones' }, { id: 'bracket', label: 'Eliminatorias' }
  ];

  ngOnInit() {
    this.load();
    merge(this.realtime.listen(['LEAGUE_CHANGED']).pipe(debounceTime(180)), this.realtime.poll$()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load(true));
  }

  load(background = false) {
    const requestId = ++this.requestId;
    if (!background || !this.data()) this.status.set('loading');
    this.error.set('');
    this.api.get<LeaguePayload>('/league/active', undefined, { noCache: true }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (requestId === this.requestId && this.status() === 'loading') this.status.set('error'); })
    ).subscribe({
      next: data => { if (requestId === this.requestId) { this.data.set(data); this.status.set('success'); } },
      error: error => { if (requestId === this.requestId) { this.error.set(error.error?.message ?? 'Intentá nuevamente en unos minutos.'); this.status.set('error'); } }
    });
  }

  filteredMatches() {
    const data = this.data();
    if (!data) return [];
    return data.matches.filter(match => {
      const zoneMatches = this.zoneFilter() === 'ALL' || match.zone?.code === this.zoneFilter();
      const dayMatches = this.matchdayFilter() === 'ALL' || match.matchday === Number(this.matchdayFilter());
      const status = this.statusFilter();
      const statusMatches = status === 'ALL'
        || (status === 'UPCOMING' && ['SCHEDULED', 'LIVE', 'PENDING'].includes(match.status))
        || (status === 'FINISHED' && match.status === 'FINISHED')
        || (status === 'RESCHEDULED' && match.status === 'RESCHEDULED');
      return match.stage === 'GROUP_STAGE' && zoneMatches && dayMatches && statusMatches;
    });
  }

  openTab(tab: LeagueTab) { this.activeTab.set(tab); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  toggleMobileStats() { this.showMobileStats.update(value => !value); }
  valueOf(event: Event) { return (event.target as HTMLSelectElement).value; }
  stageLabel(stage: string) { return ({ GROUP_STAGE: 'Fase de zonas', ROUND_OF_16: 'Octavos de final', QUARTERFINAL: 'Cuartos de final', SEMIFINAL: 'Semifinales', FINAL: 'Final' } as Record<string, string>)[stage] ?? stage; }
  statusLabel(status: string) { return ({ SCHEDULED: 'Programado', LIVE: 'En juego', FINISHED: 'Finalizado', RESCHEDULED: 'Reprogramado', SUSPENDED: 'Suspendido', PENDING: 'Pendiente' } as Record<string, string>)[status] ?? status; }
  signed(value: number) { return value > 0 ? `+${value}` : String(value); }
  formatDate(value: string) {
    const date = new Date(`${value}T12:00:00-03:00`);
    return new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Argentina/Cordoba' }).format(date).replace('.', '');
  }
}
