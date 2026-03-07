import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../../../shared/ui/product-card/product-card-skeleton.component';
import { ProductCardViewModel } from '../../../../shared/ui/product-card/product-card.model';

@Component({
  selector: 'app-products-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ButtonModule, ProductCardComponent, ProductCardSkeletonComponent],
  template: `
    <main class="page-container">
      <header class="page-header">
        <div>
          <h1>Productos</h1>
          <p>Administra el catalogo de productos del restaurante</p>
        </div>
        <button pButton routerLink="new" label="Nuevo Producto" icon="pi pi-plus"></button>
      </header>

      <section class="filters">
        <div class="search-box">
          <i class="pi pi-search"></i>
          <input type="text" placeholder="Buscar productos..." (input)="onSearch($event)" />
        </div>
        <div class="filter-tags">
          <button 
            *ngFor="let cat of categories" 
            class="filter-tag"
            [class.active]="activeCategory() === cat"
            (click)="setCategory(cat)"
          >
            {{ cat }}
          </button>
        </div>
      </section>

      <section class="products-grid" *ngIf="loading(); else productsList">
        <app-product-card-skeleton></app-product-card-skeleton>
        <app-product-card-skeleton></app-product-card-skeleton>
        <app-product-card-skeleton></app-product-card-skeleton>
        <app-product-card-skeleton></app-product-card-skeleton>
      </section>

      <ng-template #productsList>
        <section class="products-grid">
          <app-product-card
            *ngFor="let product of filteredProducts()"
            [product]="product"
          ></app-product-card>
        </section>
        <p class="empty-state" *ngIf="filteredProducts().length === 0">
          No se encontraron productos
        </p>
      </ng-template>
    </main>
  `,
  styles: [
    `
      .page-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .page-header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #f1f5f9;
        margin: 0;
      }

      .page-header p {
        color: #64748b;
        font-size: 0.875rem;
        margin: 0.25rem 0 0;
      }

      .page-header button {
        background: #0f172a;
        border: 1px solid #334155;
      }

      .page-header button:hover {
        background: #1e293b;
      }

      .filters {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .search-box {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 0.75rem;
        padding: 0.75rem 1rem;
      }

      .search-box i {
        color: #64748b;
      }

      .search-box input {
        flex: 1;
        background: transparent;
        border: none;
        color: #f1f5f9;
        font-size: 0.9rem;
        outline: none;
      }

      .search-box input::placeholder {
        color: #64748b;
      }

      .filter-tags {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .filter-tag {
        padding: 0.4rem 0.85rem;
        border-radius: 1.5rem;
        border: 1px solid #334155;
        background: transparent;
        color: #94a3b8;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
      }

      .filter-tag:hover {
        background: #1e293b;
        color: #e2e8f0;
      }

      .filter-tag.active {
        background: #f1f5f9;
        color: #0f172a;
        border-color: #f1f5f9;
      }

      .products-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
      }

      .empty-state {
        text-align: center;
        color: #64748b;
        padding: 3rem;
      }
    `,
  ],
})
export class ProductsListPageComponent {
  readonly loading = signal(false);
  readonly activeCategory = signal<string>('Todos');

  readonly categories = ['Todos', 'Entradas', 'PlatosFuertes', 'Bebidas', 'Postres'];

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
    const cat = this.activeCategory();
    if (cat === 'Todos') {
      return this.products();
    }
    return this.products().filter(p => p.tags && p.tags.includes(cat));
  };

  setCategory(category: string): void {
    this.activeCategory.set(category);
  }

  onSearch(event: Event): void {
    // Implementar búsqueda
  }
}
