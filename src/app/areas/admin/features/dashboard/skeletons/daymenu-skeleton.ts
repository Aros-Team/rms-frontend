import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-daymenu-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  template: `
    @if (variant() === 'mobile') {
      <div class="bg-surface-50 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
        <div class="flex items-center gap-2 mb-3">
          <p-skeleton shape="circle" size="1.25rem" />
          <p-skeleton width="60%" height="1.25rem" />
        </div>
        <div class="flex justify-between items-center text-base">
          <p-skeleton width="40px" height="1rem" />
          <p-skeleton width="60px" height="1.5rem" />
        </div>
      </div>
    } @else if (variant() === 'tablet') {
      <div class="bg-surface-50 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-3">
        <div class="flex items-center gap-2 mb-2">
          <p-skeleton shape="circle" size="1rem" />
          <p-skeleton width="50%" height="1rem" />
        </div>
        <div class="flex justify-between items-center text-sm">
          <p-skeleton width="35px" height="0.875rem" />
          <p-skeleton width="50px" height="1rem" />
        </div>
      </div>
    } @else {
      <div class="bg-surface-50 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
        <div class="flex items-center gap-2 mb-3">
          <p-skeleton shape="circle" size="1.25rem" />
          <p-skeleton width="55%" height="1.125rem" />
        </div>
        <div class="flex justify-between items-center text-sm">
          <p-skeleton width="40px" height="0.875rem" />
          <p-skeleton width="55px" height="1.125rem" />
        </div>
      </div>
    }
  `,
})
export class DaymenuSkeleton {
  variant = input<'mobile' | 'tablet' | 'desktop'>('desktop');
}
