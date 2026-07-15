import { Injectable, computed, inject, type Signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ResourceCache } from '@app/core/cache/resource-cache';
import { Category } from '@app/core/services/category/category';
import { Product } from '@app/core/services/products/product';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { SELECTION_TYPE } from '@app/shared/models/dto/special-selections/selection-type';

export interface ComboReferenceData {
  categories: CategorySimpleResponse[];
  products: ProductResponse[];
}

const COMBO_REFERENCE_TTL_MS = 5 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class ComboReferenceCache {
  private readonly categoryService = inject(Category);
  private readonly productService = inject(Product);

  readonly reference = new ResourceCache<ComboReferenceData>(
    () => forkJoin({
      categories: this.categoryService.getCategories(),
      products: this.productService.getProducts(true),
    }),
    { ttlMs: COMBO_REFERENCE_TTL_MS, staleWhileRevalidate: true }
  );

  readonly categories: Signal<CategorySimpleResponse[]> = computed(
    () => this.reference.data()?.categories ?? []
  );

  readonly products: Signal<ProductResponse[]> = computed(
    () => this.reference.data()?.products ?? []
  );

  readonly isLoading: Signal<boolean> = computed(() => this.reference.isLoading());

  readonly hasData: Signal<boolean> = computed(() => this.reference.hasData());

  readonly error: Signal<Error | undefined> = computed(() => this.reference.error());

  readonly status: Signal<'fresh' | 'stale' | 'loading'> = computed(
    () => this.reference.status()
  );

  load(): void {
    this.reference.load();
  }

  loadIfStale(): void {
    this.reference.loadIfStale();
  }

  refresh(): void {
    this.reference.refresh();
  }

  invalidate(): void {
    this.reference.invalidate();
  }

  reset(): void {
    this.reference.reset();
  }

  categoryById(id: number): CategorySimpleResponse | undefined {
    return this.categories().find((c) => c.id === id);
  }

  categoryName(id: number): string | undefined {
    return this.categoryById(id)?.name;
  }

  productById(id: number): ProductResponse | undefined {
    return this.products().find((p) => p.id === id);
  }

  productsByCategory(categoryId: number): ProductResponse[] {
    return this.products().filter((p) => p.categoryId === categoryId);
  }

  specialSelectionProducts(): ProductResponse[] {
    return this.products().filter((p) => p.selectionType === SELECTION_TYPE.SPECIAL_SELECTION);
  }

  specialSelectionProductsByCategory(categoryId: number): ProductResponse[] {
    return this.products().filter(
      (p) => p.categoryId === categoryId && p.selectionType === SELECTION_TYPE.SPECIAL_SELECTION
    );
  }
}