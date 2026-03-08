import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
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

interface CartItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  instructions: string;
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
  ],
  templateUrl: './orders-home.page.html',
  styleUrl: './orders-home.page.css',
})
export class OrdersHomePageComponent {
  private readonly ordersFacade = inject(OrdersFacade);

  readonly products = signal<ProductCardViewModel[]>([
    {
      id: 1,
      name: 'Salmón al horno',
      description: 'Salmón glaseado con vegetales estacionales y salsa citrica.',
      price: 24,
      stock: 8,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80',
      tags: ['Chef choice', 'Proteina'],
    },
    {
      id: 2,
      name: 'Ravioli de ricotta',
      description: 'Pasta fresca artesanal con mantequilla de salvia y nuez tostada.',
      price: 18,
      stock: 3,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80',
      tags: ['Pasta', 'Top ventas'],
    },
    {
      id: 3,
      name: 'Limonada de la casa',
      description: 'Bebida fresca con menta, lima y toque de jengibre.',
      price: 7,
      stock: 0,
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
      tags: ['Ensaladas'],
    },
    {
      id: 5,
      name: 'Ribeye steak',
      description: 'Corte de res premium a la parrilla con hierbas.',
      price: 32,
      stock: 5,
      isActive: true,
      imageUrl: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80',
      tags: ['Carnes', 'Top ventas'],
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

  readonly tables = signal<TableResponse[]>([]);
  readonly cart = signal<CartItem[]>([]);
  readonly loading = signal(false);
  readonly catalogLoading = signal(true);
  readonly errorMessage = signal('');
  readonly lastOrderId = signal<number | null>(null);

  readonly selectedTableId = signal<number | null>(null);

  readonly availableTables = computed(() => this.tables().filter(t => t.status === 'AVAILABLE'));

  readonly tableOptions = computed(() => 
    this.availableTables().map(t => ({
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

  constructor() {
    window.setTimeout(() => this.catalogLoading.set(false), 650);
    this.loadTables();
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

    const existing = this.cart().find(item => item.productId === productId);
    if (existing) {
      this.cart.update(items =>
        items.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      this.cart.update(items => [
        ...items,
        {
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: 1,
          instructions: '',
        },
      ]);
    }
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

    const payload = {
      tableId,
      details: this.cart().map(item => ({
        productId: item.productId,
        instructions: item.instructions || undefined,
      })),
    };

    this.ordersFacade
      .createOrder(payload)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (order) => {
          this.lastOrderId.set(order.id);
          this.cart.set([]);
          this.selectedTableId.set(null);
        },
        error: (err) => {
          const backendMessage = err?.error?.message || err?.message;
          this.errorMessage.set(backendMessage || 'No se pudo crear la orden.');
        },
      });
  }
}
