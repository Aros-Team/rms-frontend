import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { isSingleChoice } from '@app/shared/lib/option-selection-type-helper/option-selection-type-helper';

export interface SelectionOption {
  id: number;
  name: string;
  cost?: number;
  extraPrice?: number;
  disabled?: boolean;
}

@Component({
  selector: 'app-option-selection-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RadioButtonModule, CheckboxModule],
  templateUrl: './option-selection-list.html',
  styleUrl: './option-selection-list.css',
})
export class OptionSelectionList {
  @Input({ required: true }) options: SelectionOption[] = [];
  @Input({ required: true }) selectionType!: OptionSelectionType;
  @Input() selectedIds: number[] = [];
  @Input() groupName = 'option-group';
  @Output() selectionChange = new EventEmitter<number[]>();

  get isRadio(): boolean {
    return isSingleChoice(this.selectionType);
  }

  onRadioChange(optionId: number): void {
    this.selectionChange.emit([optionId]);
  }

  onCheckboxChange(optionId: number, checked: boolean): void {
    const current = [...this.selectedIds];
    if (checked) {
      current.push(optionId);
    } else {
      const idx = current.indexOf(optionId);
      if (idx !== -1) current.splice(idx, 1);
    }
    this.selectionChange.emit(current);
  }

  isSelected(optionId: number): boolean {
    return this.selectedIds.includes(optionId);
  }
}
