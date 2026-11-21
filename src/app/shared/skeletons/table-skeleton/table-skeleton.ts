import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  templateUrl: './table-skeleton.html',
})
export class TableSkeleton {
  rowCount = input(5);
  colCount = input(6);

  rows = () => Array.from({ length: this.rowCount() });
  cols = () => Array.from({ length: this.colCount() });

  getWidth(index: number): string {
    const widths = ['16%', '17%', '17%', '17%', '17%', '16%'];
    return widths[index] || '17%';
  }
}