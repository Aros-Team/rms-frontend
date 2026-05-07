import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-table-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  template: `
    <div class="flex flex-col min-h-[400px] gap-2">
      @for (row of rows(); track $index) {
        <div class="flex flex-1 w-full gap-2">
          @for (col of cols(); track $index) {
            <p-skeleton [width]="getWidth($index)" height="1.5rem" />
          }
        </div>
      }
    </div>
  `,
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