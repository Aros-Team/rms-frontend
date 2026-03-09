import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../../../shared/ui/product-card/product-card-skeleton.component';
import { ProductCardViewModel } from '../../../../shared/ui/product-card/product-card.model';
import { RmsPageHeaderComponent } from '../../../../shared/ui/page-header/rms-page-header.component';
import { RmsSearchBoxComponent } from '../../../../shared/ui/search-box/rms-search-box.component';
import { RmsFilterChipsComponent } from '../../../../shared/ui/filter-chips/rms-filter-chips.component';
import { RmsButtonComponent } from '../../../../shared/ui/button/rms-button.component';
import { RmsEmptyStateComponent } from '../../../../shared/ui/empty-state/rms-empty-state.component';
import { GetProductsUseCase } from '../../../../core/products/application/use-cases/get-products.use-case';
import { GetCategoriesUseCase } from '../../../../core/products/application/use-cases/get-categories.use-case';

@Component({
  selector: 'app-products-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ProductCardComponent,
    ProductCardSkeletonComponent,
    RmsPageHeaderComponent,
    RmsSearchBoxComponent,
    RmsFilterChipsComponent,
    RmsButtonComponent,
    RmsEmptyStateComponent,
  ],
  templateUrl: './products-list.page.html',
  styleUrl: './products-list.page.css',
})
export class ProductsListPageComponent implements OnInit {
  private readonly getProductsUseCase = inject(GetProductsUseCase);
  private readonly getCategoriesUseCase = inject(GetCategoriesUseCase);

  readonly loading = signal(false);
  readonly activeCategory = signal<string>('Todos');
  readonly searchQuery = signal<string>('');

  readonly categories = signal<{ label: string; value: string }[]>([]);
  readonly products = signal<ProductCardViewModel[]>([]);

  ngOnInit(): void {
    this.getCategoriesUseCase.execute().subscribe({
      next: (categories) => {
        this.categories.set([
          { label: 'Todos', value: 'Todos' },
          ...categories.map(c => ({ label: c.name, value: c.name }))
        ]);
      },
      error: () => {
        this.categories.set([
          { label: 'Todos', value: 'Todos' }
        ]);
      },
    });

    this.getProductsUseCase.execute().subscribe({
      next: (products) => {
        this.products.set(products.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: p.basePrice,
          stock: p.stock ?? 10,
          isActive: p.active,
          hasOptions: p.hasOptions,
          categoryName: p.categoryName,
          tags: [p.categoryName],
        })));
      },
      error: () => {
        this.products.set([]);
      },
    });
  }

  readonly filteredProducts = () => {
    let result = this.products();
    const cat = this.activeCategory();
    if (cat !== 'Todos') {
      result = result.filter(p => p.tags && p.tags.includes(cat));
    }
    const query = this.searchQuery().toLowerCase();
    if (query) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }
    return result;
  };

  setCategory(category: string): void {
    this.activeCategory.set(category);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }
}
