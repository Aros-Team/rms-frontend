import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { OrderService, OrderStatus } from '@app/core/services/orders/order-service';
import { OrderResponse } from '@models/dto/orders/order-response.model';
import { SharedDatepickerComponent } from '@app/shared/components/datepicker/datepicker.component';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-orders-table',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    SharedDatepickerComponent,
    SelectModule,
    FormsModule,
    ButtonModule,
    InputTextModule
  ],
  templateUrl: './orders-table.html',
})
export class OrdersTable implements OnInit {

  orders: OrderResponse[] = [];
  private allOrders: OrderResponse[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  comboStatusOptions = [
    { label: 'Todos', value: 'ALL' },
    { label: 'En Cola', value: 'QUEUE' },
    { label: 'En Preparación', value: 'PREPARING' },
    { label: 'Listo', value: 'READY' },
    { label: 'Entregado', value: 'DELIVERED' },
    { label: 'Cancelado', value: 'CANCELLED' }
  ];

  selectedStatus = 'ALL';
  selectedDate: Date | null = null;

  private modifiedOrders = new Map<number, Partial<OrderResponse>>();
  private originalOrders = new Map<number, OrderResponse>();

  private orderService = inject(OrderService);
  private messageService = inject(MessageService);

  ngOnInit(): void {
    this.fetchOrders();
  }

  onStatusChange(value: string): void {
    this.selectedStatus = value;
    this.fetchOrders();
  }

  onDateChange(date: Date | null): void {
    this.selectedDate = date;
    this.applyFilters();
  }

  private fetchOrders(): void {
    this.loading = true;
    this.error = null;

    let status: OrderStatus | undefined;
    if (this.selectedStatus && this.selectedStatus !== 'ALL') {
      status = this.selectedStatus as OrderStatus;
    }

    this.orderService.getOrders({ status }).subscribe({
      next: (res: OrderResponse[]) => {
        this.allOrders = res;
        this.originalOrders.clear();
        res.forEach(order => {
          this.originalOrders.set(order.id, { ...order });
        });
        this.modifiedOrders.clear();
        this.applyFilters();
        this.loading = false;
      },
      error: (err: unknown) => {
        console.error(err);
        this.error = 'No se pudieron cargar los pedidos.';
        this.loading = false;
      },
    });
  }

  formatDate(date: string | Date): string {
    if (!date) return '-';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(dateObj);
  }

  getStatusLabel(status: string): string {
    const option = this.comboStatusOptions.find(o => o.value === status);
    return option ? option.label : status;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'QUEUE': return 'bg-blue-100 text-blue-800';
      case 'PREPARING': return 'bg-yellow-100 text-yellow-800';
      case 'READY': return 'bg-green-100 text-green-800';
      case 'DELIVERED': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return '';
    }
  }

  private applyFilters(): void {
    if (!this.allOrders) {
      this.orders = [];
      return;
    }

    const date = this.selectedDate;
    if (!date) {
      this.orders = [...this.allOrders];
      return;
    }

    const start = this.startOfDay(date);
    const end = this.endOfDay(date);

    this.orders = this.allOrders.filter((o) => {
      const d = new Date(o.date);
      return d >= start && d <= end;
    });
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private endOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  onStatusFieldChange(order: OrderResponse, newStatus: string): void {
    order.status = newStatus as OrderStatus;
    this.trackOrderChange(order);
  }

  private trackOrderChange(order: OrderResponse): void {
    const original = this.originalOrders.get(order.id);
    if (!original) return;

    const hasChanges = original.status !== order.status;

    if (hasChanges) {
      this.modifiedOrders.set(order.id, { id: order.id, status: order.status });
    } else {
      this.modifiedOrders.delete(order.id);
    }
  }

  get hasUnsavedChanges(): boolean {
    return this.modifiedOrders.size > 0;
  }

  get unsavedChangesCount(): number {
    return this.modifiedOrders.size;
  }

  saveChanges(): void {
    if (this.modifiedOrders.size === 0) {
      this.messageService.add({
        severity: 'info',
        summary: 'Sin cambios',
        detail: 'No hay cambios pendientes por guardar.',
        life: 3000,
      });
      return;
    }

    this.saving = true;
    const updates = Array.from(this.modifiedOrders.values()).map(orderChanges => {
      const status = orderChanges.status;
      
      if (status === 'READY') {
        return this.orderService.markOrderAsReady(orderChanges.id!).pipe(
          catchError(error => {
            console.error(`Error updating order ${orderChanges.id}:`, error);
            return of({ error: true, orderId: orderChanges.id });
          })
        );
      } else if (status === 'DELIVERED') {
        return this.orderService.deliverOrder(orderChanges.id!).pipe(
          catchError(error => {
            console.error(`Error delivering order ${orderChanges.id}:`, error);
            return of({ error: true, orderId: orderChanges.id });
          })
        );
      } else if (status === 'CANCELLED') {
        return this.orderService.cancelOrder(orderChanges.id!).pipe(
          catchError(error => {
            console.error(`Error cancelling order ${orderChanges.id}:`, error);
            return of({ error: true, orderId: orderChanges.id });
          })
        );
      } else {
        return of({ error: true, orderId: orderChanges.id });
      }
    });

    forkJoin(updates).subscribe({
      next: (results) => {
        const errors = results.filter((r: unknown) => (r as { error?: boolean })?.error);
        const successCount = results.length - errors.length;

        if (errors.length === 0) {
          this.messageService.add({
            severity: 'success',
            summary: 'Cambios guardados',
            detail: `Se actualizaron ${successCount} pedido(s) exitosamente.`,
            life: 3000,
          });

          this.modifiedOrders.forEach((changes, orderId) => {
            const original = this.originalOrders.get(orderId);
            if (original) {
              Object.assign(original, changes);
            }
          });
          this.modifiedOrders.clear();
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Guardado parcial',
            detail: `Se actualizaron ${successCount} pedido(s), pero ${errors.length} fallaron.`,
            life: 5000,
          });
        }

        this.saving = false;
        this.fetchOrders();
      },
      error: (err) => {
        console.error('Error saving changes:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron guardar los cambios. Verifica la conexión con el servidor.',
          life: 5000,
        });
        this.saving = false;
      }
    });
  }
}
