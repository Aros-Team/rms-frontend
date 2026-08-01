import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Category } from '@app/core/services/category/category';
import { OptionCategory } from '@app/core/services/option-category/option-category';
import { Supply } from '@app/core/services/supplies/supply';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { OptionCategoryResponse } from '@app/shared/models/dto/category/option-category';
import { SupplyCategoryResponse } from '@app/shared/models/dto/supplies/supply-category-response';

export interface CategoriesData {
  productCategories: CategorySimpleResponse[];
  optionCategories: OptionCategoryResponse[];
}

@Injectable({ providedIn: 'root' })
export class CategoriesCache {
  private readonly categoryService = inject(Category);
  private readonly optionCategoryService = inject(OptionCategory);
  private readonly supplyService = inject(Supply);

  private categoriesListParams: { search?: string } = {};
  private optionCategoriesListParams: { search?: string } = {};

  // Product categories - TTL largo (30 min)
  readonly productCategories = new ResourceCache<CategorySimpleResponse[]>(
    () => this.categoryService.getCategories(this.categoriesListParams.search),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Option categories - TTL largo (30 min)
  readonly optionCategories = new ResourceCache<OptionCategoryResponse[]>(
    () => this.optionCategoryService.getOptionCategories(this.optionCategoriesListParams.search),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Supply categories - TTL largo (30 min)
  readonly supplyCategories = new ResourceCache<SupplyCategoryResponse[]>(
    () => this.supplyService.getCategories(),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Todas las categorías juntas - para uso en modales
  readonly allCategories = new ResourceCache<CategoriesData>(
    () => forkJoin({
      productCategories: this.categoryService.getCategories(),
      optionCategories: this.optionCategoryService.getOptionCategories()
    }),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  setCategoriesListParams(params: { search?: string }): void {
    this.categoriesListParams = { ...this.categoriesListParams, ...params };
    this.productCategories.reset();
    this.productCategories.load();
  }

  setOptionCategoriesListParams(params: { search?: string }): void {
    this.optionCategoriesListParams = { ...this.optionCategoriesListParams, ...params };
    this.optionCategories.reset();
    this.optionCategories.load();
  }

  invalidateAll(): void {
    this.productCategories.invalidate();
    this.optionCategories.invalidate();
    this.supplyCategories.invalidate();
    this.allCategories.invalidate();
  }
}
