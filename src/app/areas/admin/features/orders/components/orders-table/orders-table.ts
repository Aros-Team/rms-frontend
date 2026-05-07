import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, ViewChild } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { Table, TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { Subscription } from 'rxjs';
import { Order, OrderStatus } from '@app/core/services/orders/order';
import { OrderResponse, OrderDetailItem } from '@models/dto/orders/order-response.model';
import { SharedDatepicker } from '@app/shared/components/datepicker/datepicker';
import { WebSocket } from '@services/websocket/websocket';
import { Auth } from '@services/auth/auth';
import { environment } from '@environments/environment';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';

const WS_TOPICS = {
  created:   '/topic/orders/created',
  preparing: '/topic/orders/preparing',
  ready:     '/topic/orders/ready',
  delivered: '/topic/orders/delivered',
  cancelled: '/topic/orders/cancelled',
} as const;

@Component({
  selector: 'app-orders-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TableModule,
    SharedDatepicker,
    SelectModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SkeletonModule,
    TagModule,
    DialogModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    SlicePipe,
    TableSkeleton
  ],
  templateUrl: './orders-table.html',
})
export class OrdersTable implements OnInit, OnDestroy {

  @ViewChild('dt') table!: Table;

  orders: OrderResponse[] = [];
  private allOrders: OrderResponse[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  searchQuery = '';
  selectedOrder: OrderResponse | null = null;
  detailsDialogVisible = false;

  comboStatusOptions = [
    { label: 'Todos', value: 'ALL' },
    { label: 'En Cola', value: 'QUEUE' },
    { label: 'En Preparación', value: 'PREPARING' },
    { label: 'Listo', value: 'READY' },
    { label: 'Entregado', value: 'DELIVERED' },
    { label: 'Cancelado', value: 'CANCELLED' }
  ];

  selectedStatus = 'ALL';
  selectedDate: Date | null = new Date();

  private modifiedOrders = new Map<number, Partial<OrderResponse>>();
  private originalOrders = new Map<number, OrderResponse>();

  private orderService = inject(Order);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private wsService = inject(WebSocket);
  private authService = inject(Auth);
  private ngZone = inject(NgZone);

  private wsSubs: Subscription[] = [];

  ngOnInit(): void {
    this.selectedDate = new Date();
    this.fetchOrders();
    this.connectWebSocket();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query.toLowerCase();
    this.applyFilters();
  }

  getOrderTotal(order: OrderResponse): number {
    if (order.details.length === 0) return 0;
    return order.details.reduce((sum: number, detail: OrderDetailItem) =>
      sum + detail.unitPrice, 0
    );
  }

  showOrderDetails(order: OrderResponse): void {
    this.selectedOrder = order;
    this.detailsDialogVisible = true;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = 'ALL';
    this.selectedDate = new Date();
    this.table.clear();
    this.fetchOrders();
  }

  ngOnDestroy(): void {
    this.wsSubs.forEach(sub => { sub.unsubscribe(); });
  }

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) return;

    // Ensure connection is active (no-op if already connected from Kitchen)
    this.wsService.connect(environment.wsUrl, token);

    // When any order changes status, update it in the local list
    const updateOrder = (updated: OrderResponse) => {
      this.ngZone.run(() => {
        const idx = this.allOrders.findIndex(o => o.id === updated.id);
        if (idx !== -1) {
          this.allOrders[idx] = { ...this.allOrders[idx], status: updated.status };
        } else {
          // New order not yet in the list — add it
          this.allOrders = [updated, ...this.allOrders];
          this.originalOrders.set(updated.id, { ...updated });
        }
        // Also update originalOrders so the "unsaved changes" badge stays accurate
        const original = this.originalOrders.get(updated.id);
        if (original) {
          original.status = updated.status;
        }
        // If this order was being edited locally, clear the pending change
        // since the server already applied the new status
        this.modifiedOrders.delete(updated.id);
        this.applyFilters();
        this.cdr.markForCheck();
      });
    };

