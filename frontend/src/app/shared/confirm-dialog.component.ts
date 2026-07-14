import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirm-dialog-backdrop" (click)="onBackdropClick()">
      <section
        class="confirm-dialog"
        [class.confirm-dialog--danger]="variant === 'danger'"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (click)="$event.stopPropagation()"
      >
        <span class="confirm-dialog__icon" aria-hidden="true">!</span>
        <h2 [id]="titleId">{{ title }}</h2>
        <p class="confirm-dialog__message">{{ message }}</p>
        @if (secondaryMessage) { <p class="confirm-dialog__secondary">{{ secondaryMessage }}</p> }
        @if (error) { <p class="confirm-dialog__error">{{ error }}</p> }
        <div class="confirm-dialog__actions">
          <button #cancelButton type="button" class="confirm-dialog__button confirm-dialog__button--secondary" [disabled]="loading" (click)="requestCancel()">{{ cancelText }}</button>
          <button type="button" class="confirm-dialog__button confirm-dialog__button--danger" [disabled]="loading" (click)="confirm.emit()">{{ loading ? loadingText : confirmText }}</button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host{position:fixed;inset:0;z-index:1000;display:block}
    .confirm-dialog-backdrop{position:fixed;inset:0;display:grid;place-items:center;padding:16px;background:rgba(6,23,18,.78);backdrop-filter:blur(6px);animation:confirmFade .16s ease-out}
    .confirm-dialog{width:min(480px,calc(100vw - 32px));padding:28px;border:1px solid rgba(34,53,38,.13);border-radius:20px;background:var(--color-white-soft,var(--white,#fffef9));box-shadow:0 26px 70px rgba(0,0,0,.32);text-align:left;animation:confirmIn .18s ease-out;overflow:visible}
    .confirm-dialog__icon{width:58px;height:58px;display:grid;place-items:center;margin-bottom:16px;border-radius:50%;background:#f3d8d2;color:#9f3f36;font-family:var(--font-display,'Barlow Condensed',sans-serif);font-size:2rem;font-weight:700;box-shadow:6px 6px 0 rgba(159,63,54,.18)}
    .confirm-dialog h2{margin:0 0 9px;color:var(--color-green-dark,var(--ink,#102b22));font-family:var(--font-display,'Barlow Condensed',sans-serif);font-size:2.35rem;font-weight:600;line-height:1.02;letter-spacing:0}
    .confirm-dialog__message{margin:0;color:var(--color-green-dark,var(--ink,#102b22));font-size:.98rem;line-height:1.55}
    .confirm-dialog__secondary{margin:9px 0 0;color:#69766c;font-size:.86rem;line-height:1.5}
    .confirm-dialog__error{margin:16px 0 0;padding:11px 12px;border-left:4px solid #a2473e;background:#fff0ed;color:#a2473e;font-size:.84rem;line-height:1.4}
    .confirm-dialog__actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}
    .confirm-dialog__button{min-height:48px;border-radius:9px;padding:12px 16px;font-family:var(--font-display,'Barlow Condensed',sans-serif);font-size:.9rem;font-weight:600;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,background .16s ease,border-color .16s ease}
    .confirm-dialog__button:disabled{opacity:.65;cursor:not-allowed;transform:none;box-shadow:none}
    .confirm-dialog__button--secondary{border:1px solid var(--color-green-dark,var(--ink,#102b22));background:transparent;color:var(--color-green-dark,var(--ink,#102b22))}
    .confirm-dialog__button--danger{border:1px solid #963b33;background:#963b33;color:#fff}
    .confirm-dialog__button:not(:disabled):hover{transform:translateY(-1px);box-shadow:4px 4px 0 rgba(150,59,51,.16)}
    @keyframes confirmFade{from{opacity:0}to{opacity:1}}
    @keyframes confirmIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
    @media(max-width:520px){.confirm-dialog-backdrop{align-items:center;padding:16px}.confirm-dialog{padding:26px 20px;border-radius:18px}.confirm-dialog h2{font-size:2rem}.confirm-dialog__actions{grid-template-columns:1fr}.confirm-dialog__button--danger{order:2}.confirm-dialog__button--secondary{order:1}}
    @media(prefers-reduced-motion:reduce){.confirm-dialog-backdrop,.confirm-dialog,.confirm-dialog__button{animation:none;transition:none}}
  `]
})
export class ConfirmDialogComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) title = '';
  @Input({ required: true }) message = '';
  @Input() secondaryMessage = '';
  @Input() confirmText = 'Confirmar';
  @Input() cancelText = 'Volver';
  @Input() loadingText = 'Procesando...';
  @Input() variant: 'danger' = 'danger';
  @Input() loading = false;
  @Input() error = '';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @ViewChild('cancelButton') private cancelButton?: ElementRef<HTMLButtonElement>;

  readonly titleId = `confirm-title-${Math.random().toString(36).slice(2)}`;
  private readonly previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  private readonly previousOverflow = document.body.style.overflow;

  constructor() { document.body.style.overflow = 'hidden'; }

  ngAfterViewInit() { setTimeout(() => this.cancelButton?.nativeElement.focus(), 0); }

  ngOnDestroy() {
    document.body.style.overflow = this.previousOverflow;
    this.previousActiveElement?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.requestCancel(); }

  onBackdropClick() { this.requestCancel(); }

  requestCancel() {
    if (this.loading) return;
    this.cancel.emit();
  }
}