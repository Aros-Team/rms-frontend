import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-list-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  templateUrl: './list-skeleton.html',
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