import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { debounceTime, finalize, merge, Observable, switchMap } from 'rxjs';
import { Api } from '../../core/api';
import { RealtimeService } from '../../core/realtime';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import type { LeagueMatch, LeaguePayload } from './league.models';

type AdminLeagueTab = 'season' | 'pairs' | 'fixture' | 'results' | 'rules' | 'standings' | 'bracket';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  template: `
    <section class="admin-shell league-admin">
      <div class="admin-content">
        <header class="league-admin-head">
          <div><span class="eyebrow">COMPETENCIA</span><h1>La Liga</h1><p>Temporadas, fixture, resultados y reglas desde un mismo lugar.</p></div>
          <div class="league-admin-head-actions">
            <label>Temporada<select [ngModel]="selectedLeagueId()" (ngModelChange)="selectLeague($event)">@for (league of leagues(); track league.id) { <option [ngValue]="league.id">{{ league.name }} · {{ league.seasonYear }} · {{ seasonStatusLabel(league.status) }}</option> }</select></label>
            <button type="button" class="btn ghost" (click)="showCreate.set(!showCreate())">{{ showCreate() ? 'Cancelar alta' : 'Nueva liga' }}</button>
            <a class="btn primary" href="/la-liga" target="_blank" rel="noopener">Ver sitio público ↗</a>
          </div>
        </header>

        @if (notice()) { <p class="notice" [class.error-notice]="noticeError()">{{ notice() }}</p> }

        @if (showCreate()) {
          <form class="panel league-create-form" (ngSubmit)="createLeague()">
            <div><span class="eyebrow">NUEVA TEMPORADA</span><h2>Crear liga</h2><p>Se crearán Zona A, Zona B y las reglas confirmadas con los campos ambiguos pendientes.</p></div>
            <label>Nombre<input [(ngModel)]="createForm.name" name="createName" required></label>
            <label>Identificador<input [(ngModel)]="createForm.slug" name="createSlug" required pattern="[a-z0-9-]+"></label>
            <label>Temporada<input type="number" [(ngModel)]="createForm.seasonYear" name="createYear" min="2020" max="2100"></label>
            <label>Estado<select [(ngModel)]="createForm.status" name="createStatus"><option value="DRAFT">Borrador</option><option value="ACTIVE">Activa</option></select></label>
            <button class="btn primary" [disabled]="saving()">{{ saving() ? 'Creando...' : 'Crear temporada' }}</button>
          </form>
        }

        @if (loading()) {
          <div class="empty league-admin-loading">Cargando gestión de La Liga…</div>
        } @else if (data(); as leagueData) {
          <nav class="league-admin-tabs" aria-label="Herramientas de administración de la liga">
            @for (tab of tabs; track tab.id) { <button type="button" [class.active]="activeTab() === tab.id" (click)="activeTab.set(tab.id)">{{ tab.label }}@if (tab.id === 'results' && pendingScores().length) { <span>{{ pendingScores().length }}</span> }</button> }
          </nav>
          <small class="league-admin-tabs-hint" aria-hidden="true">Deslizá para ver todas las herramientas →</small>

          @if (activeTab() === 'season') {
            <form class="panel league-admin-form" (ngSubmit)="saveSeason()">
              <div class="league-form-heading"><div><span class="eyebrow">CONFIGURACIÓN</span><h2>{{ leagueData.league.name }}</h2></div><span class="league-season-badge" [attr.data-status]="seasonForm.status">{{ seasonStatusLabel(seasonForm.status) }}</span></div>
              <div class="form-grid three">
                <label>Nombre<input [(ngModel)]="seasonForm.name" name="seasonName" required></label>
                <label>Identificador<input [(ngModel)]="seasonForm.slug" name="seasonSlug" required></label>
                <label>Temporada<input type="number" [(ngModel)]="seasonForm.seasonYear" name="seasonYear"></label>
                <label>Estado<select [(ngModel)]="seasonForm.status" name="seasonStatus"><option value="DRAFT">Borrador</option><option value="ACTIVE">Activa</option><option value="CLOSED">Cerrada</option></select></label>
                <label>Etapa actual<select [(ngModel)]="seasonForm.currentStage" name="seasonStage"><option value="GROUP_STAGE">Fase de zonas</option><option value="ROUND_OF_16">Octavos</option><option value="QUARTERFINAL">Cuartos</option><option value="SEMIFINAL">Semifinales</option><option value="FINAL">Final</option></select></label>
                <label>Zona horaria<input [(ngModel)]="seasonForm.timezone" name="timezone"></label>
                <label>Inscripción por pareja<input type="number" [(ngModel)]="seasonForm.registrationFee" name="fee" min="0"></label>
                <label>Premio 1.º<input [(ngModel)]="seasonForm.firstPrize" name="firstPrize"></label>
                <label>Premio 2.º<input [(ngModel)]="seasonForm.secondPrize" name="secondPrize"></label>
                <label class="wide">Nota de horarios<textarea [(ngModel)]="seasonForm.scheduleNote" name="scheduleNote"></textarea></label>
                <label class="wide">Nota de pelotas<textarea [(ngModel)]="seasonForm.ballAvailabilityNote" name="ballNote"></textarea></label>
              </div>
              <div class="actions"><button class="btn primary" [disabled]="saving()">{{ saving() ? 'Guardando...' : 'Guardar temporada' }}</button></div>
            </form>
          }

          @if (activeTab() === 'pairs') {
            <div class="league-admin-section-title"><div><span class="eyebrow">PARTICIPANTES</span><h2>Parejas y jugadores</h2><p>Cambiar un número ocupado intercambia el orden de ambas parejas.</p></div></div>
            <div class="league-admin-zones">
              @for (zone of leagueData.zones; track zone.id) {
                <section class="panel"><header><h3>{{ zone.name }}</h3><span>{{ zone.pairs.length }}/8</span></header>
                  <div class="league-pair-list">
                    @for (pair of zone.pairs; track pair.id) {
                      <article><label>N.º<input type="number" min="1" max="8" [(ngModel)]="pair.seedNumber"></label><label>Jugador 1<input [(ngModel)]="pair.firstPlayer.displayName"></label><span>+</span><label>Jugador 2<input [(ngModel)]="pair.secondPlayer.displayName"></label><label>Zona<select [(ngModel)]="pairZone[pair.id]"><option [ngValue]="leagueData.zones[0].id">A</option><option [ngValue]="leagueData.zones[1].id">B</option></select></label><button type="button" class="btn ghost" [disabled]="savingId() === pair.id" (click)="savePair(pair)">{{ savingId() === pair.id ? 'Guardando...' : 'Guardar' }}</button></article>
                    }
                  </div>
                </section>
              }
            </div>
            <form class="panel league-add-pair" (ngSubmit)="addPair()"><div><h3>Agregar pareja</h3><p>El backend impide duplicados y números repetidos.</p></div><label>Zona<select [(ngModel)]="pairForm.zoneId" name="pairZone"><option [ngValue]="leagueData.zones[0].id">Zona A</option><option [ngValue]="leagueData.zones[1].id">Zona B</option></select></label><label>N.º<input type="number" min="1" max="8" [(ngModel)]="pairForm.seedNumber" name="pairSeed"></label><label>Jugador 1<input [(ngModel)]="pairForm.firstPlayer" name="pairFirst" required></label><label>Jugador 2<input [(ngModel)]="pairForm.secondPlayer" name="pairSecond" required></label><button class="btn primary" [disabled]="saving()">Agregar</button></form>
          }

          @if (activeTab() === 'fixture') {
            <div class="league-admin-section-title"><div><span class="eyebrow">CALENDARIO</span><h2>Fixture y horarios</h2><p>Las siete fechas respetan el orden oficial del documento.</p></div><button type="button" class="btn primary" [disabled]="saving()" (click)="generateFixture()">Generar / completar fixture</button></div>
            <div class="league-fixture-admin">
              @for (match of leagueData.matches; track match.id) {
                <article class="panel"><header><div><span class="tag">{{ match.zone?.name || stageLabel(match.stage) }}</span><strong>{{ match.matchday ? 'Fecha ' + match.matchday : match.code }}</strong></div><span [attr.data-status]="match.status">{{ statusLabel(match.status) }}</span></header><div class="league-match-edit"><label>Fecha<input type="date" [(ngModel)]="match.scheduledDate"></label><label>Hora<input type="time" [(ngModel)]="match.scheduledTime"></label><label>Estado<select [(ngModel)]="match.status"><option value="SCHEDULED">Programado</option><option value="LIVE">En juego</option><option value="RESCHEDULED">Reprogramado</option><option value="SUSPENDED">Suspendido</option><option value="PENDING">Pendiente</option><option value="FINISHED">Finalizado</option></select></label>@if (match.stage !== 'GROUP_STAGE') { <label>Local<select [(ngModel)]="matchHome[match.id]"><option [ngValue]="null">{{ match.homePlaceholder }}</option>@for (pair of allPairs(); track pair.id) { <option [ngValue]="pair.id">{{ pair.displayName }}</option> }</select></label><label>Visitante<select [(ngModel)]="matchAway[match.id]"><option [ngValue]="null">{{ match.awayPlaceholder }}</option>@for (pair of allPairs(); track pair.id) { <option [ngValue]="pair.id">{{ pair.displayName }}</option> }</select></label> }<label class="wide">Motivo / nota<input [(ngModel)]="match.rescheduleNote" placeholder="Sin inventar una regla: describí el caso"></label></div><footer><div><strong>{{ match.homePair?.displayName || match.homePlaceholder }}</strong><span>vs.</span><strong>{{ match.awayPair?.displayName || match.awayPlaceholder }}</strong></div><button type="button" class="btn ghost" [disabled]="savingId() === match.id" (click)="saveMatch(match)">{{ savingId() === match.id ? 'Guardando...' : 'Guardar partido' }}</button></footer></article>
              }
            </div>
          }

          @if (activeTab() === 'results') {
            <div class="league-admin-section-title"><div><span class="eyebrow">MARCADORES</span><h2>Resultados por set</h2><p>Cargá un borrador y luego confirmalo oficialmente para actualizar posiciones y cruces.</p></div></div>
            @if (pendingScores().length) { <div class="league-score-alert"><strong>{{ pendingScores().length }} resultado(s) con puntaje pendiente</strong><span>La derrota 0–2 todavía no tiene asignación configurada.</span></div> }
            <div class="league-results-layout">
              <div class="league-result-list">
                @for (match of playableMatches(); track match.id) { <button type="button" [class.active]="resultMatch()?.id === match.id" (click)="editResult(match)"><span>{{ match.zone?.name || stageLabel(match.stage) }} · {{ match.matchday ? 'F' + match.matchday : match.code }}</span><strong>{{ match.homePair?.displayName || match.homePlaceholder }} vs. {{ match.awayPair?.displayName || match.awayPlaceholder }}</strong><small>{{ match.scheduledDate || 'Fecha pendiente' }} · {{ match.scheduledTime || 'Hora pendiente' }} · {{ match.official ? 'OFICIAL' : match.sets.length ? 'BORRADOR' : 'SIN RESULTADO' }}</small></button> }
              </div>
              @if (resultMatch(); as match) {
                <section class="panel league-result-editor"><header><div><span class="tag">{{ match.code }}</span><h3>{{ match.homePair?.displayName || match.homePlaceholder }} <small>vs.</small> {{ match.awayPair?.displayName || match.awayPlaceholder }}</h3></div>@if (match.official) { <span class="league-official">OFICIAL</span> }</header>
                  <div class="league-set-editor"><div class="league-set-header"><span></span>@for (set of resultSets; track $index) { <b>SET {{ $index + 1 }}</b> }</div><div><strong>{{ match.homePair?.displayName || match.homePlaceholder }}</strong>@for (set of resultSets; track $index) { <input type="number" min="0" max="7" [(ngModel)]="set.homeGames" [attr.aria-label]="'Games local set ' + ($index + 1)"> }</div><div><strong>{{ match.awayPair?.displayName || match.awayPlaceholder }}</strong>@for (set of resultSets; track $index) { <input type="number" min="0" max="7" [(ngModel)]="set.awayGames" [attr.aria-label]="'Games visitante set ' + ($index + 1)"> }</div></div>
                  <div class="league-result-tools">@if (resultSets.length === 2) { <button type="button" class="link" (click)="addThirdSet()">+ Agregar tercer set</button> } @else { <button type="button" class="link danger-text" (click)="removeThirdSet()">Quitar tercer set</button> }</div>
                  <p class="league-result-help">Marcadores admitidos por set completo: 6–0 a 6–4, 7–5 o 7–6. No se acepta 10–x porque el tercer set no es super tie-break.</p>
                  @if (resultFeedback()) { <p class="league-result-feedback" [class.error]="resultFeedbackError()" role="status">{{ resultFeedback() }}</p> }
                  <div class="actions">@if (match.sets.length) { <button type="button" class="btn ghost danger-text" [disabled]="saving()" (click)="requestResultReset()">Quitar resultado</button> }<button type="button" class="btn ghost" [disabled]="saving()" (click)="saveResult()">{{ match.official ? 'Corregir resultado' : 'Guardar borrador' }}</button>@if (!match.official) { <button type="button" class="btn primary" [disabled]="saving()" (click)="saveAndConfirmResult()">{{ saving() ? 'Guardando...' : 'Guardar y confirmar' }}</button> }</div>
                </section>
              } @else { <div class="empty">Elegí un partido para cargar o revisar su resultado.</div> }
            </div>
          }

          @if (activeTab() === 'rules') {
            <form class="panel league-rules-form" (ngSubmit)="saveRules()"><header><div><span class="eyebrow">REGLAMENTO</span><h2>Puntajes y definiciones</h2></div><span>{{ leagueData.rules.pending.length }} pendiente(s)</span></header><p class="league-rule-notice">Los puntajes confirmados se aplican automáticamente. Las definiciones todavía pendientes se publican como advertencias, sin inferir reglas que el reglamento no explique.</p><div class="form-grid three"><label>Victoria 2–0<input type="number" [(ngModel)]="rulesForm.straightSetsWinPoints" name="r1" min="0"></label><label>Victoria 2–1<input type="number" [(ngModel)]="rulesForm.threeSetsWinPoints" name="r2" min="0"></label><label>Derrota 1–2<input type="number" [(ngModel)]="rulesForm.threeSetsLossPoints" name="r3" min="0"></label><label>Derrota 0–2<input type="number" [(ngModel)]="rulesForm.straightSetsLossPoints" name="r4" min="0" required></label><label class="wide">Definición de “games positivos”<textarea [(ngModel)]="rulesForm.gamesPositiveDefinition" name="r5" placeholder="Pendiente de definición"></textarea></label><label class="wide">Empate entre tres o más parejas<textarea [(ngModel)]="rulesForm.multiPairTieRule" name="r6" placeholder="Pendiente de definición"></textarea></label><label>Walkover / ausencia<textarea [(ngModel)]="rulesForm.walkoverRule" name="r7"></textarea></label><label>Abandono por lesión<textarea [(ngModel)]="rulesForm.retirementRule" name="r8"></textarea></label><label>Partido inconcluso<textarea [(ngModel)]="rulesForm.incompleteMatchRule" name="r9"></textarea></label><label>Reprogramaciones<textarea [(ngModel)]="rulesForm.reschedulingRule" name="r10"></textarea></label><label>Tie-break en 6–6<textarea [(ngModel)]="rulesForm.sixAllTiebreakRule" name="r11"></textarea></label></div><button class="btn primary" [disabled]="saving()">Guardar reglas</button></form>
          }

          @if (activeTab() === 'standings') {
            <div class="league-admin-section-title"><div><span class="eyebrow">CÁLCULO AUTOMÁTICO</span><h2>Posiciones</h2><p>Vista administrativa de las tablas derivadas de resultados oficiales.</p></div></div>
            <div class="league-admin-zones league-admin-standings">
              @for (table of leagueData.standings; track table.zone.id) {
                <section class="panel league-admin-standings-panel">
                  <header><h3>{{ table.zone.name }}</h3><span>{{ table.rankingComplete ? 'Calculada' : 'Pendiente' }}</span></header>
                  @for (warning of table.warnings; track warning) { <p class="error-notice notice">{{ warning }}</p> }
                  <div class="league-admin-standing-cards" [attr.aria-label]="'Posiciones y estadísticas ' + table.zone.name">
                    @for (row of table.rows; track row.pairId) {
                      <article>
                        <header><span><small>POS</small><strong>{{ row.position }}</strong></span><h4>{{ row.pair }}</h4><span class="points"><small>PTS</small><strong>{{ row.points === null ? 'Pend.' : row.points }}</strong></span></header>
                        <dl><div><dt>PJ</dt><dd>{{ row.played }}</dd></div><div><dt>PG</dt><dd>{{ row.won }}</dd></div><div><dt>PP</dt><dd>{{ row.lost }}</dd></div><div><dt>SF</dt><dd>{{ row.setsFor }}</dd></div><div><dt>SC</dt><dd>{{ row.setsAgainst }}</dd></div><div><dt>DS</dt><dd>{{ signed(row.setDifference) }}</dd></div><div><dt>GF</dt><dd>{{ row.gamesFor }}</dd></div><div><dt>GC</dt><dd>{{ row.gamesAgainst }}</dd></div><div><dt>DG</dt><dd>{{ signed(row.gameDifference) }}</dd></div></dl>
                      </article>
                    } @empty { <div class="empty">Todavía no hay parejas en esta zona.</div> }
                  </div>
                  <p class="league-admin-table-hint" [id]="'admin-standings-hint-' + table.zone.code">Deslizá la tabla para ver todas las estadísticas →</p>
                  <div class="league-admin-table" tabindex="0" [attr.aria-describedby]="'admin-standings-hint-' + table.zone.code" [attr.aria-label]="'Tabla administrativa ' + table.zone.name">
                    <table><thead><tr><th>POS</th><th>PAREJA</th><th>PJ</th><th>PG</th><th>PP</th><th>SF</th><th>SC</th><th>DS</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead><tbody>
                      @for (row of table.rows; track row.pairId) { <tr><td>{{ row.position }}</td><th scope="row">{{ row.pair }}</th><td>{{ row.played }}</td><td>{{ row.won }}</td><td>{{ row.lost }}</td><td>{{ row.setsFor }}</td><td>{{ row.setsAgainst }}</td><td>{{ signed(row.setDifference) }}</td><td>{{ row.gamesFor }}</td><td>{{ row.gamesAgainst }}</td><td>{{ signed(row.gameDifference) }}</td><td><strong>{{ row.points === null ? 'Pend.' : row.points }}</strong></td></tr> }
                      @empty { <tr><td colspan="12">Todavía no hay parejas en esta zona.</td></tr> }
                    </tbody></table>
                  </div>
                </section>
              }
            </div>
          }

          @if (activeTab() === 'bracket') {
            <div class="league-admin-section-title"><div><span class="eyebrow">ELIMINATORIAS</span><h2>Progresión del cuadro</h2><p>Los ganadores avanzan al confirmar oficialmente cada partido.</p></div></div>
            <div class="league-admin-bracket">@for (round of leagueData.bracket; track round.stage) { <section><h3>{{ stageLabel(round.stage) }}</h3>@for (match of round.matches; track match.id) { <article><span>{{ match.code }} · {{ match.scheduledDate || 'Fecha pendiente' }} · {{ match.scheduledTime || 'Hora pendiente' }}</span><strong>{{ match.homePair?.displayName || match.homePlaceholder }}</strong><b>vs.</b><strong>{{ match.awayPair?.displayName || match.awayPlaceholder }}</strong>@if (match.official) { <em>{{ match.result?.homeSets }}–{{ match.result?.awaySets }}</em> }</article> }</section> }</div>
          }
        } @else if (!leagues().length && !showCreate()) {
          <div class="empty"><strong>No hay temporadas creadas.</strong><button type="button" class="btn primary" (click)="showCreate.set(true)">Crear la primera</button></div>
        }
      </div>
    </section>

    @if (correctionPending()) {
      <app-confirm-dialog title="Corregir resultado oficial" message="El resultado ya fue oficializado. Al corregirlo volverá a estado de borrador y se recalcularán las posiciones." secondaryMessage="La corrección queda registrada con tu usuario y fecha. Si el siguiente cruce ya tiene resultado, el backend impedirá el cambio." confirmText="Sí, corregir" [loading]="saving()" [error]="dialogError()" (confirm)="saveResult(true)" (cancel)="cancelCorrection()" />
    }
    @if (resetPending()) {
      <app-confirm-dialog title="Quitar resultado" [message]="resultMatch()?.official ? 'Este resultado es oficial. El partido volverá a figurar sin resultado y se recalcularán las posiciones y los cruces.' : 'Se borrará el marcador cargado y el partido volverá a figurar sin resultado.'" secondaryMessage="La acción queda registrada con tu usuario y fecha. Si un cruce posterior ya tiene resultado, el sistema impedirá el cambio." confirmText="Sí, quitar resultado" [loading]="saving()" [error]="dialogError()" (confirm)="resetResult()" (cancel)="cancelResultReset()" />
    }
  `,
  styles: [`
    :host{display:block}.league-admin-head{display:flex;align-items:end;justify-content:space-between;gap:28px;margin-bottom:26px}.league-admin-head h1{margin:6px 0 4px;font-size:4.6rem}.league-admin-head p{margin:0}.league-admin-head-actions{display:flex;align-items:end;gap:10px}.league-admin-head-actions label{display:grid;gap:5px;min-width:250px;font-size:.7rem;font-weight:800}.league-create-form{display:grid;grid-template-columns:1.3fr repeat(3,1fr) auto;align-items:end;gap:14px;margin-bottom:22px}.league-create-form h2{margin:4px 0}.league-create-form p{margin:0;font-size:.75rem}.league-admin-tabs{display:flex;overflow-x:auto;margin-bottom:25px;border-bottom:1px solid var(--color-brand-border)}.league-admin-tabs button{display:flex;flex:0 0 auto;align-items:center;gap:7px;min-height:52px;border:0;border-bottom:3px solid transparent;padding:0 15px;background:transparent;color:var(--color-brand-muted);font-size:.76rem;white-space:nowrap}.league-admin-tabs button.active{border-bottom-color:var(--color-brand-gold);color:var(--color-brand-dark)}.league-admin-tabs button span{display:grid;min-width:19px;height:19px;place-content:center;border-radius:50%;background:#d7a53a;color:#fff;font-size:.62rem}.league-form-heading,.league-rules-form>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.league-form-heading h2,.league-rules-form h2{margin:4px 0;font-size:2.5rem}.league-season-badge,.league-rules-form>header>span{border-radius:99px;padding:7px 11px;background:#e5eadf;color:var(--color-brand-green);font-size:.7rem;font-weight:800}.league-season-badge[data-status=CLOSED]{background:#e6e6e3;color:#5d625c}.league-season-badge[data-status=DRAFT]{background:#fff0c8;color:#725718}.league-admin-section-title{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}.league-admin-section-title h2{margin:5px 0;font-size:3rem}.league-admin-section-title p{margin:0}.league-admin-zones{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.league-admin-zones>.panel>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.league-admin-zones h3{margin:0;font-size:2rem}.league-pair-list{display:grid}.league-pair-list article{display:grid;grid-template-columns:58px 1fr auto 1fr 72px auto;align-items:end;gap:8px;border-bottom:1px solid var(--color-brand-border);padding:10px 0}.league-pair-list label,.league-add-pair label,.league-match-edit label{display:grid;gap:4px;font-size:.62rem;font-weight:800}.league-pair-list article>span{padding-bottom:12px;color:var(--color-brand-gold)}.league-add-pair{display:grid;grid-template-columns:1.4fr 110px 80px 1fr 1fr auto;align-items:end;gap:12px;margin-top:18px}.league-add-pair h3{margin:0}.league-add-pair p{margin:3px 0 0;font-size:.7rem}.league-fixture-admin{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.league-fixture-admin>.panel{padding:17px}.league-fixture-admin article>header{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}.league-fixture-admin article>header div{display:flex;align-items:center;gap:8px}.league-fixture-admin article>header>span{font-size:.64rem;font-weight:800;color:var(--color-brand-green)}.league-match-edit{display:grid;grid-template-columns:1fr 100px 1fr;gap:9px}.league-match-edit .wide{grid-column:1/-1}.league-fixture-admin footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px;border-top:1px solid var(--color-brand-border);padding-top:13px}.league-fixture-admin footer div{display:flex;flex-wrap:wrap;gap:6px;font-size:.72rem}.league-fixture-admin footer span{color:var(--color-brand-gold)}.league-score-alert{display:grid;gap:3px;margin-bottom:18px;border-left:4px solid #c5952e;padding:12px 15px;background:#fff0c9;color:#6b5118}.league-results-layout{display:grid;grid-template-columns:minmax(280px,.75fr) minmax(430px,1.25fr);gap:18px}.league-result-list{display:grid;max-height:700px;overflow:auto;align-content:start;gap:7px}.league-result-list button{display:grid;gap:3px;border:1px solid var(--color-brand-border);border-radius:9px;padding:12px;background:var(--color-brand-paper);text-align:left}.league-result-list button.active{border-color:var(--color-brand-green);box-shadow:inset 4px 0 var(--color-brand-green)}.league-result-list span{font-size:.61rem;color:var(--color-brand-gold)}.league-result-list strong{font-family:var(--font-body);font-size:.74rem}.league-result-list small{color:var(--color-brand-muted)}.league-result-editor>header{display:flex;align-items:start;justify-content:space-between;gap:14px}.league-result-editor h3{margin:8px 0 0;font-size:1.45rem}.league-result-editor h3 small{color:var(--color-brand-gold)}.league-official{border-radius:99px;padding:6px 9px;background:var(--color-brand-dark);color:#fff;font-size:.62rem;font-weight:800}.league-set-editor{display:grid;gap:8px;margin:28px 0 10px}.league-set-editor>div{display:grid;grid-template-columns:minmax(160px,1fr) repeat(3,72px);gap:8px;align-items:center}.league-set-editor input{padding-right:6px;padding-left:6px;text-align:center;font-family:var(--font-display);font-size:1.2rem}.league-set-header b{text-align:center;font-size:.65rem;color:var(--color-brand-muted)}.league-result-tools{min-height:35px}.league-result-help,.league-rule-notice{border-left:3px solid var(--color-brand-gold);padding:10px 12px;background:#f3f0e4;font-size:.73rem}.league-rules-form>header{border-bottom:1px solid var(--color-brand-border);padding-bottom:16px}.league-rules-form textarea{min-height:80px}.league-admin-table{overflow-x:auto}.league-admin-table table{width:100%;border-collapse:collapse}.league-admin-table th,.league-admin-table td{border-bottom:1px solid var(--color-brand-border);padding:9px;text-align:center;font-size:.72rem}.league-admin-table th:nth-child(2){text-align:left}.league-admin-bracket{display:grid;grid-template-columns:repeat(4,minmax(240px,1fr));gap:16px;overflow-x:auto}.league-admin-bracket section{display:grid;align-content:start;gap:9px}.league-admin-bracket h3{border-bottom:2px solid var(--color-brand-gold);padding-bottom:8px}.league-admin-bracket article{display:grid;gap:5px;border:1px solid var(--color-brand-border);border-radius:9px;padding:11px;background:var(--color-brand-paper)}.league-admin-bracket article span{font-size:.6rem;color:var(--color-brand-muted)}.league-admin-bracket article b{color:var(--color-brand-gold);font-size:.65rem}.league-admin-bracket article em{font-family:var(--font-display);font-style:normal;color:var(--color-brand-green)}
    @media(max-width:1100px){.league-admin-head{align-items:start;flex-direction:column}.league-admin-head-actions{width:100%;flex-wrap:wrap}.league-create-form{grid-template-columns:repeat(2,1fr)}.league-create-form>div{grid-column:1/-1}.league-admin-zones,.league-fixture-admin{grid-template-columns:1fr}.league-add-pair{grid-template-columns:repeat(2,1fr)}.league-add-pair>div{grid-column:1/-1}.league-results-layout{grid-template-columns:1fr}.league-result-list{grid-template-columns:repeat(2,1fr);max-height:420px}}
    @media(max-width:700px){.league-admin-head h1{font-size:3.4rem}.league-admin-head-actions{display:grid}.league-admin-head-actions label{min-width:0}.league-create-form,.league-add-pair{grid-template-columns:1fr}.league-pair-list article{grid-template-columns:58px 1fr 1fr}.league-pair-list article>span{display:none}.league-pair-list article label:nth-of-type(4),.league-pair-list article button{grid-column:auto}.league-admin-section-title{align-items:start;flex-direction:column}.league-fixture-admin footer{align-items:stretch;flex-direction:column}.league-match-edit{grid-template-columns:1fr}.league-match-edit .wide{grid-column:auto}.league-result-list{grid-template-columns:1fr}.league-set-editor>div{grid-template-columns:minmax(100px,1fr) repeat(3,55px)}.league-set-editor>div:not(.league-set-header)>strong{font-size:.68rem}.league-admin-form .form-grid,.league-rules-form .form-grid{grid-template-columns:1fr}.league-admin-form .wide,.league-rules-form .wide{grid-column:auto}}
  `,
  `.league-result-feedback{margin:12px 0 0;border-left:4px solid var(--color-brand-green);border-radius:7px;padding:11px 13px;background:#e6efe1;color:var(--color-brand-green);font-size:.76rem;font-weight:700}.league-result-feedback.error{border-left-color:#a94738;background:#f9e2dc;color:#812f25}`,
  `
    .league-set-editor input,.league-admin-bracket article em,.league-admin-standing-cards header small,.league-admin-standing-cards header strong,.league-admin-standing-cards dt,.league-admin-standing-cards dd{font-family:var(--font-body);font-weight:600}
    .league-admin-tabs{overscroll-behavior-inline:contain;scrollbar-width:thin;scroll-snap-type:x proximity}
    .league-admin-tabs button{scroll-snap-align:start}
    .league-admin-tabs-hint{display:none}
    .league-admin-standings{grid-template-columns:minmax(0,1fr)}
    .league-admin-standing-cards{display:none}
    .league-admin-table-hint{display:none;margin:10px 0 0;border-bottom:1px solid var(--color-brand-border);padding:9px 12px;background:#fff6d9;color:#6f551a;font-size:.7rem;font-weight:750}
    .league-admin-table{overscroll-behavior-inline:contain;scrollbar-gutter:stable;scrollbar-width:thin;touch-action:pan-x pan-y}
    .league-admin-table table{min-width:1020px;font-variant-numeric:tabular-nums}
    .league-admin-table th,.league-admin-table td{font-variant-numeric:tabular-nums}
    .league-admin-table th:first-child,.league-admin-table td:first-child{position:sticky;left:0;z-index:2;width:62px;background:var(--color-brand-paper)}
    .league-admin-table th:nth-child(2){position:sticky;left:62px;z-index:2;width:240px;max-width:240px;background:var(--color-brand-paper);box-shadow:7px 0 10px -10px rgba(20,40,27,.8);white-space:normal;overflow-wrap:anywhere}
    .league-admin-table th:last-child,.league-admin-table td:last-child{position:sticky;right:0;z-index:2;min-width:68px;background:var(--color-brand-paper);box-shadow:-7px 0 10px -10px rgba(20,40,27,.8)}
    .league-admin-table thead th:first-child,.league-admin-table thead th:nth-child(2),.league-admin-table thead th:last-child{z-index:3;background:#ece9dd}
    .league-admin-table td:last-child strong{font-size:.9rem;color:var(--color-brand-green)}
    @media(min-width:701px) and (max-width:1180px){.league-admin-table-hint{display:block}}
    @media(max-width:700px){
      .league-admin-tabs-hint{display:block;margin:-25px 0 24px;padding-top:4px;color:var(--color-brand-muted);font-size:.62rem;text-align:right}
      .league-admin-table,.league-admin-table-hint{display:none}
      .league-admin-standing-cards{display:grid;gap:9px;margin-top:12px}
      .league-admin-standing-cards>article{overflow:hidden;border:1px solid var(--color-brand-border);border-radius:10px;background:var(--color-brand-paper)}
      .league-admin-standing-cards>article>header{display:grid;grid-template-columns:48px minmax(0,1fr) 54px;align-items:stretch;gap:9px;min-height:68px;border-bottom:1px solid var(--color-brand-border)}
      .league-admin-standing-cards h4{align-self:center;margin:0;padding:9px 0;font-family:var(--font-body);font-size:.78rem;line-height:1.35;overflow-wrap:anywhere}
      .league-admin-standing-cards header>span{display:grid;align-content:center;justify-items:center;gap:2px;padding:7px 4px;background:#f1eee3;font-variant-numeric:tabular-nums}
      .league-admin-standing-cards header>span:first-child{border-right:1px solid var(--color-brand-border)}
      .league-admin-standing-cards header>span.points{border-left:1px solid rgba(255,255,255,.16);background:var(--color-brand-dark);color:#fff}
      .league-admin-standing-cards header small{font-family:var(--font-display);font-size:.56rem;letter-spacing:.07em}
      .league-admin-standing-cards header strong{font-family:var(--font-display);font-size:1rem;color:var(--color-brand-green)}
      .league-admin-standing-cards header .points strong{font-size:1.55rem;line-height:1;color:#fff}
      .league-admin-standing-cards .ranking-pending header>span:first-child strong{font-size:.7rem;color:#8a681d}
      .league-admin-standing-cards dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0;padding:5px 7px 8px}
      .league-admin-standing-cards dl div{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:4px;min-height:36px;border-bottom:1px solid rgba(31,51,38,.09);padding:3px 6px}
      .league-admin-standing-cards dt{font-family:var(--font-display);font-size:.6rem;color:var(--color-brand-muted)}
      .league-admin-standing-cards dd{margin:0;text-align:right;font-family:var(--font-display);font-size:.86rem;font-variant-numeric:tabular-nums}
    }
    @media(max-width:420px){.league-set-editor>div{grid-template-columns:minmax(0,1fr) repeat(3,minmax(44px,52px));gap:4px}.league-set-editor input{padding-right:2px;padding-left:2px}}
  `]
})
export class AdminLeaguePage implements OnInit {
  private readonly api = inject(Api);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  readonly leagues = signal<any[]>([]);
  readonly selectedLeagueId = signal<number | null>(null);
  readonly data = signal<LeaguePayload | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savingId = signal<number | null>(null);
  readonly notice = signal('');
  readonly noticeError = signal(false);
  readonly showCreate = signal(false);
  readonly activeTab = signal<AdminLeagueTab>('season');
  readonly resultMatch = signal<LeagueMatch | null>(null);
  readonly correctionPending = signal(false);
  readonly resetPending = signal(false);
  readonly dialogError = signal('');
  readonly resultFeedback = signal('');
  readonly resultFeedbackError = signal(false);
  private requestId = 0;
  readonly tabs: Array<{ id: AdminLeagueTab; label: string }> = [
    { id: 'season', label: 'Temporada' }, { id: 'pairs', label: 'Parejas' }, { id: 'fixture', label: 'Fixture' },
    { id: 'results', label: 'Resultados' }, { id: 'rules', label: 'Reglas' }, { id: 'standings', label: 'Posiciones' }, { id: 'bracket', label: 'Eliminatorias' }
  ];
  createForm: any = { name: 'Liga Suma 12', slug: 'liga-suma-12-2026', seasonYear: 2026, status: 'DRAFT', currentStage: 'GROUP_STAGE', timezone: 'America/Argentina/Cordoba' };
  seasonForm: any = {};
  rulesForm: any = {};
  pairForm: any = { zoneId: null, seedNumber: 1, firstPlayer: '', secondPlayer: '' };
  pairZone: Record<number, number> = {};
  matchHome: Record<number, number | null> = {};
  matchAway: Record<number, number | null> = {};
  resultSets: Array<{ homeGames: number | null; awayGames: number | null }> = [{ homeGames: null, awayGames: null }, { homeGames: null, awayGames: null }];

