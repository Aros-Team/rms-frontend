import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { OrdersFacade } from '../../application/orders.facade';
import { OrderResponse } from '../../../../shared/models/dto/orders/order-response.model';

@Component({
  selector: 'app-orders-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule],
  template: `
    <main class="page-container">
      <header class="page-header">
        <div>
          <h1>Pedidos</h1>
          <p>Historial y estado de todos los pedidos</p>
        </div>
      </header>

      <section class="filters">
        <div class="filter-group">
          <label>Estado</label>
          <select [(ngModel)]="selectedStatus" (change)="loadOrders()" class="filter-select">
            @for (opt of statusOptions; track opt.value) {
              <option [ngValue]="opt.value">
                {{ opt.label }}
              </option>
            }
          </select>
        </div>
        <button
          pButton
          label="Preparar Siguiente"
          icon="pi pi-forward"
          (click)="prepareNextOrder()"
          class="prepare-btn"
        ></button>
        <button pButton label="Actualizar" icon="pi pi-refresh" (click)="loadOrders()" class="refresh-btn"></button>
      </section>

      @if (!loading()) {
        <section class="orders-list">
          @for (order of orders(); track order.id) {
            <div class="order-card">
              <div class="order-header">
                <div class="order-id">Orden #{{ order.id }}</div>
                <span class="status-badge" [class]="getStatusClass(order.status)">
                  {{ getStatusLabel(order.status) }}
                </span>
              </div>
              
              <div class="order-info">
                <div class="info-row">
                  <i class="pi pi-calendar"></i>
                  <span>{{ order.date | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
                <div class="info-row">
                  <i class="pi pi-th-large"></i>
                  <span>Mesa {{ order.tableId }}</span>
                </div>
              </div>

              <div class="order-items">
                @for (item of order.details; track item.productName) {
                  <div class="item">
                    <span class="item-name">{{ item.productName }}</span>
                    <span class="item-price">\${{ item.unitPrice }}</span>
                  </div>
                }
              </div>

              <div class="order-actions">
                @if (order.status === 'QUEUE') {
                  <button 
                    pButton 
                    label="Cancelar" 
                    icon="pi pi-times"
                    class="cancel-btn"
                    (click)="cancelOrder(order.id)"
                  ></button>
                }
                @if (order.status === 'PREPARING') {
                  <button 
                    pButton 
                    label="Marcar Lista" 
                    icon="pi pi-check"
                    class="ready-btn"
                    (click)="markReady(order.id)"
                  ></button>
                }
                @if (order.status === 'READY') {
                  <button 
                    pButton 
                    label="Entregar" 
                    icon="pi pi-check-circle"
                    class="deliver-btn"
                    (click)="deliverOrder(order.id)"
                  ></button>
                }
              </div>
            </div>
          } @empty {
            <p class="empty-state">
              No se encontraron pedidos
            </p>
          }
        </section>
      } @else {
        <div class="loading-state">
          <i class="pi pi-spin pi-spinner"></i>
          <span>Cargando pedidos...</span>
        </div>
      }
    </main>
  `,
  styles: [
    `
      .page-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .page-header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--p-surface-100);
        margin: 0;
      }

      .page-header p {
        color: var(--p-surface-500);
        font-size: 0.875rem;
        margin: 0.25rem 0 0;
      }

      .filters {
        display: flex;
        align-items: flex-end;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }

      .filter-group label {
        font-size: 0.8rem;
        color: var(--p-surface-400);
      }

      .filter-select {
        min-width: 180px;
        padding: 0.5rem 0.75rem;
        background: var(--p-surface-800);
        border: 1px solid var(--p-surface-700);
        border-radius: 0.65rem;
        color: var(--p-surface-100);
        font-size: 0.9rem;
        cursor: pointer;
      }

      .filter-select:focus {
        outline: none;
        border-color: var(--p-surface-600);
      }

      .filter-select option {
        background: var(--p-surface-800);
        color: var(--p-surface-100);
      }

      .refresh-btn {
        background: var(--p-surface-800);
        border: 1px solid var(--p-surface-700);
        color: var(--p-surface-100);
      }

      .prepare-btn {
        background: var(--p-primary-500);
        border: none;
        color: var(--p-primary-contrast-color);
      }

      .prepare-btn:hover {
        background: var(--p-primary-600);
      }

      .refresh-btn:hover {
        background: var(--p-surface-700);
      }

      .orders-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .order-card {
        background: var(--p-surface-800);
        border: 1px solid var(--p-surface-700);
        border-radius: 1rem;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .order-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .order-id {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--p-surface-100);
      }

      .status-badge {
        padding: 0.35rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
      }

      .status-badge.queue {
        background: var(--p-warning-100);
        color: var(--p-warning-700);
      }

      .status-badge.preparing {
        background: var(--p-info-100);
        color: var(--p-info-700);
      }

      .status-badge.ready {
        background: var(--p-success-100);
        color: var(--p-success-700);
      }

      .status-badge.delivered {
        background: var(--p-success-100);
        color: var(--p-success-700);
      }

      .status-badge.cancelled {
        background: var(--p-danger-100);
        color: var(--p-danger-700);
      }

      .order-info {
        display: flex;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .info-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--p-surface-400);
        font-size: 0.9rem;
      }

      .info-row i {
        font-size: 0.9rem;
      }

      .order-items {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem 0;
        border-top: 1px solid var(--p-surface-700);
        border-bottom: 1px solid var(--p-surface-700);
      }

      .item {
        display: flex;
        justify-content: space-between;
        color: var(--p-surface-200);
        font-size: 0.9rem;
      }

      .item-price {
        color: var(--p-success-500);
        font-weight: 500;
      }

      .order-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .order-actions button {
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        border-radius: 0.5rem;
      }

      .cancel-btn {
        background: var(--p-danger-500);
        border: none;
      }

      .cancel-btn:hover {
        background: var(--p-danger-600);
      }

      .ready-btn {
        background: var(--p-primary-500);
        border: none;
      }

      .ready-btn:hover {
        background: var(--p-primary-600);
      }

      .deliver-btn {
        background: var(--p-success-500);
        border: none;
      }

      .deliver-btn:hover {
        background: var(--p-success-600);
      }

      .empty-state {
        text-align: center;
        color: var(--p-surface-500);
        padding: 3rem;
      }

      .loading-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        color: var(--p-surface-500);
        padding: 3rem;
      }

      .loading-state i {
        font-size: 1.5rem;
      }
    `,
  ],
})
export class OrdersListPageComponent implements OnInit {
  private readonly ordersFacade = inject(OrdersFacade);

