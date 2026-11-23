import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { getSelectionTypeConfig, type TagSeverity } from '@app/shared/lib/option-selection-type-helper/option-selection-type-helper';
import { RmsBadge, type RmsBadgeTone } from '@app/shared/ui/badge/badge';

const TONE_BY_SEVERITY: Record<TagSeverity, RmsBadgeTone> = {
  success: 'success',
  info: 'info',
  warn: 'warning',
  danger: 'danger',
  secondary: 'neutral',
  contrast: 'neutral',
};

@Component({
  selector: 'app-option-group-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RmsBadge],
  templateUrl: './option-group-badge.html',
})
export class OptionGroupBadgeComponent {
  @Input({ required: true }) selectionType!: OptionSelectionType;
  @Input() size: 'sm' | 'md' = 'md';

  get config() {
    return getSelectionTypeConfig(this.selectionType);
  }

  get tone(): RmsBadgeTone {
    return TONE_BY_SEVERITY[this.config.severity];
  }
}
