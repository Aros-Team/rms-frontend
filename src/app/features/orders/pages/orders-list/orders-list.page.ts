import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdersFacade } from '../../application/orders.facade';
import { OrderResponse } from '../../../../shared/models/dto/orders/order-response.model';
import { RmsPageHeaderComponent } from '../../../../shared/ui/page-header/rms-page-header.component';
import { RmsSelectComponent } from '../../../../shared/ui/select/rms-select.component';
import { RmsButtonComponent } from '../../../../shared/ui/button/rms-button.component';
import { RmsBadgeComponent } from '../../../../shared/ui/badge/rms-badge.component';
import { RmsCardComponent } from '../../../../shared/ui/card/rms-card.component';
import { RmsEmptyStateComponent } from '../../../../shared/ui/empty-state/rms-empty-state.component';

@Component({
  selector: 'app-orders-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RmsPageHeaderComponent,
    RmsSelectComponent,
    RmsButtonComponent,
    RmsBadgeComponent,
    RmsCardComponent,
    RmsEmptyStateComponent,
  ],
  templateUrl: './orders-list.page.html',
  styleUrl: './orders-list.page.css',
})
export class OrdersListPageComponent implements OnInit {
  private readonly ordersFacade = inject(OrdersFacade);

  readonly orders = signal<OrderResponse[]>([]);
  readonly loading = signal(false);
  selectedStatus: string | null = null;

  readonly statusOptions = [
    { label: 'Todos', value: null as string | null },
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

  onStatusChange(value: string | null): void {
    this.selectedStatus = value;
    this.loadOrders();
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
