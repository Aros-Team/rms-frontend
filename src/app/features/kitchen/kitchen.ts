import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { OrderService, OrderStatus } from '@app/core/services/orders/order-service';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';

@Component({
  selector: 'app-kitchen',
  imports: [CommonModule, RouterModule],
  templateUrl: './kitchen.html',
  styles: ``
})
export class Kitchen implements OnInit {
  private orderService: OrderService = inject(OrderService);
  title = 'Cocina';
  description = 'Gestión de las operaciones de cocina y preparación de pedidos';

  loading = false;
  error: string | null = null;
  pendingOrders: OrderResponse[] = [];
  processing = new Set<number>();

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(): void {
    this.loading = true;
    this.error = null;

    this.orderService.getOrdersByStatus('QUEUE').subscribe({
      next: (orders: OrderResponse[]) => {
        this.pendingOrders = orders || [];
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los pedidos de cocina.';
        this.loading = false;
      }
    });
  }

  completeOrder(orderId: number): void {
    if (!orderId || this.processing.has(orderId)) return;
    this.error = null;
    this.processing.add(orderId);
    this.orderService.markOrderAsPreparing().subscribe({
      next: () => {
        this.pendingOrders = this.pendingOrders.filter((o: OrderResponse) => o.id !== orderId);
      },
      error: () => {
        this.error = 'No se pudo marcar el pedido como completado.';
      },
      complete: () => {
        this.processing.delete(orderId);
      }
    });
  }

  getOrderTotal(order: OrderResponse): number {
    if (!order.details) return 0;
    return order.details.reduce((sum, d) => sum + (d.unitPrice || 0), 0);
  }
}
