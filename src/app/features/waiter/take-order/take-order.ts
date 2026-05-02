import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MasterDataService } from '@app/core/services/master-data/master-data.service';
import { OrderService } from '@app/core/services/orders/order-service';
import { LoggingService } from '@app/core/services/logging/logging-service';
import { CartService } from '@app/core/services/cart/cart.service';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';
import { CreateOrderDetail } from '@app/shared/models/dto/orders/create-order-request.model';
import { TableNumberPipe } from '@app/shared/pipes/table-number.pipe';
import { KeyValuePipe } from '@angular/common';

export interface CartItem {
  product: ProductListResponse;
  instructions: string;
  selectedOptionIds: number[];
  optionNames: string[];
}

@Component({
  selector: 'app-take-order',
  templateUrl: './take-order.html',
  imports: [CommonModule, FormsModule, TableNumberPipe, KeyValuePipe],
})
export class TakeOrder implements OnInit {
  private masterData = inject(MasterDataService);
  private orderService = inject(OrderService);
  private logger = inject(LoggingService);
  private cartService = inject(CartService);

  // Estado de carga
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Datos maestros
  tables = signal<TableResponse[]>([]);
  productsByCategory = signal<Record<string, ProductListResponse[]>>({});

  // Selección
  selectedTableId = signal<number | null>(null);
  cart = signal<CartItem[]>([]);

  // UI state
  activeCategory = signal<string>('');
  searchQuery = signal<string>('');
  showOptionsModal = signal(false);
  pendingProduct = signal<ProductListResponse | null>(null);
  pendingOptions = signal<number[]>([]);
  pendingInstructions = signal('');
  modalOptions = signal<ProductOption[]>([]);
  modalOptionsLoading = signal(false);

  // Computed
  categories = computed(() => Object.keys(this.productsByCategory()));
  cartTotal = computed(() =>
    this.cart().reduce((sum, item) => sum + item.product.basePrice, 0)
  );
  modalOptionsByCategory = computed(() =>
    this.masterData.groupOptionsByCategory(this.modalOptions())
  );
  
  filteredProducts = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const category = this.activeCategory();
    const products = this.productsByCategory()[category] || [];
    
    if (!query) return products;
    
    return products.filter(p => 
      p.name.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    this.masterData.load().subscribe({
      next: () => {
        this.tables.set(this.masterData.getAvailableTables());
        this.productsByCategory.set(this.masterData.getProductsByCategory());
        const cats = Object.keys(this.masterData.getProductsByCategory());
        if (cats.length) this.activeCategory.set(cats[0]);
        // Consume items pre-cargados desde el menú del día
        const pending = this.cartService.flush();
        if (pending.length) this.cart.set(pending);
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
    // Always open the options modal — products may or may not have options.
    // If no options are available, the user can confirm without selecting any.
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
      // quitar todas las de la misma categoría, luego agregar la nueva (o deseleccionar si ya estaba)
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

    this.cart.update(c => [...c, {
      product,
      instructions: this.pendingInstructions(),
      selectedOptionIds: selectedIds,
      optionNames
    }]);

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

  removeFromCart(index: number): void {
    this.cart.update(c => c.filter((_, i) => i !== index));
  }

  canSubmit(): boolean {
    return !!this.selectedTableId() && this.cart().length > 0 && !this.submitting();
  }

  private resolveOrderError(err: { status?: number; error?: { message?: string } }): string {
    return err?.error?.message || 'No se pudo crear la orden. Intenta de nuevo.';
  }

  submitOrder(): void {
    const tableId = this.selectedTableId();
    if (!tableId || this.cart().length === 0) return;

    this.submitting.set(true);
    this.error.set(null);

    const details: CreateOrderDetail[] = this.cart().map(item => ({
      productId: item.product.id,
      instructions: item.instructions,
      selectedOptionIds: item.selectedOptionIds,
    }));

    this.orderService.createOrder({ tableId, details }).subscribe({
      next: (order) => {
        this.logger.info('TakeOrder: order created', order);
        this.successMessage.set(`Orden #${order.id} creada exitosamente`);
        this.cart.set([]);
        this.selectedTableId.set(null);
        this.submitting.set(false);
        // Recargar mesas para reflejar estado OCCUPIED
        this.masterData.reloadTables().subscribe(() => {
          this.tables.set(this.masterData.getAvailableTables());
        });
      },
      error: (err) => {
        this.logger.error('TakeOrder: create order failed', err);
        const msg = this.resolveOrderError(err);
        this.error.set(msg);
        this.submitting.set(false);
      }
    });
  }
}
