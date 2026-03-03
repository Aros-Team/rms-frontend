import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { OrdersFacade } from '../../application/orders.facade';
import { ProductCardComponent } from '../../../../shared/ui/product-card/product-card.component';
import { ProductCardSkeletonComponent } from '../../../../shared/ui/product-card/product-card-skeleton.component';
import { ProductCardViewModel } from '../../../../shared/ui/product-card/product-card.model';

@Component({
  selector: 'app-orders-home-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ProductCardComponent, ProductCardSkeletonComponent],
  template: `
    <main class="layout">
      <section class="hero">
        <p class="eyebrow">Restaurant Management System</p>
        <h1>Catalogo moderno para tomar ordenes</h1>
        <p class="subtitle">
          Tarjeta de producto reutilizable, accesible y conectada a la capa de casos de uso.
        </p>
      </section>

      <section class="card">
        <h2>Contexto de la orden</h2>
        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <label>
            <span>Order ID</span>
            <input type="number" formControlName="orderId" />
          </label>

          <label>
            <span>Cantidad</span>
            <input type="number" formControlName="quantity" />
          </label>

          <label>
            <span>Nota</span>
            <input type="text" formControlName="note" placeholder="sin cebolla" />
          </label>

          <button type="submit" [disabled]="form.invalid || loading()">
            {{ loading() ? 'Enviando...' : 'Enviar producto seleccionado' }}
          </button>
        </form>

        <p class="message info" *ngIf="selectedProductName()">
          Producto elegido: {{ selectedProductName() }}
        </p>
        <p class="message ok" *ngIf="lastResult()">Orden actualizada: #{{ lastResult() }}</p>
        <p class="message error" *ngIf="errorMessage()">{{ errorMessage() }}</p>
      </section>

      <section class="catalog">
        <header class="catalog__header">
          <h2>Productos destacados</h2>
          <p>
            Accion principal: agregar directamente desde la tarjeta. Accion secundaria: ver detalle.
          </p>
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
              (add)="addFromCard($event.productId)"
              (details)="showDetails($event.productId)"
            ></app-product-card>
          </div>
        </ng-template>
      </section>

      <section class="card architecture">
        <h2>Capas activas</h2>
        <ul>
          <li>Feature: pagina + facade + componente UI reusable</li>
          <li>Application: caso de uso (input port)</li>
          <li>Domain: entidades tipadas (Order, Product, OrderItem)</li>
          <li>Infrastructure: adaptador HTTP (output port)</li>
        </ul>
      </section>
    </main>
  `,
  styles: [
    `
      .layout {
        min-height: 100dvh;
        padding: 2rem 1rem 3rem;
        max-width: 1100px;
        margin: 0 auto;
        display: grid;
        gap: 1rem;
      }

      .hero {
        background: linear-gradient(140deg, #06213a 0%, #154e75 100%);
        color: #ecf7ff;
        border-radius: 1rem;
        padding: 1.5rem;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        opacity: 0.8;
        margin: 0;
      }

      h1,
      h2 {
        margin: 0;
      }

      .subtitle {
        margin: 0.75rem 0 0;
      }

      .card {
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid #d2e4f3;
        border-radius: 1rem;
        padding: 1rem;
      }

      .catalog {
        background: rgba(255, 255, 255, 0.55);
        border: 1px solid #cfe0ef;
        border-radius: 1rem;
        padding: 1rem;
      }

      .catalog__header {
        margin-bottom: 0.9rem;
      }

      .catalog__header p {
        margin: 0.35rem 0 0;
        color: #2b556f;
      }

      .grid {
        display: grid;
        gap: 0.9rem;
        grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 0.75rem;
        margin-top: 1rem;
      }

      label {
        display: grid;
        gap: 0.4rem;
        font-size: 0.92rem;
      }

      input {
        border: 1px solid #b8d1e5;
        border-radius: 0.65rem;
        padding: 0.55rem 0.7rem;
      }

      button {
        border: 0;
        border-radius: 0.7rem;
        background: #0f4f78;
        color: #fff;
        padding: 0.7rem;
        cursor: pointer;
        align-self: end;
      }

      button:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .message {
        margin-top: 0.8rem;
        font-weight: 600;
      }

      .ok {
        color: #04652f;
      }

      .info {
        color: #0d4f78;
      }

      .error {
        color: #a91313;
      }

      ul {
        margin: 0.75rem 0 0;
        padding-left: 1.1rem;
      }
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
  ]);

  readonly loading = signal(false);
  readonly catalogLoading = signal(true);
  readonly errorMessage = signal('');
  readonly selectedProductName = signal('');
  readonly lastOrderId = signal<number | null>(null);
  readonly lastResult = computed(() => this.lastOrderId());

  readonly form = this.fb.nonNullable.group({
    orderId: [1, [Validators.required, Validators.min(1)]],
    productId: [1, [Validators.required, Validators.min(1)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    note: [''],
  });

  constructor() {
    window.setTimeout(() => this.catalogLoading.set(false), 650);
  }

  addFromCard(productId: number): void {
    const product = this.products().find((item) => item.id === productId);

    if (!product) {
      return;
    }

    this.form.patchValue({ productId, quantity: 1 });
    this.selectedProductName.set(product.name);
    this.submit();
  }

  showDetails(productId: number): void {
    const product = this.products().find((item) => item.id === productId);

    if (!product) {
      return;
    }

    this.selectedProductName.set(product.name);
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.ordersFacade
      .addProduct(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (order) => {
          this.lastOrderId.set(order.id);
        },
        error: (err) => {
          const backendMessage = err?.error?.message || err?.message;
          this.errorMessage.set(backendMessage || 'No se pudo procesar la solicitud.');
        },
      });
  }
}
