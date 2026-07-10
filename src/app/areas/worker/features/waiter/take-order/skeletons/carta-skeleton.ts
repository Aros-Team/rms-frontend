import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-carta-skeleton',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  templateUrl: './carta-skeleton.html',
  styleUrl: './carta-skeleton.css',
})
export class CartaSkeleton {
  variant = input<'mobile' | 'tablet' | 'desktop'>('desktop');
}
