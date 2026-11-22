import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { RmsButton } from '../button/button';

/**
 * `app-rms-empty-state` — empty list/section state.
 *
 * Title, one sentence of reason and one action. The secondary action is for a
 * realistic "look somewhere else" path ("Ver pedidos de ayer") instead of a
 * dead end (F-020, pattern rule 7).
 */
@Component({
  selector: 'app-rms-empty-state',
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
  imports: [RmsButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsEmptyState {
  @Input() icon = 'pi pi-inbox';
  @Input({ required: true }) title!: string;
  @Input() message = '';
  @Input() actionLabel = '';
  @Input() actionIcon = '';
  @Input() secondaryLabel = '';

  @Output() action = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<void>();
}
