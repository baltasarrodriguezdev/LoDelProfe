import { CommonModule, DatePipe } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { AsyncStatus } from '../../shared/async-state';
import { finalize } from 'rxjs';
import { VENUE } from '../../shared/venue';

type StoryTemplate = 'premium' | 'sport' | 'minimal';
type StoryAsset = { id: string; name: string; type: 'background' | 'logo'; dataUrl: string; createdAt: string };
type AvailabilitySlot = { startTime: string; endTime: string; available: boolean; reason?: string };

const STORY_W = 1080;
const STORY_H = 1920;
const ASSET_KEY = 'padel_story_assets_v1';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  template: `
    <section class="admin-shell stories-shell">
      <aside class="admin-nav">
        <span class="eyebrow">PANEL DEL CLUB</span>
        <h2>Administracion</h2>
        <small class="admin-nav-label">USO DIARIO</small>
        <a routerLink="/admin">Hoy</a>
        <a routerLink="/admin/agenda-diaria">Agenda diaria</a>
        <a routerLink="/admin/agenda-semanal">Agenda semanal</a>
        <a routerLink="/admin/turno">Agregar turno</a>
        <small class="admin-nav-label advanced">MARKETING</small>
        <a routerLink="/admin/marketing/historias-instagram" class="active">Historias Instagram</a>
        <small class="admin-nav-label advanced">CONFIGURACION</small>
        <a routerLink="/admin/clientes">Clientes</a>
        <a routerLink="/admin/estadisticas">Estadisticas</a>
      </aside>

      <div class="admin-content stories-content">
        <header class="stories-header">
          <div>
            <span class="eyebrow">MARKETING</span>
            <h1>Historias Instagram</h1>
            <p>Genera piezas verticales con la estetica oficial de Lo del Profe y los turnos disponibles del dia.</p>
          </div>
          <button type="button" class="btn primary" [disabled]="downloading" (click)="downloadStory()">{{ downloading ? 'Preparando...' : 'Descargar historia PNG' }}</button>
        </header>

        @if (notice) { <p class="notice" [class.error-notice]="noticeError">{{ notice }}</p> }

        <section class="story-workbench">
          <form class="story-controls panel" (ngSubmit)="$event.preventDefault()">
            <div class="control-section">
              <span class="control-kicker">01 CONTENIDO</span>
              <div class="control-grid">
                <label>Fecha
                  <input type="date" name="date" [(ngModel)]="date" (change)="loadAvailability()">
                </label>
                <label>Duracion
                  <select name="duration" [(ngModel)]="duration" (change)="loadAvailability()">
                    <option [ngValue]="60">60 min</option>
                    <option [ngValue]="90">90 min</option>
                    <option [ngValue]="120">120 min</option>
                  </select>
                </label>
              </div>
              <button type="button" class="btn ghost full" [disabled]="loadingSlots" (click)="loadAvailability()">{{ loadingSlots ? 'Buscando turnos...' : 'Actualizar disponibilidad' }}</button>
            </div>

            <div class="control-section">
              <span class="control-kicker">02 PLANTILLA</span>
              <div class="template-picker" role="radiogroup" aria-label="Plantillas de historia">
                @for (option of templates; track option.id) {
                  <button type="button" [class.active]="template === option.id" (click)="setTemplate(option.id)">
                    <b>{{ option.name }}</b>
                    <span>{{ option.description }}</span>
                  </button>
                }
              </div>
            </div>

            <div class="control-section">
              <span class="control-kicker">03 TEXTO</span>
              <label>Titulo principal
                <input name="headline" maxlength="42" [(ngModel)]="headline" (ngModelChange)="drawSoon()">
              </label>
              <label>Subtitulo
                <input name="subhead" maxlength="46" [(ngModel)]="subhead" (ngModelChange)="drawSoon()">
              </label>
              <label>Llamada a reservar
                <input name="cta" maxlength="36" [(ngModel)]="cta" (ngModelChange)="drawSoon()">
              </label>
              <label>Contacto
                <input name="contact" maxlength="44" [(ngModel)]="contact" (ngModelChange)="drawSoon()">
              </label>
            </div>

            <div class="control-section">
              <span class="control-kicker">04 COLOR</span>
              <div class="color-grid">
                <label>Overlay<input type="color" name="overlay" [(ngModel)]="overlayColor" (input)="drawSoon()"></label>
                <label>Acento<input type="color" name="accent" [(ngModel)]="accentColor" (input)="drawSoon()"></label>
                <label>Texto<input type="color" name="text" [(ngModel)]="textColor" (input)="drawSoon()"></label>
              </div>
            </div>

            <div class="control-section">
              <span class="control-kicker">05 IMAGENES</span>
              <label>Foto de fondo
                <input type="file" accept="image/png,image/jpeg,image/webp" (change)="uploadAsset($event, 'background')">
                <small>Recomendado: vertical 1080x1920, JPG/PNG/WebP, maximo 5 MB.</small>
              </label>
              <label>Logo
                <input type="file" accept="image/png,image/jpeg,image/webp" (change)="uploadAsset($event, 'logo')">
                <small>Recomendado: PNG transparente, alto contraste.</small>
              </label>

              <div class="asset-gallery">
                <button type="button" [class.active]="backgroundUrl === defaultBackground" (click)="selectBackground(defaultBackground)">
                  <img [src]="defaultBackground" alt=""><span>Cancha oficial</span>
                </button>
                @for (asset of backgroundAssets; track asset.id) {
                  <button type="button" [class.active]="backgroundUrl === asset.dataUrl" (click)="selectBackground(asset.dataUrl)">
                    <img [src]="asset.dataUrl" alt=""><span>{{ asset.name }}</span>
                  </button>
                }
              </div>
              <div class="asset-gallery logo-gallery">
                <button type="button" [class.active]="logoUrl === defaultLogo" (click)="selectLogo(defaultLogo)">
                  <img [src]="defaultLogo" alt=""><span>Logo oficial</span>
                </button>
                @for (asset of logoAssets; track asset.id) {
                  <button type="button" [class.active]="logoUrl === asset.dataUrl" (click)="selectLogo(asset.dataUrl)">
                    <img [src]="asset.dataUrl" alt=""><span>{{ asset.name }}</span>
                  </button>
                }
              </div>
            </div>
          </form>

          <section class="story-preview-panel">
            <div class="preview-toolbar">
              <div>
                <span class="eyebrow">PREVIEW 1080x1920</span>
                <h2>{{ availableSlots.length ? availableSlots.length + ' turnos disponibles' : 'Dia completo' }}</h2>
              </div>
              <span>{{ date | date:'EEEE d MMMM':'':'es-AR' }}</span>
            </div>
            <div class="phone-frame">
              <canvas #storyCanvas width="1080" height="1920" aria-label="Previsualizacion de historia Instagram"></canvas>
            </div>
            <div class="slot-strip" aria-live="polite">
              @if (loadingSlots) {
                <span>Cargando disponibilidad...</span>
              } @else if (availableSlots.length) {
                @for (slot of availableSlots.slice(0, 8); track slot.startTime) { <b>{{ slot.startTime }}</b> }
              } @else if (availabilityStatus === 'success') {
                <span>Sin horarios libres para mostrar.</span>
              }
            </div>
          </section>
        </section>
      </div>
    </section>
  `,
  styles: [`
    @font-face{font-family:'Story Round';src:url('/assets/fonts/Null_Free.otf') format('opentype');font-weight:700;font-style:normal;font-display:swap}
    .stories-shell{background:linear-gradient(180deg,#e8eee1 0,#f4f2e9 360px)}
    .stories-content{display:grid;gap:20px}
    .stories-header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
    .stories-header h1{margin:8px 0 8px;font-size:clamp(3rem,5.5vw,5.2rem);line-height:.92;color:var(--color-green-dark)}
    .stories-header p{max-width:650px;margin:0;color:#657064}
    .story-workbench{display:grid;grid-template-columns:minmax(290px,390px) minmax(360px,1fr);gap:22px;align-items:start}
    .story-controls{display:grid;gap:20px;padding:20px;position:sticky;top:92px}
    .control-section{display:grid;gap:12px;padding-bottom:18px;border-bottom:1px solid rgba(34,53,38,.12)}
    .control-section:last-child{border-bottom:0;padding-bottom:0}
    .control-kicker{font-family:var(--font-display);font-size:.68rem;font-weight:600;letter-spacing:.18em;color:var(--color-olive-gold)}
    .control-grid,.color-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .story-controls label{display:grid;gap:7px;font-size:.72rem;font-weight:800;text-transform:uppercase;color:#637061}
    .story-controls input,.story-controls select{width:100%}
    .story-controls small{font-size:.68rem;line-height:1.45;text-transform:none;color:#7a847a}
    .template-picker{display:grid;gap:8px}
    .template-picker button{display:grid;gap:3px;text-align:left;padding:13px 14px;border:1px solid rgba(34,53,38,.18);border-radius:8px;background:#fffdf5;color:var(--color-green-dark);cursor:pointer}
    .template-picker button.active{background:var(--color-green-dark);border-color:var(--color-green-dark);color:var(--color-white-soft);box-shadow:inset 0 -4px var(--color-olive-gold)}
    .template-picker b{font-size:1.05rem}.template-picker span{font-size:.72rem;color:inherit;opacity:.72}
    .color-grid input{height:42px;padding:3px}
    .asset-gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .asset-gallery button{display:grid;gap:7px;padding:7px;border:1px solid rgba(34,53,38,.16);border-radius:8px;background:#fffdf5;text-align:left;cursor:pointer}
    .asset-gallery button.active{border-color:var(--color-green-main);box-shadow:0 0 0 2px rgba(83,111,67,.18)}
    .asset-gallery img{width:100%;aspect-ratio:9/12;object-fit:cover;border-radius:5px;background:#d9dfd2}
    .asset-gallery span{font-size:.68rem;color:#657064;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .story-preview-panel{display:grid;gap:14px}
    .preview-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}
    .preview-toolbar h2{margin:4px 0 0;color:var(--color-green-dark)}
    .preview-toolbar>span{font-size:.78rem;font-weight:800;text-transform:uppercase;color:#667064}
    .phone-frame{width:min(100%,430px);margin:auto;padding:14px;border-radius:28px;background:#18281d;box-shadow:0 24px 60px rgba(20,40,27,.22)}
    canvas{display:block;width:100%;height:auto;border-radius:18px;background:#203a29}
    .slot-strip{width:min(100%,520px);margin:auto;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;color:#687363}
    .slot-strip b,.slot-strip span{display:inline-flex;align-items:center;min-height:32px;padding:6px 10px;border-radius:999px;background:#fffdf5;border:1px solid rgba(34,53,38,.12);font-family:var(--font-display);font-size:.82rem;color:var(--color-green-dark)}
    @media(max-width:1050px){.story-workbench{grid-template-columns:1fr}.story-controls{position:static}.phone-frame{width:min(100%,390px)}}
    @media(max-width:620px){.stories-header{display:grid}.story-controls{padding:16px}.control-grid,.color-grid,.asset-gallery{grid-template-columns:1fr}.preview-toolbar{display:grid}.phone-frame{padding:10px;border-radius:22px}}
  `]
})
export class InstagramStoriesPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(Api);
  @ViewChild('storyCanvas') storyCanvas?: ElementRef<HTMLCanvasElement>;

  date = this.dateInput(new Date());
  duration = 90;
  template: StoryTemplate = 'premium';
  headline = 'AGENDA TU TURNO';
  subhead = 'HOY DISPONIBLE';
  cta = 'Reserva ahora';
  contact = `WhatsApp ${VENUE.whatsapp}`;
  overlayColor = '#173022';
  accentColor = '#9a974f';
  textColor = '#fffdf5';
  backgroundUrl = 'assets/logos/foto-padel-hero.jpg';
  logoUrl = 'assets/logos/lo-del-profe-stacked.png';
  defaultBackground = 'assets/logos/foto-padel-hero.jpg';
  defaultLogo = 'assets/logos/lo-del-profe-stacked.png';
  slots: AvailabilitySlot[] = [];
  assets: StoryAsset[] = [];
  availabilityStatus: AsyncStatus = 'idle';
  downloading = false;
  notice = '';
  noticeError = false;
  private drawTimer: ReturnType<typeof setTimeout> | null = null;
  private availabilityRequestId = 0;
  get loadingSlots() { return this.availabilityStatus === 'loading'; }

  readonly templates: Array<{ id: StoryTemplate; name: string; description: string }> = [
    { id: 'premium', name: 'Premium oscuro', description: 'Foto profunda, logo arriba, horarios sobrios.' },
    { id: 'sport', name: 'Energetico deportivo', description: 'Mas contraste, diagonales y acento competitivo.' },
    { id: 'minimal', name: 'Minimalista', description: 'Aire, grilla limpia y foco en disponibilidad.' }
  ];

  ngOnInit() {
    this.loadAssets();
    this.loadAvailability();
  }

  ngAfterViewInit() { this.drawSoon(); }
  ngOnDestroy() { if (this.drawTimer) clearTimeout(this.drawTimer); }

  get availableSlots() { return this.slots.filter(slot => slot.available); }
  get backgroundAssets() { return this.assets.filter(asset => asset.type === 'background'); }
  get logoAssets() { return this.assets.filter(asset => asset.type === 'logo'); }

  setTemplate(template: StoryTemplate) {
    this.template = template;
    if (template === 'premium') {
      this.overlayColor = '#173022'; this.accentColor = '#9a974f'; this.headline = 'AGENDA TU TURNO'; this.subhead = 'HOY DISPONIBLE';
    }
    if (template === 'sport') {
      this.overlayColor = '#102b22'; this.accentColor = '#c8f04b'; this.headline = 'SALE PARTIDO'; this.subhead = 'TURNOS LIBRES';
    }
    if (template === 'minimal') {
      this.overlayColor = '#4f6d3e'; this.accentColor = '#fffdf5'; this.headline = 'TURNOS DE HOY'; this.subhead = 'LO DEL PROFE';
    }
    this.drawSoon();
  }

  loadAvailability() {
    const requestId = ++this.availabilityRequestId;
    this.availabilityStatus = 'loading';
    this.notice = '';
    this.api.get<unknown>('/availability', { date: this.date, duration: this.duration, courtId: 1 }, { noCache: true }).pipe(
      finalize(() => {
        if (requestId === this.availabilityRequestId && this.availabilityStatus === 'loading') {
          this.availabilityStatus = 'error';
        }
      })
    ).subscribe({
      next: data => {
        if (requestId !== this.availabilityRequestId) return;
        const value = data as any;
        const slots = Array.isArray(data) ? data : value?.slots ?? value?.data?.slots ?? [];
        this.slots = Array.isArray(slots) ? slots : [];
        this.availabilityStatus = 'success';
        this.drawSoon();
      },
      error: error => {
        if (requestId !== this.availabilityRequestId) return;
        this.availabilityStatus = 'error';
        this.notice = error.error?.message ?? 'No pudimos cargar la disponibilidad.';
        this.noticeError = true;
        this.drawSoon();
      }
    });
  }

  uploadAsset(event: Event, type: 'background' | 'logo') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return this.showError('Formato no permitido. Usa PNG, JPG o WebP.');
    if (file.size > 5 * 1024 * 1024) return this.showError('La imagen supera 5 MB. Comprimila antes de subirla.');
    const reader = new FileReader();
    reader.onload = () => {
      const asset: StoryAsset = { id: crypto.randomUUID(), name: file.name, type, dataUrl: String(reader.result), createdAt: new Date().toISOString() };
      this.assets = [asset, ...this.assets].slice(0, 16);
      localStorage.setItem(ASSET_KEY, JSON.stringify(this.assets));
      if (type === 'background') this.backgroundUrl = asset.dataUrl;
      if (type === 'logo') this.logoUrl = asset.dataUrl;
      this.notice = 'Imagen guardada en la galeria local.';
      this.noticeError = false;
      this.drawSoon();
    };
    reader.readAsDataURL(file);
  }

  selectBackground(url: string) {
    this.backgroundUrl = url;
    this.drawSoon();
  }

  selectLogo(url: string) {
    this.logoUrl = url;
    this.drawSoon();
  }

  downloadStory() {
    const canvas = this.storyCanvas?.nativeElement;
    if (!canvas) return;
    this.downloading = true;
    this.drawStory().then(() => {
      const link = document.createElement('a');
      link.download = `historia-lo-del-profe-${this.date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.downloading = false;
    }).catch(() => {
      this.downloading = false;
      this.showError('No pudimos generar el PNG.');
    });
  }

  drawSoon() {
    if (this.drawTimer) clearTimeout(this.drawTimer);
    this.drawTimer = setTimeout(() => this.drawStory(), 60);
  }

  private async drawStory() {
    const canvas = this.storyCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await document.fonts.ready;
    const [background, logo] = await Promise.all([this.loadImage(this.backgroundUrl), this.loadImage(this.logoUrl).catch(() => null)]);
    this.paintBackground(ctx, background);
    if (this.template === 'sport') this.paintSportAccents(ctx);
    if (logo) this.paintLogo(ctx, logo);
    this.paintCopy(ctx);
    this.paintDate(ctx);
    this.paintSlots(ctx);
    this.paintFooter(ctx);
  }

  private paintBackground(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
    ctx.clearRect(0, 0, STORY_W, STORY_H);
    this.coverImage(ctx, image, 0, 0, STORY_W, STORY_H);
    ctx.fillStyle = this.hexToRgba(this.overlayColor, this.template === 'minimal' ? .55 : .68);
    ctx.fillRect(0, 0, STORY_W, STORY_H);
    const gradient = ctx.createLinearGradient(0, 0, 0, STORY_H);
    gradient.addColorStop(0, 'rgba(0,0,0,.18)');
    gradient.addColorStop(.42, 'rgba(0,0,0,.04)');
    gradient.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  }

  private paintLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement) {
    const width = this.template === 'minimal' ? 210 : 230;
    const height = width * (logo.height / logo.width);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.26)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(logo, (STORY_W - width) / 2, 132, width, height);
    ctx.restore();
  }

  private paintCopy(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.textColor;
    const y = this.template === 'minimal' ? 580 : this.template === 'sport' ? 620 : 650;
    this.drawRoundText(ctx, this.headline.toLowerCase(), STORY_W / 2, y, this.template === 'minimal' ? 112 : 124, 104);
    ctx.font = `700 36px "Oswald Local", sans-serif`;
    ctx.letterSpacing = '6px';
    ctx.fillStyle = this.template === 'sport' ? this.accentColor : this.textColor;
    ctx.fillText(this.subhead.toUpperCase(), STORY_W / 2, y + 190);
    ctx.letterSpacing = '0px';
  }

  private paintSlots(ctx: CanvasRenderingContext2D) {
    const slots = this.availableSlots.slice(0, 7);
    const startY = this.template === 'minimal' ? 990 : 1060;
    if (!slots.length) {
      this.drawRoundText(ctx, 'hoy estamos completos', STORY_W / 2, startY + 110, 78, 76);
      ctx.font = `700 34px "Oswald Local", sans-serif`;
      ctx.fillStyle = this.accentColor;
      ctx.fillText('GRACIAS POR ELEGIRNOS', STORY_W / 2, startY + 280);
      return;
    }
    ctx.save();
    ctx.textAlign = 'center';
    slots.forEach((slot, index) => {
      const y = startY + index * 92;
      const label = `${slot.startTime} - ${slot.endTime}`;
      if (this.template === 'premium') {
        this.roundRect(ctx, 220, y - 38, 640, 70, 22, 'rgba(255,253,245,.1)', 'rgba(255,253,245,.22)');
      }
      if (this.template === 'sport') {
        ctx.fillStyle = index % 2 ? 'rgba(255,253,245,.08)' : this.hexToRgba(this.accentColor, .88);
        this.roundRect(ctx, 185 + (index % 2) * 40, y - 40, 710, 74, 0, ctx.fillStyle, '');
      }
      ctx.font = `700 ${this.template === 'minimal' ? 58 : 62}px "Oswald Local", sans-serif`;
      ctx.fillStyle = this.template === 'sport' && index % 2 === 0 ? '#173022' : this.textColor;
      ctx.fillText(label, STORY_W / 2, y);
    });
    ctx.restore();
  }

  private paintDate(ctx: CanvasRenderingContext2D) {
    const date = new Date(`${this.date}T12:00:00`);
    const label = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
    const y = this.template === 'minimal' ? 905 : 965;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `700 30px "Manrope Local", sans-serif`;
    ctx.letterSpacing = '4px';
    ctx.fillStyle = this.hexToRgba(this.textColor, .82);
    ctx.fillText(label, STORY_W / 2, y);
    ctx.letterSpacing = '0px';
    ctx.restore();
  }

  private paintFooter(ctx: CanvasRenderingContext2D) {
    ctx.textAlign = 'center';
    ctx.font = `700 42px "Oswald Local", sans-serif`;
    ctx.fillStyle = this.textColor;
    ctx.fillText(this.cta.toUpperCase(), STORY_W / 2, 1700);
    ctx.font = `700 28px "Manrope Local", sans-serif`;
    ctx.fillStyle = this.hexToRgba(this.textColor, .82);
    ctx.fillText(this.contact, STORY_W / 2, 1755);
    ctx.fillStyle = this.accentColor;
    ctx.fillRect(390, 1810, 300, 8);
  }

  private paintSportAccents(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = this.hexToRgba(this.accentColor, .9);
    ctx.translate(0, 0);
    ctx.rotate(-0.16);
    ctx.fillRect(-80, 840, 1240, 28);
    ctx.fillRect(700, 240, 420, 12);
    ctx.restore();
  }

  private drawRoundText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, lineHeight: number) {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    ctx.font = `700 ${size}px "Story Round", "Oswald Local", sans-serif`;
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > 760 && current) {
        lines.push(current);
        current = word;
      } else current = test;
    }
    if (current) lines.push(current);
    const firstY = y - ((lines.length - 1) * lineHeight) / 2;
    ctx.save();
    ctx.fillStyle = this.textColor;
    ctx.shadowColor = 'rgba(0,0,0,.22)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 8;
    lines.forEach((line, index) => ctx.fillText(line, x, firstY + index * lineHeight));
    ctx.restore();
  }

  private coverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke: string) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  private loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  private loadAssets() {
    try {
      this.assets = JSON.parse(localStorage.getItem(ASSET_KEY) || '[]');
    } catch {
      this.assets = [];
    }
  }

  private showError(message: string) {
    this.notice = message;
    this.noticeError = true;
  }

  private hexToRgba(hex: string, alpha: number) {
    const value = hex.replace('#', '');
    const bigint = parseInt(value.length === 3 ? value.split('').map(char => char + char).join('') : value, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private dateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
