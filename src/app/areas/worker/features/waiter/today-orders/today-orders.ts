import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { Subscription } from 'rxjs';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';

import { Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OptionNamesPipe } from '@app/shared/pipes/option-names.pipe';

import { TodayOrdersSkeleton } from './skeletons/today-orders-skeleton';

@Component({
  selector: 'app-today-orders',
  templateUrl: './today-orders.html',
  styleUrl: './today-orders.css',
  imports: [RouterModule, FormsModule, OptionNamesPipe, TodayOrdersSkeleton, DatePickerModule, SelectModule, ButtonModule],
})
export class TodayOrders implements OnInit {
  private orderService = inject(Order);
  private log = inject(Logging);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  refreshing = signal(false);
  error = signal<string | null>(null);
  orders = signal<OrderResponse[]>([]);
  processing = new Set<number>();

  selectedStatus = '';
  selectedDate: Date;

  statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'En Cola', value: 'QUEUE' },
    { label: 'Preparando', value: 'PREPARING' },
    { label: 'Lista', value: 'READY' },
    { label: 'Entregada', value: 'DELIVERED' },
    { label: 'Cancelada', value: 'CANCELLED' }
  ];

  private subscription?: Subscription;
  private loadSeq = 0;
  private pollingInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.selectedDate = new Date();
    this.startPolling();
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(() => {
      this.log.debug('TodayOrders: polling for updates');
      this.fetchOrders(true);
    }, 30000);
    this.destroyRef.onDestroy(() => {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }
    });
  }

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(silent = false): void {
    const seq = ++this.loadSeq;
    if (silent) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set(null);

    const startDate = new Date(this.selectedDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(this.selectedDate);
    endDate.setHours(23, 59, 59, 999);
    const status = this.selectedStatus || undefined;

    this.subscription?.unsubscribe();
    this.subscription = this.orderService.getOrdersByDateRange(startDate, endDate, status).subscribe({
      next: (data) => {
        if (seq !== this.loadSeq) return;
        this.log.debug('TodayOrders: loaded', data);
        this.orders.set(data);
        this.loading.set(false);
        this.refreshing.set(false);
      },
      error: (err) => {
        if (seq !== this.loadSeq) return;
        this.log.error('TodayOrders: error', err);
        this.error.set('No se pudieron cargar las órdenes.');
        this.loading.set(false);
        this.refreshing.set(false);
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
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : null;
        this.error.set(message ?? 'No se pudo cancelar la orden.');
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
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : null;
        this.error.set(message ?? 'No se pudo entregar la orden.');
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
