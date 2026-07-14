import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ResourceCache } from '@app/core/cache/resource-cache';
import { Category } from '@app/core/services/category/category';
import { OptionCategory } from '@app/core/services/option-category/option-category';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { OptionCategoryResponse } from '@app/shared/models/dto/category/option-category.model';

export interface CategoriesData {
  productCategories: CategorySimpleResponse[];
  optionCategories: OptionCategoryResponse[];
}

@Injectable({ providedIn: 'root' })
export class CategoriesCacheService {
  private readonly categoryService = inject(Category);
  private readonly optionCategoryService = inject(OptionCategory);

  // Product categories - TTL largo (30 min)
  readonly productCategories = new ResourceCache<CategorySimpleResponse[]>(
    () => this.categoryService.getCategories(),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Option categories - TTL largo (30 min)
  readonly optionCategories = new ResourceCache<OptionCategoryResponse[]>(
    () => this.optionCategoryService.getOptionCategories(),
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

  invalidateAll(): void {
    this.productCategories.invalidate();
    this.optionCategories.invalidate();
    this.allCategories.invalidate();
  }
}