  ngOnInit() {
    this.loadLeagues();
    merge(this.realtime.listen(['LEAGUE_CHANGED']), this.realtime.resync$).pipe(debounceTime(180), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.selectedLeagueId()) this.loadLeague(this.selectedLeagueId()!, true);
    });
  }

  loadLeagues(selectId?: number) {
    this.api.get<any[]>('/admin/leagues', undefined, { noCache: true }).subscribe({
      next: leagues => {
        this.leagues.set(leagues);
        const id = selectId ?? this.selectedLeagueId() ?? leagues.find(item => item.status === 'ACTIVE')?.id ?? leagues[0]?.id ?? null;
        this.selectedLeagueId.set(id);
        if (id) this.loadLeague(id); else this.loading.set(false);
      },
      error: error => { this.loading.set(false); this.showNotice(error.error?.message ?? 'No se pudieron cargar las temporadas.', true); }
    });
  }

  selectLeague(id: number) { this.selectedLeagueId.set(Number(id)); this.resultMatch.set(null); this.loadLeague(Number(id)); }

  loadLeague(id: number, background = false) {
    const requestId = ++this.requestId;
    if (!background) this.loading.set(true);
    this.api.get<LeaguePayload>(`/admin/leagues/${id}`, undefined, { noCache: true }).pipe(finalize(() => { if (requestId === this.requestId) this.loading.set(false); })).subscribe({
      next: data => { if (requestId === this.requestId) { this.data.set(data); this.prepareForms(data); const selected = this.resultMatch(); if (selected) this.resultMatch.set(data.matches.find(match => match.id === selected.id) ?? null); } },
      error: error => { if (requestId === this.requestId) this.showNotice(error.error?.message ?? 'No se pudo cargar la liga.', true); }
    });
  }

  prepareForms(data: LeaguePayload) {
    this.seasonForm = { ...data.league };
    this.rulesForm = { ...data.rules.scoring };
    for (const field of ['gamesPositiveDefinition', 'multiPairTieRule', 'walkoverRule', 'retirementRule', 'incompleteMatchRule', 'reschedulingRule', 'sixAllTiebreakRule']) this.rulesForm[field] ??= null;
    for (const zone of data.zones) for (const pair of zone.pairs) this.pairZone[pair.id] = zone.id;
    for (const match of data.matches) { this.matchHome[match.id] = match.homePair?.id ?? null; this.matchAway[match.id] = match.awayPair?.id ?? null; }
    this.pairForm.zoneId ??= data.zones[0]?.id ?? null;
  }

  createLeague() {
    this.runSave(this.api.post<LeaguePayload>('/admin/leagues', { ...this.createForm, currentStage: 'GROUP_STAGE', timezone: 'America/Argentina/Cordoba' }), 'Temporada creada.', response => { this.showCreate.set(false); this.loadLeagues(response.league.id); });
  }

  saveSeason() {
    const id = this.selectedLeagueId(); if (!id) return;
    const fields = ['name', 'slug', 'seasonYear', 'status', 'currentStage', 'timezone', 'registrationFee', 'firstPrize', 'secondPrize', 'ballAvailabilityNote', 'scheduleNote'];
    const payload = Object.fromEntries(fields.map(field => [field, this.seasonForm[field] === '' ? null : this.seasonForm[field]]));
    this.runSave(this.api.patch(`/admin/leagues/${id}`, payload), 'Temporada guardada.', () => { this.loadLeagues(id); });
  }

  savePair(pair: any) {
    const leagueId = this.selectedLeagueId(); if (!leagueId) return;
    this.savingId.set(pair.id);
    this.api.patch(`/admin/leagues/${leagueId}/pairs/${pair.id}`, { zoneId: this.pairZone[pair.id], seedNumber: Number(pair.seedNumber), firstPlayer: pair.firstPlayer.displayName, secondPlayer: pair.secondPlayer.displayName, active: true }).pipe(finalize(() => this.savingId.set(null))).subscribe({ next: () => { this.showNotice('Pareja actualizada.'); this.loadLeague(leagueId, true); }, error: error => this.showNotice(error.error?.message ?? 'No se pudo guardar la pareja.', true) });
  }

  addPair() {
    const leagueId = this.selectedLeagueId(); if (!leagueId) return;
    this.runSave(this.api.post(`/admin/leagues/${leagueId}/pairs`, { ...this.pairForm, seedNumber: Number(this.pairForm.seedNumber), active: true }), 'Pareja agregada.', () => { this.pairForm.firstPlayer = ''; this.pairForm.secondPlayer = ''; this.loadLeague(leagueId, true); });
  }

  generateFixture() {
    const leagueId = this.selectedLeagueId(); if (!leagueId) return;
    this.runSave(this.api.post(`/admin/leagues/${leagueId}/fixture/generate`, {}), 'Fixture generado sin duplicados.', response => this.data.set(response as LeaguePayload));
  }

  saveMatch(match: LeagueMatch) {
    const leagueId = this.selectedLeagueId(); if (!leagueId) return;
    this.savingId.set(match.id);
    const payload = { scheduledDate: match.scheduledDate || null, scheduledTime: match.scheduledTime || null, status: match.status, rescheduleNote: match.rescheduleNote || null, ...(match.stage === 'GROUP_STAGE' ? {} : { homePairId: this.matchHome[match.id], awayPairId: this.matchAway[match.id] }) };
    this.api.patch(`/admin/leagues/${leagueId}/matches/${match.id}`, payload).pipe(finalize(() => this.savingId.set(null))).subscribe({ next: () => { this.showNotice('Partido actualizado.'); this.loadLeague(leagueId, true); }, error: error => this.showNotice(error.error?.message ?? 'No se pudo actualizar el partido.', true) });
  }

  editResult(match: LeagueMatch) {
    this.resultMatch.set(match);
    this.resultFeedback.set('');
    this.resultFeedbackError.set(false);
    this.resultSets = match.sets.length ? match.sets.map(set => ({ homeGames: set.homeGames, awayGames: set.awayGames })) : [{ homeGames: null, awayGames: null }, { homeGames: null, awayGames: null }];
  }
  addThirdSet() { if (this.resultSets.length === 2) this.resultSets = [...this.resultSets, { homeGames: null, awayGames: null }]; }
  removeThirdSet() { this.resultSets = this.resultSets.slice(0, 2); }

  saveResult(correctionConfirmed = false) {
    const leagueId = this.selectedLeagueId(); const match = this.resultMatch(); if (!leagueId || !match) return;
    if (match.official && !correctionConfirmed) { this.correctionPending.set(true); this.dialogError.set(''); return; }
    const sets = this.preparedResultSets(); if (!sets) return;
    this.saving.set(true);
    this.api.put<LeaguePayload>(`/admin/leagues/${leagueId}/matches/${match.id}/result`, { sets, correctionConfirmed }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: data => { this.correctionPending.set(false); this.data.set(data); const updated = data.matches.find(item => item.id === match.id)!; this.editResult(updated); this.setResultFeedback(correctionConfirmed ? 'Resultado corregido y vuelto a borrador.' : 'Borrador guardado. Ya podés confirmarlo oficialmente.'); },
      error: error => { const message = error.error?.message ?? 'No se pudo guardar el resultado.'; if (this.correctionPending()) this.dialogError.set(message); else this.setResultFeedback(message, true); }
    });
  }

  saveAndConfirmResult() {
    const leagueId = this.selectedLeagueId(); const match = this.resultMatch(); if (!leagueId || !match || match.official) return;
    const sets = this.preparedResultSets(); if (!sets) return;
    this.saving.set(true);
    this.resultFeedback.set('');
    this.api.put<LeaguePayload>(`/admin/leagues/${leagueId}/matches/${match.id}/result`, { sets, correctionConfirmed: false }).pipe(
      switchMap(() => this.api.post<LeaguePayload>(`/admin/leagues/${leagueId}/matches/${match.id}/confirm`, {})),
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: data => { this.data.set(data); const updated = data.matches.find(item => item.id === match.id)!; this.editResult(updated); this.setResultFeedback('Resultado guardado y confirmado oficialmente.'); },
      error: error => this.setResultFeedback(error.error?.message ?? 'No se pudo guardar y confirmar el resultado.', true)
    });
  }

  confirmResult(match: LeagueMatch) {
    const leagueId = this.selectedLeagueId(); if (!leagueId) return;
    this.runSave(this.api.post<LeaguePayload>(`/admin/leagues/${leagueId}/matches/${match.id}/confirm`, {}), 'Resultado confirmado oficialmente.', data => { this.data.set(data); const updated = data.matches.find(item => item.id === match.id)!; this.editResult(updated); });
  }

  requestResultReset() {
    const match = this.resultMatch();
    if (!match?.sets.length || this.saving()) return;
    this.dialogError.set('');
    this.resetPending.set(true);
  }

  resetResult() {
    const leagueId = this.selectedLeagueId(); const match = this.resultMatch();
    if (!leagueId || !match || !match.sets.length) return;
    this.saving.set(true);
    this.api.post<LeaguePayload>(`/admin/leagues/${leagueId}/matches/${match.id}/result/reset`, { correctionConfirmed: true }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: data => {
        this.resetPending.set(false);
        this.data.set(data);
        const updated = data.matches.find(item => item.id === match.id)!;
        this.editResult(updated);
        this.setResultFeedback('Resultado quitado. El partido volvió a quedar sin jugar.');
      },
      error: error => this.dialogError.set(error.error?.message ?? 'No se pudo quitar el resultado.')
    });
  }

  cancelResultReset() { if (!this.saving()) { this.resetPending.set(false); this.dialogError.set(''); } }

  cancelCorrection() { if (!this.saving()) { this.correctionPending.set(false); this.dialogError.set(''); } }

  private preparedResultSets() {
    const incomplete = this.resultSets.some(set => set.homeGames == null || set.awayGames == null || !Number.isInteger(Number(set.homeGames)) || !Number.isInteger(Number(set.awayGames)));
    if (incomplete) {
      this.setResultFeedback('Completá los games de todos los sets antes de guardar.', true);
      return null;
    }
    return this.resultSets.map(set => ({ homeGames: Number(set.homeGames), awayGames: Number(set.awayGames) }));
  }

  private setResultFeedback(message: string, error = false) {
    this.resultFeedback.set(message);
    this.resultFeedbackError.set(error);
  }

  saveRules() {
    const leagueId = this.selectedLeagueId(); if (!leagueId) return;
    const payload = { ...this.rulesForm, straightSetsWinPoints: Number(this.rulesForm.straightSetsWinPoints), threeSetsWinPoints: Number(this.rulesForm.threeSetsWinPoints), threeSetsLossPoints: Number(this.rulesForm.threeSetsLossPoints), straightSetsLossPoints: Number(this.rulesForm.straightSetsLossPoints) };
    delete payload.id; delete payload.leagueId; delete payload.createdAt; delete payload.updatedAt; delete payload.updatedById;
    this.runSave(this.api.put(`/admin/leagues/${leagueId}/rules`, payload), 'Reglas guardadas.', () => this.loadLeague(leagueId, true));
  }

  allPairs() { return this.data()?.zones.flatMap(zone => zone.pairs) ?? []; }
  playableMatches() { return this.data()?.matches.filter(match => match.homePair && match.awayPair) ?? []; }
  pendingScores() { return this.data()?.matches.filter(match => match.official && match.scoringPending) ?? []; }
  seasonStatusLabel(status: string) { return ({ DRAFT: 'Borrador', ACTIVE: 'Activa', CLOSED: 'Cerrada' } as Record<string, string>)[status] ?? status; }
  statusLabel(status: string) { return ({ SCHEDULED: 'Programado', LIVE: 'En juego', FINISHED: 'Finalizado', RESCHEDULED: 'Reprogramado', SUSPENDED: 'Suspendido', PENDING: 'Pendiente' } as Record<string, string>)[status] ?? status; }
  stageLabel(stage: string) { return ({ GROUP_STAGE: 'Zonas', ROUND_OF_16: 'Octavos', QUARTERFINAL: 'Cuartos', SEMIFINAL: 'Semifinales', FINAL: 'Final' } as Record<string, string>)[stage] ?? stage; }
  signed(value: number) { return value > 0 ? `+${value}` : String(value); }

  private runSave<T>(request: Observable<T>, success: string, next?: (response: T) => void) {
    if (this.saving()) return;
    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({ next: (response: T) => { this.showNotice(success); next?.(response); }, error: (error: any) => this.showNotice(error.error?.message ?? 'No se pudo completar la operación.', true) });
  }
  private showNotice(message: string, error = false) { this.notice.set(message); this.noticeError.set(error); }
}
