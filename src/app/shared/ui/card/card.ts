import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import type { RmsPadding, RmsSurfaceTone } from '../types/ui-types';

/**
 * `app-rms-card` — surface container.
 *
 * A card is a surface step plus a 1px border plus a 12/16px radius. Never a
 * box-shadow. Optional header (H3 + subtitle + actions) and footer slot.
 */
@Component({
  selector: 'app-rms-card',
  templateUrl: './card.html',
  styleUrl: './card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsCard {
  @Input() tone: RmsSurfaceTone = 'surface';
  @Input() padding: RmsPadding = 'md';
  @Input() title = '';
  @Input() subtitle = '';

  get classes(): string {
    return `rms-card rms-card--${this.tone} rms-card--pad-${this.padding}`;
  }

  get hasHeader(): boolean {
    return this.title.length > 0 || this.subtitle.length > 0;
  }
}
