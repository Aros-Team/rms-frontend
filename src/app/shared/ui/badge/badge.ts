import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type { RmsStatus } from '../types/ui-types';

export type RmsBadgeTone = RmsStatus | 'brand';

/**
 * `app-rms-badge` — non-interactive label.
 *
 * `soft` for status/category labels (default), `solid` for a count or a strong
 * marker, `outline` for quiet metadata. Text always uses the `*-fg` token; the
 * fill is never the only encoding.
 */
@Component({
  selector: 'app-rms-badge',
  templateUrl: './badge.html',
  styleUrl: './badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsBadge {
  @Input({ required: true }) label!: string;
  @Input() tone: RmsBadgeTone = 'neutral';
  @Input() variant: 'soft' | 'solid' | 'outline' = 'soft';
  @Input() size: 'sm' | 'md' = 'sm';
  @Input() dot = false;

  get classes(): string {
    return `rms-badge rms-badge--${this.tone} rms-badge--${this.variant} rms-badge--${this.size}`;
  }
}
