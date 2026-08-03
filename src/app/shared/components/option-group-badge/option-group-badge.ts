import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { getSelectionTypeConfig } from '@app/shared/lib/option-selection-type-helper/option-selection-type-helper';

@Component({
  selector: 'app-option-group-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TagModule],
  templateUrl: './option-group-badge.html',
})
export class OptionGroupBadgeComponent {
  @Input({ required: true }) selectionType!: OptionSelectionType;
  @Input() size: 'sm' | 'md' = 'md';

  get config() {
    return getSelectionTypeConfig(this.selectionType);
  }
}
