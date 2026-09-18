import { CommonModule, DatePipe } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { RealtimeEvent, RealtimeService } from '../../core/realtime';
import { AsyncStatus } from '../../shared/async-state';
import { debounceTime, finalize, merge } from 'rxjs';

type StoryTemplate = 'premium' | 'sport' | 'minimal';
type StoryFont = 'brand' | 'condensed' | 'clean';
type StoryAsset = { id: string; name: string; type: 'background' | 'logo'; dataUrl: string; createdAt: string };
type AvailabilitySlot = { startTime: string; endTime: string; available: boolean; reason?: string };

const STORY_W = 1080;
const STORY_H = 1920;
const ASSET_KEY = 'padel_story_assets_v1';
const BOOKING_SITE = 'lodelprofe.com';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <section class="admin-shell stories-shell">
      <div class="admin-content stories-content">
        <header class="stories-header">
          <div>
            <span class="eyebrow">CONTENIDO SOCIAL</span>
            <h1>Generador de historias</h1>
            <p>Disponibilidad real, identidad de Lo del Profe y reservas directas desde la web.</p>
          </div>
          <div class="stories-header-actions">
            <span class="booking-destination"><small>RESERVAS EN</small><b>{{ bookingSite }}</b></span>
            <button type="button" class="btn primary" [disabled]="downloading()" (click)="downloadStory()">{{ downloading() ? 'Preparando...' : 'Descargar PNG' }}</button>
          </div>
        </header>

        @if (notice) { <p class="notice" [class.error-notice]="noticeError">{{ notice }}</p> }

        <section class="story-workbench">
          <form class="story-controls panel" (ngSubmit)="$event.preventDefault()">
            <div class="control-section">
              <span class="control-kicker">01 · DISPONIBILIDAD</span>
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
              <span class="control-kicker">02 · DIRECCION VISUAL</span>
              <div class="template-picker" role="radiogroup" aria-label="Plantillas de historia">
                @for (option of templates; track option.id) {
                  <button type="button" role="radio" [attr.aria-checked]="template === option.id" [class.active]="template === option.id" (click)="setTemplate(option.id)">
                    <b>{{ option.name }}</b>
                    <span>{{ option.description }}</span>
                  </button>
                }
              </div>
            </div>

            <div class="control-section">
              <span class="control-kicker">03 · MENSAJE</span>
              <label>Tipografía principal
                <select name="storyFont" [(ngModel)]="storyFont" (change)="drawSoon()">
                  @for (option of fontOptions; track option.id) {
                    <option [ngValue]="option.id">{{ option.name }}</option>
                  }
                </select>
              </label>
              <label>Titulo principal
                <input name="headline" maxlength="42" [(ngModel)]="headline" (ngModelChange)="drawSoon()">
              </label>
              <label>Subtitulo
                <input name="subhead" maxlength="46" [(ngModel)]="subhead" (ngModelChange)="drawSoon()">
              </label>
              <label>Accion principal
                <input name="cta" maxlength="36" [(ngModel)]="cta" (ngModelChange)="drawSoon()">
              </label>
              <label>Sitio de reservas
                <input name="website" maxlength="44" [(ngModel)]="website" (ngModelChange)="drawSoon()">
              </label>
            </div>

            <div class="control-section">
              <span class="control-kicker">04 · PALETA</span>
              <div class="color-grid">
                <label>Overlay<input type="color" name="overlay" [(ngModel)]="overlayColor" (input)="drawSoon()"></label>
                <label>Acento<input type="color" name="accent" [(ngModel)]="accentColor" (input)="drawSoon()"></label>
                <label>Texto<input type="color" name="text" [(ngModel)]="textColor" (input)="drawSoon()"></label>
              </div>
            </div>

            <div class="control-section">
              <span class="control-kicker">05 · RECURSOS</span>
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
                  <img [src]="defaultBackground" alt=""><span>Paleta y cancha</span>
                </button>
                <button type="button" [class.active]="backgroundUrl === courtBackground" (click)="selectBackground(courtBackground)">
                  <img [src]="courtBackground" alt=""><span>Cancha y pelotas</span>
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
                <span class="eyebrow">VISTA PREVIA · 1080 × 1920</span>
                <h2>
                  @if (loadingSlots) { Actualizando horarios }
                  @else if (availabilityStatus() === 'error') { Disponibilidad no cargada }
                  @else if (availableSlots.length) { {{ availableSlots.length }} turnos disponibles }
                  @else { Día completo }
                </h2>
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
              } @else if (availabilityStatus() === 'success') {
                <span>Sin horarios libres para mostrar.</span>
              }
            </div>
          </section>
        </section>
      </div>
    </section>
  `,
})
export class InstagramStoriesPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(Api);
  private realtime = inject(RealtimeService);
  private destroyRef = inject(DestroyRef);
  @ViewChild('storyCanvas') storyCanvas?: ElementRef<HTMLCanvasElement>;

  date = this.dateInput(new Date());
  duration = 90;
  template: StoryTemplate = 'premium';
  storyFont: StoryFont = 'brand';
  headline = 'agendá tu turno';
  subhead = 'horarios disponibles';
  cta = 'reservá online';
  website = BOOKING_SITE;
  readonly bookingSite = BOOKING_SITE;
  overlayColor = '#36542f';
  accentColor = '#fffdf5';
  textColor = '#fffdf5';
  backgroundUrl = 'assets/logos/fotoIngresar.jpg';
  logoUrl = 'assets/logos/lo-del-profe-stacked.png';
  defaultBackground = 'assets/logos/fotoIngresar.jpg';
  courtBackground = 'assets/logos/foto-padel-hero.jpg';
  defaultLogo = 'assets/logos/lo-del-profe-stacked.png';
  slots: AvailabilitySlot[] = [];
  courtId = 0;
  assets: StoryAsset[] = [];
  readonly availabilityStatus = signal<AsyncStatus>('idle');
  readonly downloading = signal(false);
  notice = '';
  noticeError = false;
  private drawTimer: ReturnType<typeof setTimeout> | null = null;
  private availabilityRequestId = 0;
  private availabilityAbort: AbortController | null = null;
  get loadingSlots() { return this.availabilityStatus() === 'loading'; }

  readonly templates: Array<{ id: StoryTemplate; name: string; description: string }> = [
    { id: 'premium', name: 'Agenda verde', description: 'Estilo de la referencia 1.' },
    { id: 'sport', name: 'Cancha oscura', description: 'Estilo de la referencia 2.' },
    { id: 'minimal', name: 'Todo listo', description: 'Estilo de la referencia 3.' }
  ];
  readonly fontOptions: Array<{ id: StoryFont; name: string }> = [
    { id: 'brand', name: 'Marca · Null Free' },
    { id: 'condensed', name: 'Deportiva · Oswald' },
    { id: 'clean', name: 'Limpia · Manrope' }
  ];

  ngOnInit() {
    this.loadAssets();
    this.loadCourt();
    merge(this.realtime.listen(['AVAILABILITY_CHANGED', 'CONFIGURATION_CHANGED']).pipe(debounceTime(150)), this.realtime.poll$()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(change => {
      if (typeof change === 'string') { this.loadAvailability(); return; }
      if (typeof change === 'object') {
        const event = change as RealtimeEvent;
        if (event.type === 'AVAILABILITY_CHANGED' && !this.realtime.affectsAvailability(event, this.date, this.courtId)) return;
        if (event.type !== 'CONFIGURATION_CHANGED') return this.loadAvailability();
      }
      this.loadCourt();
    });
  }

  private loadCourt() {
    this.api.get<any[]>('/courts', undefined, { noCache: true }).subscribe({
      next: courts => {
        this.courtId = Number(courts?.[0]?.id ?? 0);
        if (this.courtId) this.loadAvailability();
        else {
          this.notice = 'No hay una cancha activa configurada.';
          this.noticeError = true;
        }
      },
      error: error => {
        this.notice = error.error?.message ?? 'No se pudo cargar la cancha activa.';
        this.noticeError = true;
      }
    });
  }

  ngAfterViewInit() { this.drawSoon(); }
  ngOnDestroy() {
    ++this.availabilityRequestId;
    this.availabilityAbort?.abort();
    this.availabilityAbort = null;
    if (this.drawTimer) clearTimeout(this.drawTimer);
  }

  get availableSlots() { return this.slots.filter(slot => slot.available); }
  get backgroundAssets() { return this.assets.filter(asset => asset.type === 'background'); }
  get logoAssets() { return this.assets.filter(asset => asset.type === 'logo'); }

  setTemplate(template: StoryTemplate) {
    this.template = template;
    if (template === 'premium') {
      this.overlayColor = '#36542f'; this.accentColor = '#fffdf5'; this.textColor = '#fffdf5'; this.headline = 'agendá tu turno'; this.subhead = 'horarios disponibles';
    }
    if (template === 'sport') {
      this.overlayColor = '#102817'; this.accentColor = '#fffdf5'; this.textColor = '#fffdf5'; this.headline = 'agendá tu turno'; this.subhead = 'elegí tu horario';
    }
    if (template === 'minimal') {
      this.overlayColor = '#365b39'; this.accentColor = '#fffdf5'; this.textColor = '#fffdf5'; this.headline = 'todo listo para empezar'; this.subhead = 'reservá tu cancha';
    }
    this.drawSoon();
  }

  private availabilityRequestKey = '';
  loadAvailability() {
    const key = JSON.stringify([this.date, this.duration, this.courtId]);
    if (this.availabilityAbort && key === this.availabilityRequestKey) return;
    this.availabilityRequestKey = key;
    if (!this.courtId) return;
    const requestId = ++this.availabilityRequestId;
    this.availabilityAbort?.abort();
    const abortController = new AbortController();
    this.availabilityAbort = abortController;
    this.availabilityStatus.set('loading');
    this.notice = '';
    this.api.get<unknown>('/availability', { date: this.date, duration: this.duration, courtId: this.courtId }, { noCache: true, abortSignal: abortController.signal }).pipe(
      finalize(() => {
        if (requestId === this.availabilityRequestId && this.availabilityStatus() === 'loading') {
          this.availabilityStatus.set('error');
        }
        if (requestId === this.availabilityRequestId) this.availabilityAbort = null;
      })
    ).subscribe({
      next: data => {
        if (requestId !== this.availabilityRequestId) return;
        const value = data as any;
        const slots = Array.isArray(data) ? data : value?.slots ?? value?.data?.slots ?? [];
        this.slots = Array.isArray(slots) ? slots : [];
        this.availabilityStatus.set('success');
        this.drawSoon();
      },
      error: error => {
        if (requestId !== this.availabilityRequestId || abortController.signal.aborted || error?.name === 'AbortError') return;
        this.availabilityStatus.set('error');
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
    this.downloading.set(true);
    this.drawStory().then(() => {
      const link = document.createElement('a');
      link.download = `historia-lo-del-profe-${this.date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.downloading.set(false);
    }).catch(() => {
      this.downloading.set(false);
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
    if (logo) this.paintLogo(ctx, logo);
    this.paintCopy(ctx);
    this.paintDate(ctx);
    this.paintSlots(ctx);
    this.paintFooter(ctx);
  }

  private paintBackground(ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
    ctx.clearRect(0, 0, STORY_W, STORY_H);
    this.coverImage(ctx, image, 0, 0, STORY_W, STORY_H);
    const overlayAlpha = this.template === 'sport' ? .58 : this.template === 'minimal' ? .36 : .5;
    ctx.fillStyle = this.hexToRgba(this.overlayColor, overlayAlpha);
    ctx.fillRect(0, 0, STORY_W, STORY_H);
    const gradient = ctx.createLinearGradient(0, 0, 0, STORY_H);
    gradient.addColorStop(0, 'rgba(5,20,10,.04)');
    gradient.addColorStop(.65, 'rgba(5,20,10,.02)');
    gradient.addColorStop(1, 'rgba(5,20,10,.28)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  }

  private paintLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement) {
    const width = 190;
    const height = width * (logo.height / logo.width);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.22)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(logo, (STORY_W - width) / 2, 116, width, height);
    ctx.restore();
  }

  private paintCopy(ctx: CanvasRenderingContext2D) {
    const top = this.template === 'minimal' ? 410 : this.template === 'sport' ? 500 : 480;
    const headlineHeight = this.drawDisplayText(ctx, this.headline.toLowerCase(), STORY_W / 2, top, 790, 132, 112, this.displayFontFamily(), this.textColor);
    const subheadY = top + headlineHeight + 34;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `700 28px "Manrope Local", sans-serif`;
    ctx.fillStyle = this.hexToRgba(this.accentColor, .9);
    ctx.fillText(this.subhead.toLowerCase(), STORY_W / 2, subheadY);
    ctx.restore();
  }

  private paintSlots(ctx: CanvasRenderingContext2D) {
    const slots = this.availableSlots.slice(0, 6);
    const startY = 1030;

    if (!slots.length) {
      this.drawDisplayText(ctx, 'agenda completa', STORY_W / 2, startY + 58, 760, 82, 76, this.displayFontFamily(), this.textColor);
      return;
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    slots.forEach((slot, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 330 : 750;
      const y = startY + row * 142;
      ctx.font = `700 68px "${this.displayFontFamily()}", "Oswald Local", sans-serif`;
      ctx.fillStyle = this.textColor;
      ctx.fillText(slot.startTime, x, y);
      ctx.font = `600 20px "Manrope Local", sans-serif`;
      ctx.fillStyle = this.hexToRgba(this.textColor, .78);
      ctx.fillText(`hasta ${slot.endTime}`, x, y + 77);
    });
    ctx.restore();

    if (this.availableSlots.length > slots.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `700 21px "Manrope Local", sans-serif`;
      ctx.fillStyle = this.hexToRgba(this.textColor, .82);
      ctx.fillText(`+ ${this.availableSlots.length - slots.length} horarios en la web`, STORY_W / 2, 1460);
      ctx.restore();
    }
  }

  private paintDate(ctx: CanvasRenderingContext2D) {
    const date = new Date(`${this.date}T12:00:00`);
    const label = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).toLowerCase();
    const y = 920;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `700 26px "Manrope Local", sans-serif`;
    ctx.fillStyle = this.hexToRgba(this.textColor, .9);
    ctx.fillText(`${label} · ${this.duration} min`, STORY_W / 2, y);
    ctx.restore();
  }

  private paintFooter(ctx: CanvasRenderingContext2D) {
    const website = (this.website || BOOKING_SITE).replace(/^https?:\/\//, '').replace(/\/$/, '').toUpperCase();
    const y = 1635;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `700 25px "Manrope Local", sans-serif`;
    ctx.fillStyle = this.hexToRgba(this.textColor, .86);
    ctx.fillText(this.cta.toLowerCase(), STORY_W / 2, y);
    let websiteSize = 82;
    ctx.font = `400 ${websiteSize}px "Realistic Nature", cursive`;
    while (ctx.measureText(website.toLowerCase()).width > 800 && websiteSize > 34) {
      websiteSize -= 2;
      ctx.font = `400 ${websiteSize}px "Realistic Nature", cursive`;
    }
    ctx.fillStyle = '#fffdf5';
    ctx.fillText(website.toLowerCase(), STORY_W / 2, y + 54);
    ctx.restore();
  }

  private drawDisplayText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, lineHeight: number, font: string, color: string) {
    const words = text.split(' ');
    let fontSize = size;
    let effectiveLineHeight = lineHeight;
    let lines: string[] = [];
    do {
      lines = [];
      let current = '';
      ctx.font = `700 ${fontSize}px "${font}", "Oswald Local", sans-serif`;
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
          lines.push(current);
          current = word;
        } else current = test;
      }
      if (current) lines.push(current);
      if (lines.some(line => ctx.measureText(line).width > maxWidth) || lines.length > 3) {
        fontSize -= 4;
        effectiveLineHeight = Math.round(fontSize * .86);
      } else break;
    } while (fontSize > 72);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,.22)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 4;
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * effectiveLineHeight));
    ctx.restore();
    return Math.max(effectiveLineHeight, lines.length * effectiveLineHeight);
  }

  private displayFontFamily() {
    if (this.storyFont === 'condensed') return 'Oswald Local';
    if (this.storyFont === 'clean') return 'Manrope Local';
    return 'Null Free';
  }

  private coverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
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
