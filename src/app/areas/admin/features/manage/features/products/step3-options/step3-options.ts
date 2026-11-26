import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { OptionGroupsManager } from '../option-groups-manager/option-groups-manager';

/**
 * Product wizard step 3 — options.
 *
 * Thin wrapper around the shared {@link OptionGroupsManager}. Option groups and
 * options are persisted immediately through the dedicated product-option
 * association endpoints, so the wizard's final product save no longer rewrites
 * the associations.
 */
@Component({
  selector: 'app-step3-options',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OptionGroupsManager],
  template: '<app-option-groups-manager [productId]="productId" (changed)="changed.emit()" />',
})
export class Step3Options {
  @Input({ required: true }) productId = 0;
  @Output() readonly changed = new EventEmitter<void>();
}
