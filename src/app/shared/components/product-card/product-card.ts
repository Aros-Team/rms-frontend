import { Component, Input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';
import { ProductSimpleResponse } from '@app/shared/models/dto/products/product-simple-response';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
  imports: [CommonModule, SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  @Input() product: ProductSimpleResponse | null = null;
  @Input() selected = false;
  @Input() disabled = false;
  @Input() unavailable = false;
  @Input() loading = false;

  readonly cardToggle = output<ProductSimpleResponse>();

  readonly defaultImage = 'assets/placeholder-product.svg';

  onToggle(event?: Event): void {
    if (this.disabled || this.unavailable || this.loading) return;
    if (!this.product) return;
    event?.preventDefault();
    this.cardToggle.emit(this.product);
  }
}
