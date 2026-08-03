import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RemovableChipData {
  id: number;
  label: string;
  meta?: string;
  severity?: 'primary' | 'success' | 'warn' | 'danger' | 'secondary';
  icon?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-removable-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './removable-chip.html',
  styleUrl: './removable-chip.css',
})
export class RemovableChip {
  @Input({ required: true }) chip!: RemovableChipData;
  @Output() removed = new EventEmitter<number>();

  onRemove(event: Event): void {
    event.stopPropagation();
    if (!this.chip.disabled) {
      this.removed.emit(this.chip.id);
    }
  }
}
