import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RmsPageHeaderComponent } from '../../../../shared/ui/page-header/rms-page-header.component';
import { RmsCardComponent } from '../../../../shared/ui/card/rms-card.component';
import { RmsBadgeComponent } from '../../../../shared/ui/badge/rms-badge.component';
import { RmsButtonComponent } from '../../../../shared/ui/button/rms-button.component';
import { RmsEmptyStateComponent } from '../../../../shared/ui/empty-state/rms-empty-state.component';
import { OrdersFacade } from '../../../orders/application/orders.facade';
import { OrderResponse } from '../../../../shared/models/dto/orders/order-response.model';
import { OrdersEventsService } from '../../../../shared/services/orders-events.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-kitchen-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RmsPageHeaderComponent,
    RmsCardComponent,
    RmsBadgeComponent,
    RmsButtonComponent,
    RmsEmptyStateComponent,
  ],
  templateUrl: './kitchen-dashboard.page.html',
  styleUrl: './kitchen-dashboard.page.css',
})
export class KitchenDashboardPageComponent implements OnInit, OnDestroy {
  private readonly ordersFacade = inject(OrdersFacade);
  private readonly ordersEvents = inject(OrdersEventsService);

  readonly queue = signal<OrderResponse[]>([]);
  readonly preparing = signal<OrderResponse[]>([]);
  readonly loading = signal(false);
  private subs = new Subscription();

  ngOnInit(): void {
    this.refreshLists();
    this.subs.add(
      this.ordersEvents.orderCreated$.subscribe(() => {
        // Al crear una orden, refrescar la cola inmediatamente
        this.loadQueue();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  refreshLists(): void {
    this.loadQueue();
    this.loadPreparing();
  }

  loadQueue(): void {
    this.ordersFacade.getOrders({ status: 'QUEUE' }).subscribe({
      next: (orders) => this.queue.set(orders),
      error: () => this.queue.set([]),
    });
  }

  loadPreparing(): void {
    this.ordersFacade.getOrders({ status: 'PREPARING' }).subscribe({
      next: (orders) => this.preparing.set(orders),
      error: () => this.preparing.set([]),
    });
  }

  prepareNext(): void {
    if (this.loading() || this.queue().length === 0) {
      // Si la UI cree que no hay cola, sincronizamos con backend
      if (this.queue().length === 0) this.loadQueue();
      return;
    }

    this.loading.set(true);
    this.ordersFacade.prepareNextOrder().subscribe({
      next: () => {
        this.loading.set(false);
        this.refreshLists();
      },
      error: (err) => {
        this.loading.set(false);
        // Refrescar desde backend para evitar estados desfasados
        this.loadQueue();
        if (err?.status === 409) {
          alert('No hay órdenes en cola para preparar (409). Se actualizó la cola.');
        } else {
          alert('No se pudo tomar la siguiente orden. Intenta nuevamente.');
        }
      },
    });
  }

  markReady(orderId: number): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.ordersFacade.markOrderReady(orderId).subscribe({
      next: () => {
        this.loading.set(false);
        this.refreshLists();
      },
      error: (err) => {
        this.loading.set(false);
        // Refrescar la sección de "En Preparación" para evitar inconsistencias
        this.loadPreparing();
        if (err?.status === 409) {
          alert('La orden no está en estado PREPARING (409). Se actualizó la lista.');
        } else if (err?.status === 404) {
          alert('Orden no encontrada (404). Se actualizó la lista.');
        } else {
          alert('No se pudo marcar la orden como lista.');
        }
      },
    });
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
      QUEUE: 'warning',
      PREPARING: 'info',
      READY: 'success',
      DELIVERED: 'success',
      CANCELLED: 'danger',
    };
    return map[status] || 'info';
  }
}
