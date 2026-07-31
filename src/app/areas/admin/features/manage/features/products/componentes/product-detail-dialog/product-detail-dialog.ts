import { Component, inject, Input, Output, EventEmitter, signal, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '@app/core/services/products/product';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductOption as ProductOptionDTO } from '@app/shared/models/dto/products/product-option';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-product-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    MessageModule,
    ProgressBarModule,
    SkeletonModule,
    TagModule,
  ],
  templateUrl: './product-detail-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailDialog implements OnChanges {
  @Input() product: ProductResponse | null = null;
  @Input() visible = signal(false);
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() editProduct = new EventEmitter<number>();
  @Output() productUpdated = new EventEmitter<void>();

  private productService = inject(Product);
  private masterDataService = inject(MasterData);
  private logger = inject(Logging);

  detailOptions = signal<ProductOptionDTO[]>([]);
  detailOptionsLoading = signal(false);
  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

  cost = signal<ProductCostResponse | null>(null);
  costLoading = signal(false);
  costError = signal<string | null>(null);

  ngOnChanges(): void {
    if (!this.product || !this.visible()) {
      this.cost.set(null);
      this.costLoading.set(false);
      this.costError.set(null);
      return;
    }
    this.loadProductDetails();
    this.loadProductCost(this.product.id);
  }

  private loadProductDetails(): void {
    if (!this.product) return;
    this.detailOptionsLoading.set(true);
    this.productService.getOptions(this.product.id).pipe(
      catchError(() => of([] as ProductOptionDTO[]))
    ).subscribe(opts => {
      this.detailOptions.set(opts);
      this.detailOptionsLoading.set(false);
    });
  }

  loadProductCost(productId: number): void {
    if (!productId) { this.cost.set(null); return; }
    this.costLoading.set(true);
    this.costError.set(null);
    this.productService.getCost(productId).pipe(
      catchError(err => {
        this.logger.error('Error loading product cost', err);
        this.costError.set('No se pudo calcular el costo de producción');
        return of(null);
      })
    ).subscribe(c => {
      if (c) this.cost.set(c);
      this.costLoading.set(false);
    });
  }

  close(): void {
    this.visible.set(false);
    this.visibleChange.emit(false);
  }

  openEditDialog(): void {
    if (this.product) {
      this.editProduct.emit(this.product.id);
      this.close();
    }
  }

  groupByCategory(options: ProductOptionDTO[]): { category: string; items: ProductOptionDTO[] }[] {
    const map = new Map<string, ProductOptionDTO[]>();
    for (const o of options) {
      const arr = map.get(o.optionCategoryName) ?? [];
      arr.push(o);
      map.set(o.optionCategoryName, arr);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }
}