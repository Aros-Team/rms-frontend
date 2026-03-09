import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { OrdersFacade } from '../../application/orders.facade';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../../../shared/ui/product-card/product-card-skeleton.component';
import { ProductCardViewModel } from '../../../../shared/ui/product-card/product-card.model';
import { TableResponse } from '../../../../shared/models/dto/table/table-response.model';
import { RmsPageHeaderComponent } from '../../../../shared/ui/page-header/rms-page-header.component';
import { RmsSelectComponent } from '../../../../shared/ui/select/rms-select.component';
import { RmsCartItemComponent } from '../../../../shared/ui/cart-item/rms-cart-item.component';
import { RmsButtonComponent } from '../../../../shared/ui/button/rms-button.component';
import { RmsBadgeComponent } from '../../../../shared/ui/badge/rms-badge.component';
import { ProductOptionsSelectorComponent } from '../../../../shared/ui/product-options-selector/product-options-selector.component';
import { GetProductsUseCase } from '../../../../core/products/application/use-cases/get-products.use-case';
import { GetProductOptionsUseCase } from '../../../../core/products/application/use-cases/get-product-options.use-case';
import { Product } from '../../../../core/products/domain/models/product.model';
import { ProductOption } from '../../../../core/products/domain/models/product-option.model';
import { CreateOrderUseCase, OrderValidationError } from '../../../../core/orders/application/use-cases/create-order.use-case';
import { OrdersEventsService } from '../../../../shared/services/orders-events.service';

interface CartItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  instructions: string;
  selectedOptionIds: number[];
  hasOptions: boolean;
}

@Component({
  selector: 'app-orders-home-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ProductCardComponent,
    ProductCardSkeletonComponent,
    RmsPageHeaderComponent,
    RmsSelectComponent,
    RmsCartItemComponent,
    RmsButtonComponent,
    RmsBadgeComponent,
    ProductOptionsSelectorComponent,
  ],
  templateUrl: './orders-home.page.html',
  styleUrl: './orders-home.page.css',
})
export class OrdersHomePageComponent implements OnInit {
  private readonly ordersFacade = inject(OrdersFacade);
  private readonly getProductsUseCase = inject(GetProductsUseCase);
  private readonly getProductOptionsUseCase = inject(GetProductOptionsUseCase);
  private readonly createOrderUseCase = inject(CreateOrderUseCase);
  private readonly ordersEvents = inject(OrdersEventsService);

  readonly products = signal<ProductCardViewModel[]>([]);
  // Mapa de productos para validación rápida
  private readonly productsMap = signal<Map<number, Product>>(new Map());
  readonly catalogLoading = signal(true);

  readonly tables = signal<TableResponse[]>([]);
  readonly cart = signal<CartItem[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly lastOrderId = signal<number | null>(null);

  readonly selectedTableId = signal<number | null>(null);

  // Options selector state
  readonly showOptionsSelector = signal(false);
  readonly optionsSelectorProduct = signal<{ id: number; name: string } | null>(null);
  readonly productOptions = signal<ProductOption[]>([]);
  readonly optionsLoading = signal(false);

  readonly availableTables = computed(() => this.tables().filter(t => t.status === 'AVAILABLE'));

  // Mostrar todas las mesas, no solo las disponibles, para que el mesero pueda seleccionar
  readonly tableOptions = computed(() =>
    this.tables().map(t => ({
      label: `Mesa ${t.tableNumber} (${t.capacity} pers.) - ${t.status}`,
      value: t.id,
    }))
  );

  readonly totalPrice = computed(() =>
    this.cart().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  readonly canSubmit = computed(() =>
    this.selectedTableId() !== null && this.cart().length > 0
  );

  ngOnInit(): void {
    this.loadProducts();
    this.loadTables();
    this.loadProductOptions();
  }

  loadProductOptions(): void {
    this.optionsLoading.set(true);
    this.getProductOptionsUseCase.execute().subscribe({
      next: (options) => {
        this.productOptions.set(options);
        this.optionsLoading.set(false);
      },
      error: () => {
        this.productOptions.set([]);
        this.optionsLoading.set(false);
      },
    });
  }

  loadProducts(): void {
    this.getProductsUseCase.execute().subscribe({
      next: (products) => {
        // Crear mapa de productos para validación
        const map = new Map<number, Product>();
        products.forEach(p => map.set(p.id, p));
        this.productsMap.set(map);

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
        this.catalogLoading.set(false);
      },
      error: () => {
        this.products.set([]);
        this.catalogLoading.set(false);
      },
    });
  }

  loadTables(): void {
    this.ordersFacade.getTables().subscribe({
      next: (tables) => this.tables.set(tables),
      error: () => this.tables.set([]),
    });
  }

  addToCart(productId: number): void {
    const product = this.products().find(p => p.id === productId);
    if (!product) return;

    // Si el producto tiene opciones, mostrar el selector de opciones
    if (product.hasOptions) {
      this.optionsSelectorProduct.set({ id: product.id, name: product.name });
      this.showOptionsSelector.set(true);
      return;
    }

    // Producto sin opciones - agregar directamente al carrito
    this.addItemToCart(product.id, product.name, product.price, false, []);
  }

  addItemToCart(productId: number, productName: string, price: number, hasOptions: boolean, selectedOptionIds: number[]): void {
    const existing = this.cart().find(item => item.productId === productId);
    if (existing) {
      this.cart.update(items =>
        items.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1, selectedOptionIds: [...selectedOptionIds] }
            : item
        )
      );
    } else {
      this.cart.update(items => [
        ...items,
        {
          productId,
          productName,
          price,
          quantity: 1,
          instructions: '',
          selectedOptionIds,
          hasOptions,
        },
      ]);
    }
  }

