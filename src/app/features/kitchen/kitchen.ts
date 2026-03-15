import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { OrderService } from '@app/core/services/orders/order-service';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OptionNamesPipe } from '@app/shared/pipes/option-names.pipe';

@Component({
  selector: 'app-kitchen',
  imports: [CommonModule, RouterModule, OptionNamesPipe],
  templateUrl: './kitchen.html',
})
export class Kitchen implements OnInit, OnDestroy {
  private orderService = inject(OrderService);

  loading = signal(true);
  error = signal<string | null>(null);

  queueOrders    = signal<OrderResponse[]>([]);
  preparingOrders = signal<OrderResponse[]>([]);
  readyOrders    = signal<OrderResponse[]>([]);

  processing = new Set<number>();
  preparingNext = signal(false);

  private refreshSub?: Subscription;
  private readonly REFRESH_MS = 30_000;

  ngOnInit(): void {
    this.fetchAll();
    // Auto-refresh cada 30s
    this.refreshSub = interval(this.REFRESH_MS).pipe(
      switchMap(() => this.orderService.getOrdersByStatus('QUEUE'))
    ).subscribe({
      next: () => this.fetchAll()
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  fetchAll(): void {
    this.loading.set(true);
    this.error.set(null);

    let done = 0;
    const check = () => { if (++done === 3) this.loading.set(false); };

    this.orderService.getOrdersByStatus('QUEUE').subscribe({
      next: v => { this.queueOrders.set(v); check(); },
      error: () => { this.error.set('Error cargando cola.'); check(); }
    });

    this.orderService.getOrdersByStatus('PREPARING').subscribe({
      next: v => { this.preparingOrders.set(v); check(); },
      error: () => { this.error.set('Error cargando preparación.'); check(); }
    });

    this.orderService.getOrdersByStatus('READY').subscribe({
      next: v => { this.readyOrders.set(v); check(); },
      error: () => { this.error.set('Error cargando listas.'); check(); }
    });
  }

  /** Toma la orden más antigua de la cola → PREPARING */
  prepareNext(): void {
    if (this.preparingNext()) return;
    this.preparingNext.set(true);
    this.error.set(null);

    this.orderService.prepareNext().subscribe({
      next: (order) => {
        this.queueOrders.update(list => list.filter(o => o.id !== order.id));
        this.preparingOrders.update(list => [...list, order]);
        this.preparingNext.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message || 'No hay órdenes en cola.';
        this.error.set(msg);
        this.preparingNext.set(false);
      }
    });
  }

  /** PREPARING → READY */
  markReady(order: OrderResponse): void {
    if (this.processing.has(order.id)) return;
    this.processing.add(order.id);
    this.error.set(null);

    this.orderService.markAsReady(order.id).subscribe({
      next: (updated) => {
        this.preparingOrders.update(list => list.filter(o => o.id !== updated.id));
        this.readyOrders.update(list => [...list, updated]);
        this.processing.delete(order.id);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo marcar como lista.');
        this.processing.delete(order.id);
      }
    });
  }

  /** READY → DELIVERED */
  deliver(order: OrderResponse): void {
    if (this.processing.has(order.id)) return;
    this.processing.add(order.id);
    this.error.set(null);

    this.orderService.deliverOrder(order.id).subscribe({
      next: (updated) => {
        this.readyOrders.update(list => list.filter(o => o.id !== updated.id));
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

  orderTime(date: string): string {
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  totalItems(order: OrderResponse): number {
    return order.details?.length ?? 0;
  }
}
