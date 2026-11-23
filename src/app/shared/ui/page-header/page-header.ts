import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { RmsButton } from '../button/button';

/**
 * `app-rms-page-header` — the H1 for a route.
 *
 * One per page. Owns the title, the one-line subtitle, the meta strip (period,
 * updated at) and the primary action slot. Charts and KPI strips never invent
 * their own header.
 *
 *   <app-rms-page-header title="Pedidos" subtitle="Pedidos del día">
 *     <div rmsPageHeaderActions><app-rms-button>Nuevo</app-rms-button></div>
 *   </app-rms-page-header>
 */
@Component({
  selector: 'app-rms-page-header',
  templateUrl: './page-header.html',
  host: { '[class.rms-page-header-host--compact]': 'compact' },
  styleUrl: './page-header.css',
  imports: [RmsButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsPageHeader {
  @Input({ required: true }) title!: string;
  /** List pages: keep the H1 for assistive tech but hide the large title. */
  @Input() compact = false;
  @Input() subtitle = '';
  /** Detail pages show a back link instead of a second H1. */
  @Input() backLabel = '';
  @Output() back = new EventEmitter<void>();
}