  readonly orders = signal<OrderResponse[]>([]);
  readonly loading = signal(false);
  selectedStatus: string | null = null;

  readonly statusOptions = [
    { label: 'Todos', value: null },
    { label: 'En Cola', value: 'QUEUE' },
    { label: 'En Preparacion', value: 'PREPARING' },
    { label: 'Lista', value: 'READY' },
    { label: 'Entregada', value: 'DELIVERED' },
    { label: 'Cancelada', value: 'CANCELLED' },
  ];

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading.set(true);
    const status = this.selectedStatus;
    
    this.ordersFacade.getOrders(status ? { status } : undefined).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.orders.set([]);
        this.loading.set(false);
      },
    });
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      QUEUE: 'queue',
      PREPARING: 'preparing',
      READY: 'ready',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled',
    };
    return statusMap[status] || '';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      QUEUE: 'En Cola',
      PREPARING: 'Preparando',
      READY: 'Lista',
      DELIVERED: 'Entregada',
      CANCELLED: 'Cancelada',
    };
    return labels[status] || status;
  }

  cancelOrder(id: number): void {
    if (!confirm('Cancelar esta orden?')) return;
    
    this.ordersFacade.cancelOrder(id).subscribe({
      next: () => this.loadOrders(),
      error: () => alert('Error al cancelar orden'),
    });
  }

  markReady(id: number): void {
    this.ordersFacade.markOrderReady(id).subscribe({
      next: () => this.loadOrders(),
      error: () => alert('Error al marcar orden'),
    });
  }

  deliverOrder(id: number): void {
    this.ordersFacade.deliverOrder(id).subscribe({
      next: () => this.loadOrders(),
      error: () => alert('Error al entregar orden'),
    });
  }

  prepareNextOrder(): void {
    this.ordersFacade.prepareNextOrder().subscribe({
      next: () => this.loadOrders(),
      error: () => alert('No hay ordenes en cola para preparar'),
    });
  }
}
