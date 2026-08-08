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
        <span class="confirm-dialog-icon" aria-hidden="true">!</span>
        <h2 [id]="titleId">{{ title }}</h2>
        <p class="confirm-dialog-message">{{ message }}</p>
        @if (secondaryMessage) { <p class="confirm-dialog-secondary">{{ secondaryMessage }}</p> }
        @if (error) { <p class="confirm-dialog-error">{{ error }}</p> }
        <div class="confirm-dialog-actions">
          <button #cancelButton type="button" class="confirm-dialog-button confirm-dialog-button--secondary" [disabled]="loading" (click)="requestCancel()">{{ cancelText }}</button>
          <button type="button" class="confirm-dialog-button confirm-dialog-button--danger" [disabled]="loading" (click)="confirm.emit()">{{ loading ? loadingText : confirmText }}</button>
        </div>
      </section>
    </div>
  `
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
