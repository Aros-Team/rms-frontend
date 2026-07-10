import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-today-orders-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  templateUrl: './today-orders-skeleton.html',
  styleUrl: './today-orders-skeleton.css',
})
export class TodayOrdersSkeleton {
  variant = input<'mobile' | 'tablet' | 'desktop'>('desktop');
}
