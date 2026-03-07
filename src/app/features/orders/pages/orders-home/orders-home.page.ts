import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { OrdersFacade } from '../../application/orders.facade';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../../../shared/ui/product-card/product-card-skeleton.component';
import { ProductCardViewModel } from '../../../../shared/ui/product-card/product-card.model';
import { TableResponse } from '../../../../shared/models/dto/table/table-response.model';

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
  imports: [CommonModule, ReactiveFormsModule, ProductCardComponent, ProductCardSkeletonComponent],
  template: `
    <main class="layout">
      <section class="hero">
        <p class="eyebrow">Restaurant Management System</p>
        <h1>Nueva Orden</h1>
        <p class="subtitle">Selecciona una mesa y los productos para crear una nueva orden</p>
      </section>

      <div class="content-grid">
        <section class="card catalog">
          <header class="catalog__header">
            <h2>Productos</h2>
            <p>Selecciona los productos para agregar a la orden</p>
          </header>

          <div class="grid" *ngIf="catalogLoading(); else productsList">
            <app-product-card-skeleton></app-product-card-skeleton>
            <app-product-card-skeleton></app-product-card-skeleton>
            <app-product-card-skeleton></app-product-card-skeleton>
          </div>

          <ng-template #productsList>
            <div class="grid">
              <app-product-card
                *ngFor="let product of products()"
                [product]="product"
                (add)="addToCart($event.productId)"
              ></app-product-card>
            </div>
          </ng-template>
        </section>

        <aside class="card order-panel">
          <h2>Orden</h2>
          
          <div class="form-group">
            <label for="table">Mesa</label>
            <select id="table" formControlName="tableId" class="input-field">
              <option [value]="null" disabled>Selecciona una mesa</option>
              <option *ngFor="let table of availableTables()" [value]="table.id">
                Mesa {{ table.tableNumber }} ({{ table.capacity }} pers.) - {{ table.status }}
              </option>
            </select>
          </div>

          <div class="cart-items" *ngIf="cart().length > 0; else emptyCart">
            <div class="cart-item" *ngFor="let item of cart(); let i = index; trackBy: trackByProductId">
              <div class="cart-item-info">
                <span class="cart-item-name">{{ item.productName }}</span>
                <span class="cart-item-price">\${{ item.price }}</span>
              </div>
              <div class="cart-item-controls">
                <button class="qty-btn" (click)="decrementQty(i)">-</button>
                <span class="qty">{{ item.quantity }}</span>
                <button class="qty-btn" (click)="incrementQty(i)">+</button>
                <button class="remove-btn" (click)="removeFromCart(i)">×</button>
              </div>
              <input
                type="text"
                class="input-field instructions"
                placeholder="Instrucciones (ej: sin cebolla)"
                [value]="item.instructions"
                (input)="updateInstructions(i, $event)"
              />
            </div>
          </div>

          <ng-template #emptyCart>
            <p class="empty-cart">No hay productos en la orden</p>
          </ng-template>

          <div class="order-total" *ngIf="cart().length > 0">
            <span>Total:</span>
            <span class="total-price">\${{ totalPrice() }}</span>
          </div>

          <button
            type="button"
            class="submit-btn"
            [disabled]="!canSubmit() || loading()"
            (click)="submit()"
          >
            {{ loading() ? 'Creando...' : 'Crear Orden' }}
          </button>

          <p class="message error" *ngIf="errorMessage()">{{ errorMessage() }}</p>
          <p class="message ok" *ngIf="lastOrderId()">Orden creada: #{{ lastOrderId() }}</p>
        </aside>
      </div>
    </main>
  `,
  styles: [
    `
      .layout {
        min-height: 100dvh;
        padding: 1.5rem 1rem 2rem;
        max-width: 1400px;
        margin: 0 auto;
        display: grid;
        gap: 1.25rem;
      }

      .hero {
        background: linear-gradient(140deg, #0f172a 0%, #1e293b 100%);
        color: #f1f5f9;
        border-radius: 1rem;
        padding: 1.25rem 1.5rem;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.7;
        margin: 0;
        font-size: 0.75rem;
      }

      h1, h2 {
        margin: 0;
      }

      h1 { font-size: 1.5rem; }
      h2 { font-size: 1.1rem; margin-bottom: 1rem; }

      .subtitle {
        margin: 0.5rem 0 0;
        opacity: 0.8;
        font-size: 0.9rem;
      }

      .content-grid {
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: 1.25rem;
        align-items: start;
      }

      @media (max-width: 900px) {
        .content-grid {
          grid-template-columns: 1fr;
        }
      }

      .card {
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 1rem;
        padding: 1.25rem;
      }

      .catalog__header {
        margin-bottom: 1rem;
      }

      .catalog__header p {
        margin: 0.35rem 0 0;
        color: #94a3b8;
        font-size: 0.85rem;
      }

      .grid {
        display: grid;
        gap: 0.9rem;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      }

      .order-panel {
        position: sticky;
        top: 1.25rem;
      }

      .form-group {
        margin-bottom: 1rem;
      }

      .form-group label {
        display: block;
        font-size: 0.85rem;
        font-weight: 500;
        color: #e2e8f0;
        margin-bottom: 0.4rem;
      }

      .input-field {
        width: 100%;
        padding: 0.65rem 0.85rem;
        border: 2px solid #000;
        border-radius: 0.65rem;
        background: #fff;
        font-size: 0.9rem;
        color: #0f172a;
        box-sizing: border-box;
      }

      .input-field:focus {
        outline: none;
        border-color: #0f172a;
        box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.15);
      }

      select.input-field {
        cursor: pointer;
      }

      .cart-items {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1rem;
        max-height: 350px;
        overflow-y: auto;
      }

      .cart-item {
        background: #1e293b;
        border-radius: 0.75rem;
        padding: 0.75rem;
      }

      .cart-item-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
      }

      .cart-item-name {
        font-weight: 500;
        color: #f1f5f9;
      }

      .cart-item-price {
        color: #4ade80;
        font-weight: 600;
      }

      .cart-item-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }

      .qty-btn {
        width: 28px;
        height: 28px;
        border: 1px solid #475569;
        border-radius: 0.4rem;
        background: #334155;
        color: #f1f5f9;
        cursor: pointer;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .qty-btn:hover {
        background: #475569;
      }

      .qty {
        min-width: 24px;
        text-align: center;
        color: #f1f5f9;
        font-weight: 500;
      }

      .remove-btn {
        margin-left: auto;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 0.4rem;
        background: #dc2626;
        color: #fff;
        cursor: pointer;
        font-size: 1.1rem;
      }

      .instructions {
        font-size: 0.8rem;
        padding: 0.4rem 0.6rem;
      }

      .empty-cart {
        text-align: center;
        color: #64748b;
        padding: 2rem 0;
      }

      .order-total {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 0;
        border-top: 1px solid #334155;
        margin-bottom: 1rem;
        font-size: 1.1rem;
        font-weight: 600;
        color: #f1f5f9;
      }

      .total-price {
        color: #4ade80;
        font-size: 1.25rem;
      }

      .submit-btn {
        width: 100%;
        padding: 0.85rem;
        border: none;
        border-radius: 0.75rem;
        background: #0f172a;
        color: #fff;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s;
      }

      .submit-btn:hover:not(:disabled) {
        background: #1e293b;
      }

      .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .message {
        margin-top: 0.75rem;
        font-weight: 500;
        text-align: center;
      }

      .ok { color: #4ade80; }
      .error { color: #f87171; }
    `,
  ],
})
export class OrdersHomePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ordersFacade = inject(OrdersFacade);

  readonly products = signal<ProductCardViewModel[]>([
    {
      id: 1,
      name: 'Salmón al horno',
      description: 'Salmón glaseado con vegetales estacionales y salsa citrica.',
      price: 24,
      stock: 8,
      isActive: true,
      imageUrl:
        'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1200&q=80',
      tags: ['Chef choice', 'Proteina'],
    },
    {
      id: 2,
      name: 'Ravioli de ricotta',
      description: 'Pasta fresca artesanal con mantequilla de salvia y nuez tostada.',
      price: 18,
      stock: 3,
      isActive: true,
      imageUrl:
        'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80',
      tags: ['Pasta', 'Top ventas'],
    },
    {
      id: 3,
      name: 'Limonada de la casa',
      description: 'Bebida fresca con menta, lima y toque de jengibre.',
      price: 7,
      stock: 0,
      isActive: true,
      imageUrl:
        'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=80',
      tags: ['Bebidas'],
    },
    {
      id: 4,
      name: 'Ensalada César',
      description: 'Lechuga romana, crutones, parmesan y aderezo César.',
      price: 12,
      stock: 10,
      isActive: true,
      imageUrl:
        'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&w=1200&q=80',
      tags: ['Ensaladas'],
    },
    {
      id: 5,
      name: 'Ribeye steak',
      description: 'Corte de res premium a la parrilla con hierbas.',
      price: 32,
      stock: 5,
      isActive: true,
      imageUrl:
        'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80',
      tags: ['Carnes', 'Top ventas'],
    },
    {
      id: 6,
      name: 'Tiramisú',
      description: 'Postre italiano clásico con café y mascarpone.',
      price: 9,
      stock: 4,
      isActive: true,
      imageUrl:
        'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=1200&q=80',
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

  readonly totalPrice = computed(() =>
    this.cart().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  readonly canSubmit = computed(() =>
    this.selectedTableId() !== null && this.cart().length > 0
  );

  readonly form = this.fb.nonNullable.group({
    tableId: [null as number | null, Validators.required],
  });

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

  incrementQty(index: number): void {
    this.cart.update(items =>
      items.map((item, i) =>
        i === index ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  decrementQty(index: number): void {
    const item = this.cart()[index];
    if (item.quantity <= 1) {
      this.removeFromCart(index);
    } else {
      this.cart.update(items =>
        items.map((item, i) =>
          i === index ? { ...item, quantity: item.quantity - 1 } : item
        )
      );
    }
  }

  removeFromCart(index: number): void {
    this.cart.update(items => items.filter((_, i) => i !== index));
  }

  updateInstructions(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cart.update(items =>
      items.map((item, i) =>
        i === index ? { ...item, instructions: value } : item
      )
    );
  }

  trackByProductId(index: number, item: CartItem): number {
    return item.productId;
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
