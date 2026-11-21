import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-tree-node-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SkeletonModule],
  templateUrl: './tree-node-skeleton.html',
})
export class TreeNodeSkeletonComponent {
  @Input() depth = 1;
  @Input() count = 1;

  get items(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}
