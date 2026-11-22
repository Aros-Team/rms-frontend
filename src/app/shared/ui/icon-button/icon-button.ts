import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';

import type { RmsSize } from '../types/ui-types';

/**
 * `app-rms-icon-button` — an icon-only action with a mandatory accessible name.
 *
 * `ariaLabel` is a required input on purpose: the tooltip is a supplement, not
 * the name (F-008: 91 unnamed icon buttons). The hit area is at least 44px on
 * lg/md, 32px on sm for compact desktop tables.
 */
@Component({
  selector: 'app-rms-icon-button',
  templateUrl: './icon-button.html',
  styleUrl: './icon-button.css',
  imports: [TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsIconButton {
  /** PrimeIcons class, e.g. `pi pi-pencil`. */
  @Input({ required: true }) icon!: string;
  /** Visible-to-AT name. Required: an icon alone is never a label. */
  @Input({ required: true }) ariaLabel!: string;
  /** Optional tooltip text; appears on hover/focus only. */
  @Input() tooltip = '';
  @Input() variant: 'ghost' | 'secondary' | 'danger' = 'ghost';
  @Input() size: RmsSize = 'md';
  @Input() disabled = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';

  get classes(): string {
    return `rms-icon-btn rms-icon-btn--${this.variant} rms-icon-btn--${this.size}`;
  }
}