  onOptionsConfirm(event: { selectedOptionIds: number[] }): void {
    const product = this.optionsSelectorProduct();
    if (product) {
      const productInfo = this.products().find(p => p.id === product.id);
      if (productInfo) {
        this.addItemToCart(product.id, product.name, productInfo.price, true, event.selectedOptionIds);
      }
    }
    this.closeOptionsSelector();
  }

  closeOptionsSelector(): void {
    this.showOptionsSelector.set(false);
    this.optionsSelectorProduct.set(null);
  }

  incrementQty(productId: number): void {
    this.cart.update(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  decrementQty(productId: number): void {
    const item = this.cart().find(i => i.productId === productId);
    if (!item) return;
    
    if (item.quantity <= 1) {
      this.removeFromCart(productId);
    } else {
      this.cart.update(items =>
        items.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
      );
    }
  }

  removeFromCart(productId: number): void {
    this.cart.update(items => items.filter(item => item.productId !== productId));
  }

  updateInstructions(productId: number, instructions: string): void {
    this.cart.update(items =>
      items.map(item =>
        item.productId === productId
          ? { ...item, instructions }
          : item
      )
    );
  }

  onTableChange(value: number | null): void {
    this.selectedTableId.set(value);
  }

  submit(): void {
    const tableId = this.selectedTableId();
    if (!tableId || this.cart().length === 0 || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    // Validar opciones de productos antes de enviar según especificación técnica
    // - Si hasOptions es true, selectedOptionIds debe tener al menos 1 valor
    // - Si hasOptions es false, selectedOptionIds debe ser null o vacío
    try {
      const details = this.cart().map(item => ({
        productId: item.productId,
        instructions: item.instructions || undefined,
        selectedOptionIds: item.selectedOptionIds.length > 0 ? item.selectedOptionIds : undefined,
      }));

      // Validar opciones
      this.createOrderUseCase.validateProductOptions(details, this.productsMap());

      this.ordersFacade
        .createOrder({
          tableId,
          details,
        })
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe({
          next: (order) => {
            // Emitir evento para que Cocina actualice la cola inmediatamente
            this.ordersEvents.emitOrderCreated(order);
            this.lastOrderId.set(order.id);
            this.cart.set([]);
            this.selectedTableId.set(null);
          },
          error: (err) => {
            const backendMessage = err?.error?.message || err?.message;
            this.errorMessage.set(backendMessage || 'No se pudo crear la orden.');
          },
        });
    } catch (validationError) {
      this.loading.set(false);
      if (validationError instanceof OrderValidationError) {
        this.errorMessage.set(validationError.message);
      } else {
        this.errorMessage.set('Error de validación');
      }
    }
  }
}
