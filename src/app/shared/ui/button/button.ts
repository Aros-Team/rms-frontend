import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type { RmsButtonVariant, RmsSize } from '../types/ui-types';

/**
 * `app-rms-button` — the single action primitive.
 *
 * Anatomy: optional leading icon, projected label, optional trailing icon or
 * loading spinner. Loading keeps the label and the width, disables the button
 * and exposes `aria-busy`.
 *
 * Rules (docs/DESIGN.md):
 * - One primary per view. Gold is a fill; its label is `--rms-text-on-brand`.
 * - Destructive actions use `danger`, never `primary`.
 * - Sizes: sm 32 (compact admin), md 40, lg 48 (waiter), xl 56 (kitchen).
 * - The label is projected, so a visible text label stays the accessible name.
 *   `ariaLabel` is only needed when the projected content is not text.
 */
@Component({
  selector: 'app-rms-button',
  templateUrl: './button.html',
  styleUrl: './button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsButton {
  @Input() variant: RmsButtonVariant = 'primary';
  @Input() size: RmsSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  /** PrimeIcons class, e.g. `pi pi-plus`. Decorative: always aria-hidden. */
  @Input() iconStart = '';
  @Input() iconEnd = '';
  @Input() ariaLabel = '';
  /** Full width on mobile form actions. */
  @Input() block = false;

  get isDisabled(): boolean {
    return this.disabled || this.loading;
  }

  get classes(): string {
    return (
      `rms-btn rms-btn--${this.variant} rms-btn--${this.size}` +
      (this.block ? ' rms-btn--block' : '')
    );
  }
}
