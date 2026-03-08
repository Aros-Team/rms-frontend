import { Component, inject, signal } from '@angular/core';
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
export class ProductsListPageComponent {
  readonly loading = signal(false);
  readonly activeCategory = signal<string>('Todos');
  readonly searchQuery = signal<string>('');

  readonly categories = [
    { label: 'Todos', value: 'Todos' },
    { label: 'Entradas', value: 'Entradas' },
    { label: 'Platos Fuertes', value: 'PlatosFuertes' },
    { label: 'Bebidas', value: 'Bebidas' },
    { label: 'Postres', value: 'Postres' },
  ];

  readonly products = signal<ProductCardViewModel[]>([
    {
      id: 1,
      name: 'Salmón al horno',
      description: 'Salmón glaseado con vegetales estacionales y salsa citrica.',
      price: 24,
      stock: 8,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80',
      tags: ['PlatosFuertes'],
    },
    {
      id: 2,
      name: 'Ravioli de ricotta',
      description: 'Pasta fresca artesanal con mantequilla de salvia y nuez tostada.',
      price: 18,
      stock: 3,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80',
      tags: ['PlatosFuertes'],
    },
    {
      id: 3,
      name: 'Limonada de la casa',
      description: 'Bebida fresca con menta, lima y toque de jengibre.',
      price: 7,
      stock: 15,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=80',
      tags: ['Bebidas'],
    },
    {
      id: 4,
      name: 'Ensalada César',
      description: 'Lechuga romana, crutones, parmesan y aderezo César.',
      price: 12,
      stock: 10,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=1200&q=80',
      tags: ['Entradas'],
    },
    {
      id: 5,
      name: 'Ribeye steak',
      description: 'Corte de res premium a la parrilla con hierbas.',
      price: 32,
      stock: 5,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80',
      tags: ['PlatosFuertes'],
    },
    {
      id: 6,
      name: 'Tiramisú',
      description: 'Postre italiano clásico con café y mascarpone.',
      price: 9,
      stock: 4,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=80',
      tags: ['Postres'],
    },
  ]);

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
