import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type { RmsStatus } from '../types/ui-types';

/**
 * `app-rms-status-pill` — domain status as text + optional dot.
 *
 * Always renders the label: colour is never the only encoding (F-045). The
 * domain mapping (AVAILABLE → success, PREPARING → info …) lives in the
 * feature lane; this primitive owns the four status roles.
 */
@Component({
  selector: 'app-rms-status-pill',
  templateUrl: './status-pill.html',
  styleUrl: './status-pill.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsStatusPill {
  @Input({ required: true }) label!: string;
  @Input() status: RmsStatus = 'neutral';
  @Input() dot = true;
  @Input() size: 'sm' | 'md' = 'sm';

  get classes(): string {
    return `rms-pill rms-pill--${this.status} rms-pill--${this.size}`;
  }
}
