import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-list-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  template: `
    <div class="space-y-2">
      @for (item of items(); track $index) {
        <div class="bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 p-3">
          <div class="flex justify-between items-start mb-2">
            <div class="flex items-center gap-2">
              <p-skeleton [width]="firstColWidth()" height="14px" />
              <p-skeleton [width]="secondColWidth()" height="14px" />
            </div>
            <p-skeleton [width]="badgeWidth()" [height]="badgeHeight()" [borderRadius]="badgeBorderRadius()" />
          </div>
          <div class="flex justify-between items-center">
            <p-skeleton [width]="thirdColWidth()" height="14px" />
            <div class="flex items-center gap-2">
              <p-skeleton [width]="fourthColWidth()" height="14px" />
              <p-skeleton [width]="actionSize()" [height]="actionSize()" shape="circle" />
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ListSkeleton {
  itemCount = input(3);
  firstColWidth = input('40px');
  secondColWidth = input('50px');
  thirdColWidth = input('50px');
  fourthColWidth = input('40px');
  badgeWidth = input('60px');
  badgeHeight = input('18px');
  badgeBorderRadius = input('12px');
  actionSize = input('1.5rem');

  items = () => Array.from({ length: this.itemCount() });
}