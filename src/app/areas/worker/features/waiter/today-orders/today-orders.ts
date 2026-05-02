import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OptionNamesPipe } from '@app/shared/pipes/option-names.pipe';

@Component({
  selector: 'app-today-orders',
  templateUrl: './today-orders.html',
  imports: [RouterModule, FormsModule, OptionNamesPipe],
})
export class TodayOrders implements OnInit {
  private orderService = inject(Order);
  private log = inject(Logging);

  loading = signal(false);
  error = signal<string | null>(null);
  orders = signal<OrderResponse[]>([]);
  processing = new Set<number>();

  selectedStatus = '';
  selectedDate: string = new Date().toISOString().split('T')[0];

  statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'En Cola', value: 'QUEUE' },
    { label: 'Preparando', value: 'PREPARING' },
    { label: 'Lista', value: 'READY' },
    { label: 'Entregada', value: 'DELIVERED' },
    { label: 'Cancelada', value: 'CANCELLED' }
  ];

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(): void {
    if (!this.selectedDate || this.selectedDate.trim() === '') {
      this.selectedDate = new Date().toISOString().split('T')[0];
    }

    this.loading.set(true);
    this.error.set(null);

    const startDate = new Date(this.selectedDate + 'T00:00:00');
    const endDate = new Date(this.selectedDate + 'T23:59:59');
    const status = this.selectedStatus || undefined;

    this.orderService.getOrdersByDateRange(startDate, endDate, status).subscribe({
      next: (data) => {
        this.log.debug('TodayOrders: loaded', data);
        this.orders.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.log.error('TodayOrders: error', err);
        this.error.set('No se pudieron cargar las órdenes.');
        this.loading.set(false);
      }
    });
  }

  onFilterChange(): void {
    this.fetchOrders();
  }

  cancelOrder(order: OrderResponse): void {
    if (this.processing.has(order.id)) return;
    this.processing.add(order.id);

    this.orderService.cancelOrder(order.id).subscribe({
      next: (updated) => {
        this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
        this.processing.delete(order.id);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo cancelar la orden.');
        this.processing.delete(order.id);
      }
    });
  }

  deliverOrder(order: OrderResponse): void {
    if (this.processing.has(order.id)) return;
    this.processing.add(order.id);

    this.orderService.deliverOrder(order.id).subscribe({
      next: (updated) => {
        this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
        this.processing.delete(order.id);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo entregar la orden.');
        this.processing.delete(order.id);
      }
    });
  }

  isProcessing(id: number): boolean {
    return this.processing.has(id);
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      QUEUE: 'En Cola',
      PREPARING: 'Preparando',
      READY: 'Lista',
      DELIVERED: 'Entregada',
      CANCELLED: 'Cancelada',
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      QUEUE:     'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
      PREPARING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      READY:     'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      DELIVERED: 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400',
      CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    };
    return map[status] ?? 'bg-surface-100 text-surface-600';
  }

  orderTime(date: string): string {
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  get activeCount(): number {
    return this.orders().filter(o => !['DELIVERED','CANCELLED'].includes(o.status)).length;
  }

  get deliveredCount(): number {
    return this.orders().filter(o => o.status === 'DELIVERED').length;
  }
}
