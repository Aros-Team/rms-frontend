import { Injectable, inject } from '@angular/core';
import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Category } from '@app/core/services/category/category';
import { Supply } from '@app/core/services/supplies/supply';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { SupplyCategoryResponse } from '@app/shared/models/dto/supplies/supply-category-response';

@Injectable({ providedIn: 'root' })
export class CategoriesCache {
  private readonly categoryService = inject(Category);
  private readonly supplyService = inject(Supply);

  private categoriesListParams: { search?: string } = {};

  // Product categories - TTL largo (30 min)
  readonly productCategories = new ResourceCache<CategorySimpleResponse[]>(
    () => this.categoryService.getCategories(this.categoriesListParams.search),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Supply categories - TTL largo (30 min)
  readonly supplyCategories = new ResourceCache<SupplyCategoryResponse[]>(
    () => this.supplyService.getCategories(),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  setCategoriesListParams(params: { search?: string }): void {
    this.categoriesListParams = { ...this.categoriesListParams, ...params };
    this.productCategories.reset();
    this.productCategories.load();
  }

  invalidateAll(): void {
    this.productCategories.invalidate();
    this.supplyCategories.invalidate();
  }
}