    this.wsSubs.push(this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.created).subscribe(updateOrder));
    this.wsSubs.push(this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.preparing).subscribe(updateOrder));
    this.wsSubs.push(this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.ready).subscribe(updateOrder));
    this.wsSubs.push(this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.delivered).subscribe(updateOrder));
    this.wsSubs.push(this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.cancelled).subscribe(updateOrder));
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

    this.orderService.getOrdersByStatusOrAll(status).subscribe({
      next: (res: OrderResponse[]) => {
        this.allOrders = res;
        this.originalOrders.clear();
        res.forEach(order => {
          this.originalOrders.set(order.id, { ...order });
        });
        this.modifiedOrders.clear();
        this.applyFilters();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        console.error(err);
        this.error = 'No se pudieron cargar los pedidos.';
        this.loading = false;
        this.cdr.markForCheck();
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

  getStatusSeverity(status: string): 'info' | 'warn' | 'success' | 'danger' | 'secondary' {
    switch (status) {
      case 'QUEUE': return 'info';
      case 'PREPARING': return 'warn';
      case 'READY': return 'success';
      case 'DELIVERED': return 'secondary';
      case 'CANCELLED': return 'danger';
      default: return 'secondary';
    }
  }

  private applyFilters(): void {
    if (this.allOrders.length === 0) {
      this.orders = [];
      return;
    }

    let filtered = [...this.allOrders];

    const date = this.selectedDate;
    if (date) {
      const start = this.startOfDay(date);
      const end = this.endOfDay(date);
      filtered = filtered.filter((o) => {
        const d = new Date(o.date);
        return d >= start && d <= end;
      });
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter((o) => {
        const matchesId = o.id.toString().includes(query);
        const matchesTable = o.tableId.toString().includes(query);
        const matchesProducts = o.details.some((d: OrderDetailItem) =>
          d.productName.toLowerCase().includes(query)
        );
        return matchesId || matchesTable || matchesProducts;
      });
    }

    this.orders = filtered;
    this.cdr.markForCheck();
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

      const orderId = orderChanges.id;
      if (orderId == null) {
        return of({ error: true, orderId: undefined });
      }

      if (status === 'PREPARING') {
        // PREPARING se activa con el endpoint "prepare next" que toma la siguiente de la cola.
        // Desde la tabla de admin usamos prepareNext() ya que no hay endpoint directo por ID.
        return this.orderService.prepareNext().pipe(
          catchError(error => {
            console.error('Error preparing order:', orderId, error);
            return of({ error: true, orderId });
          })
        );
      } else if (status === 'READY') {
        return this.orderService.markAsReady(orderId).pipe(
          catchError(error => {
            console.error('Error updating order:', orderId, error);
            return of({ error: true, orderId });
          })
        );
      } else if (status === 'DELIVERED') {
        return this.orderService.deliverOrder(orderId).pipe(
          catchError(error => {
            console.error('Error delivering order:', orderId, error);
            return of({ error: true, orderId });
          })
        );
      } else if (status === 'CANCELLED') {
        return this.orderService.cancelOrder(orderId).pipe(
          catchError(error => {
            console.error('Error cancelling order:', orderId, error);
            return of({ error: true, orderId });
          })
        );
      } else {
        // Estado no soportado para cambio manual
        const statusStr = status ?? 'desconocido';
        this.messageService.add({
          severity: 'warn',
          summary: 'Acción no disponible',
          detail: 'El estado "' + statusStr + '" no puede asignarse manualmente desde esta vista.',
          life: 4000,
        });
        return of({ error: true, orderId: orderChanges.id });
      }
    });

    forkJoin(updates).subscribe({
      next: (results) => {
        const errors = results.filter((r: unknown) => (r as { error?: boolean }).error);
        const successCount = results.length - errors.length;

        if (errors.length === 0) {
          this.messageService.add({
            severity: 'success',
            summary: 'Cambios guardados',
            detail: 'Se actualizaron ' + String(successCount) + ' pedido(s) exitosamente.',
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
            detail: 'Se actualizaron ' + String(successCount) + ' pedido(s), pero ' + String(errors.length) + ' fallaron.',
            life: 5000,
          });
        }

        this.saving = false;
        this.fetchOrders();
        this.cdr.markForCheck();
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
        this.cdr.markForCheck();
      }
    });
  }
}
