import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';

interface KitchenOrder {
  id: number;
  tableNumber: number;
  items: { name: string; quantity: number }[];
  status: 'pending' | 'preparing' | 'ready';
  createdAt: Date;
}

@Component({
  selector: 'app-kitchen-dashboard-page',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  template: `
    <main class="kitchen-container">
      <header class="kitchen-header">
        <h1>Cocina</h1>
        <span class="order-count">{{ pendingOrders().length }} pedidos pendientes</span>
      </header>

      <section class="orders-grid">
        @for (order of pendingOrders(); track order.id) {
          <div class="order-card" [class.preparing]="order.status === 'preparing'" [class.ready]="order.status === 'ready'">
            <div class="order-header">
              <span class="table-badge">Mesa {{ order.tableNumber }}</span>
              <span class="order-time">{{ getTimeAgo(order.createdAt) }}</span>
            </div>
            
            <ul class="order-items">
              @for (item of order.items; track item.name) {
                <li>
                  <span class="item-qty">{{ item.quantity }}x</span>
                  <span class="item-name">{{ item.name }}</span>
                </li>
              }
            </ul>

            <div class="order-actions">
              @if (order.status === 'pending') {
                <button pButton class="p-button-warning" (click)="startPreparing(order.id)">
                  Iniciar
                </button>
              }
              @if (order.status === 'preparing') {
                <button pButton class="p-button-success" (click)="markReady(order.id)">
                  Listo
                </button>
              }
            </div>
          </div>
        } @empty {
          <div class="empty-state">
            <i class="pi pi-check-circle"></i>
            <p>No hay pedidos pendientes</p>
          </div>
        }
      </section>
    </main>
  `,
  styles: [`
    .kitchen-container {
      min-height: 100dvh;
      padding: 1rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .kitchen-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--p-surface-700);
    }

    .kitchen-header h1 {
      margin: 0;
      font-size: 1.5rem;
      color: var(--p-surface-100);
    }

    .order-count {
      background: var(--p-warning-500);
      color: var(--p-warning-contrast-color);
      padding: 0.35rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .orders-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .order-card {
      background: var(--p-surface-800);
      border: 1px solid var(--p-surface-700);
      border-radius: 1rem;
      padding: 1rem;
    }

    .order-card.preparing {
      border-color: var(--p-warning-500);
    }

    .order-card.ready {
      border-color: var(--p-success-500);
      opacity: 0.7;
    }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .table-badge {
      background: var(--p-primary-500);
      color: var(--p-primary-contrast-color);
      padding: 0.35rem 0.75rem;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .order-time {
      color: var(--p-surface-400);
      font-size: 0.85rem;
    }

    .order-items {
      list-style: none;
      padding: 0;
      margin: 0 0 1rem 0;
    }

    .order-items li {
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--p-surface-700);
      color: var(--p-surface-200);
    }

    .order-items li:last-child {
      border-bottom: none;
    }

    .item-qty {
      font-weight: 700;
      color: var(--p-primary-400);
      min-width: 30px;
    }

    .item-name {
      font-weight: 500;
    }

    .order-actions {
      display: flex;
      gap: 0.5rem;
    }

    .order-actions button {
      flex: 1;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--p-surface-400);
    }

    .empty-state i {
      font-size: 4rem;
      color: var(--p-success-500);
      margin-bottom: 1rem;
    }

    .empty-state p {
      font-size: 1.1rem;
      margin: 0;
    }
  `]
})
export class KitchenDashboardPageComponent {
  readonly pendingOrders = signal<KitchenOrder[]>([
    {
      id: 1,
      tableNumber: 3,
      items: [
        { name: 'Hamburguesa Clásica', quantity: 2 },
        { name: 'Papas Fritas', quantity: 1 },
        { name: 'Refresco', quantity: 2 }
      ],
      status: 'pending',
      createdAt: new Date(Date.now() - 5 * 60000)
    },
    {
      id: 2,
      tableNumber: 5,
      items: [
        { name: 'Ensalada César', quantity: 1 },
        { name: 'Sopa del día', quantity: 1 }
      ],
      status: 'preparing',
      createdAt: new Date(Date.now() - 12 * 60000)
    },
    {
      id: 3,
      tableNumber: 1,
      items: [
        { name: 'Ribeye Steak', quantity: 1 },
        { name: 'Vino Tinto', quantity: 1 }
      ],
      status: 'pending',
      createdAt: new Date(Date.now() - 3 * 60000)
    }
  ]);

  startPreparing(orderId: number): void {
    this.pendingOrders.update(orders =>
      orders.map(o => o.id === orderId ? { ...o, status: 'preparing' as const } : o)
    );
  }

  markReady(orderId: number): void {
    this.pendingOrders.update(orders =>
      orders.map(o => o.id === orderId ? { ...o, status: 'ready' as const } : o)
    );
  }

  getTimeAgo(date: Date): string {
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
}
