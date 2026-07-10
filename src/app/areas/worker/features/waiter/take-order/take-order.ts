import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MasterData } from '@app/core/services/master-data/master-data';
import { OrderDock, DockItem } from '@app/core/services/order-dock/order-dock';
import { Logging } from '@app/core/services/logging/logging';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';

@Component({
  selector: 'app-take-order',
  templateUrl: './take-order.html',
  imports: [CommonModule, FormsModule, KeyValuePipe],
})
export class TakeOrder implements OnInit {
  private masterData = inject(MasterData);
  private dock = inject(OrderDock);
  private logger = inject(Logging);

  loading = signal(true);
  error = signal<string | null>(null);

  productsByCategory = signal<Record<string, ProductListResponse[]>>({});
  searchQuery = signal<string>('');
  activeCategory = signal<string>('');

  // Options modal state
  showOptionsModal = signal(false);
  pendingProduct = signal<ProductListResponse | null>(null);
  pendingOptions = signal<number[]>([]);
  pendingInstructions = signal('');
  modalOptions = signal<ProductOption[]>([]);
  modalOptionsLoading = signal(false);

  categories = computed(() => Object.keys(this.productsByCategory()));

  filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const category = this.activeCategory();
    const products = this.productsByCategory()[category] ?? [];
    if (!query) return products;
    return products.filter(p => p.name.toLowerCase().includes(query));
  });

  modalOptionsByCategory = computed(() =>
    this.masterData.groupOptionsByCategory(this.modalOptions())
  );

  ngOnInit(): void {
    this.masterData.load().subscribe({
      next: () => {
        this.productsByCategory.set(this.masterData.getProductsByCategory());
        const cats = Object.keys(this.masterData.getProductsByCategory());
        if (cats.length) this.activeCategory.set(cats[0]);
        this.loading.set(false);
      },
      error: (err) => {
        this.logger.error('TakeOrder: failed to load master data', err);
        this.error.set('No se pudieron cargar los datos. Intenta de nuevo.');
        this.loading.set(false);
      }
    });
  }

  selectCategory(cat: string): void {
    this.activeCategory.set(cat);
  }

  addProduct(product: ProductListResponse): void {
    this.pendingProduct.set(product);
    this.pendingOptions.set([]);
    this.pendingInstructions.set('');
    this.modalOptions.set([]);
    this.modalOptionsLoading.set(true);
    this.showOptionsModal.set(true);
    this.error.set(null);

    this.masterData.getProductOptions(product.id).subscribe({
      next: (options) => {
        this.modalOptions.set(options);
        this.modalOptionsLoading.set(false);
      },
      error: (err) => {
        this.logger.error('TakeOrder: failed to load product options', err);
        this.modalOptions.set([]);
        this.modalOptionsLoading.set(false);
      }
    });
  }

  toggleOption(optionId: number, categoryId: number): void {
    const sameCategory = this.modalOptions()
      .filter(o => o.optionCategoryId === categoryId)
      .map(o => o.id);

    this.pendingOptions.update(ids => {
      const withoutCategory = ids.filter(id => !sameCategory.includes(id));
      return ids.includes(optionId) ? withoutCategory : [...withoutCategory, optionId];
    });
  }

  isOptionSelected(optionId: number): boolean {
    return this.pendingOptions().includes(optionId);
  }

  confirmOptions(): void {
    const product = this.pendingProduct();
    if (!product) return;

    const selectedIds = [...this.pendingOptions()];
    const optionNames = selectedIds
      .map(id => this.modalOptions().find(o => o.id === id)?.name ?? '')
      .filter(Boolean);

    const item: DockItem = {
      product,
      instructions: this.pendingInstructions(),
      selectedOptionIds: selectedIds,
      optionNames
    };

    this.dock.addItemToDiner(item);
    this.closeModal();
  }

  closeModal(): void {
    this.showOptionsModal.set(false);
    this.pendingProduct.set(null);
    this.pendingOptions.set([]);
    this.pendingInstructions.set('');
    this.modalOptions.set([]);
    this.error.set(null);
  }

  defaultImage = 'assets/placeholder-product.svg';
}
