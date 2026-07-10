import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-daymenu-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  templateUrl: './day-menu-skeleton.html',
  styleUrl: './day-menu-skeleton.css',
})
export class DayMenuSkeleton {
  variant = input<'mobile' | 'tablet' | 'desktop'>('desktop');
}
