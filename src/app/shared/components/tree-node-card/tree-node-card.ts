import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RemovableChip, RemovableChipData } from '../removable-chip/removable-chip';

export type TreeNodeType = 'product' | 'group' | 'option';

@Component({
  selector: 'app-tree-node-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RemovableChip],
  templateUrl: './tree-node-card.html',
  styleUrl: './tree-node-card.css',
})
export class TreeNodeCardComponent {
  @Input({ required: true }) nodeType!: TreeNodeType;
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() icon?: string;
  @Input() badges: RemovableChipData[] = [];
  @Input() expandable = false;
  @Input() expanded = false;
  @Input() loading = false;

  @Output() expand = new EventEmitter<void>();
  @Output() badgeRemoved = new EventEmitter<number>();
}
