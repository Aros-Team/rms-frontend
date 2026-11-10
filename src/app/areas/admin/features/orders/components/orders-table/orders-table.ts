import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef, NgZone, ViewChild } from '@angular/core';
import { CommonModule, SlicePipe } from '@angular/common';
import { Table, TableLazyLoadEvent, TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { Subscription } from 'rxjs';
import { Order, OrderStatus } from '@app/core/services/orders/order';
import {
  OrderResponse,
  calculateTotalPrice,
} from '@models/dto/orders/order-response';
import { SharedDatepicker } from '@app/shared/components/datepicker/datepicker';
import { WebSocket } from '@services/websocket/websocket';
import { Auth } from '@services/auth/auth';
import { environment } from '@environments/environment';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TableSkeleton } from '@shared/skeletons/table-skeleton/table-skeleton';
import { Money } from '@shared/pipes/money/money';

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
    SkeletonModule,
    TagModule,
    DialogModule,
    TooltipModule,
    InputTextModule,
    SlicePipe,
    TableSkeleton,
    Money
  ],
  templateUrl: './orders-table.html',
})
export class OrdersTable implements OnInit, OnDestroy {

  @ViewChild('dt') table: Table | undefined;

  orders: OrderResponse[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  /** Server-side pagination state (the table is `lazy`). */
  first = 0;
  rows = 10;
  totalRecords = 0;
  private loadedOnce = false;
  /** Identifies the request currently in flight, to avoid duplicate round-trips. */
  private inFlightKey: string | null = null;

  /**
   * Free-text search sent to the backend (`?search=`). Bound by the search box
   * in the filter bar; it is part of the request key, so a change reloads page 0.
   */
  search = '';
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

  /**
   * Order total including per-line `extraCharge`.
   *
   * Delegates to `calculateTotalPrice` so the money math lives in exactly one
   * place (dashboard KPIs use the same function).
   */
  getOrderTotal(order: OrderResponse): number {
    return calculateTotalPrice(order);
  }

  showOrderDetails(order: OrderResponse): void {
    this.selectedOrder = order;
    this.detailsDialogVisible = true;
  }

  clearFilters(): void {
    this.search = '';
    this.selectedStatus = 'ALL';
    this.selectedDate = new Date();
    this.first = 0;
    this.table?.clear();
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

    // Patch the visible page in place; a brand-new order means the server-side
    // page/total changed, so reload the current page instead of guessing where
    // the row belongs.
    const updateOrder = (updated: OrderResponse) => {
      this.ngZone.run(() => {
        const idx = this.orders.findIndex(o => o.id === updated.id);
        if (idx !== -1) {
          this.orders = this.orders.map(o =>
            o.id === updated.id ? { ...o, status: updated.status } : o
          );
        } else {
          this.fetchOrders();
          return;
        }
        // Keep originalOrders in sync so the "unsaved changes" badge stays accurate
        const original = this.originalOrders.get(updated.id);
        if (original) {
          original.status = updated.status;
        }
        // If this order was being edited locally, clear the pending change
        // since the server already applied the new status
        this.modifiedOrders.delete(updated.id);
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
    this.first = 0;
    this.fetchOrders();
  }

  onDateChange(date: Date | null): void {
    this.selectedDate = date;
    this.first = 0;
    this.fetchOrders();
  }

  /** Search is server-side: reset to the first page and refetch. */
  onSearchChange(): void {
    this.first = 0;
    this.fetchOrders();
  }

  /**
   * PrimeNG lazy-table callback: every page/sort change is answered by the
   * backend (`page` + `size` + `totalRecords`), so only one page of orders is
   * ever in memory.
   */
  onLazyLoad(event: TableLazyLoadEvent): void {
    const first = event.first ?? 0;
    const rows = event.rows ?? this.rows;
    const unchanged = this.loadedOnce && first === this.first && rows === this.rows;

    this.first = first;
    this.rows = rows;

    if (unchanged) return;
    this.fetchOrders();
  }

  private fetchOrders(): void {
    let status: OrderStatus | undefined;
    if (this.selectedStatus && this.selectedStatus !== 'ALL') {
      status = this.selectedStatus as OrderStatus;
    }

    // Date/status/search filtering and paging all happen server-side.
    const date = this.selectedDate ?? new Date();
    const page = this.rows > 0 ? Math.floor(this.first / this.rows) : 0;
    const requestKey = [
      page,
      this.rows,
      status ?? 'ALL',
      date.toDateString(),
      this.search,
    ].join('|');

    // The initial `(onLazyLoad)` emission fires right after `ngOnInit`, with the
    // same page that is already loading. Skip that duplicate round-trip.
    if (this.inFlightKey === requestKey) return;

    this.inFlightKey = requestKey;
    this.loading = true;
    this.error = null;

    this.orderService
      .getOrdersByDateRangePage(date, date, {
        status,
        search: this.search || undefined,
        page,
        size: this.rows,
        sort: 'date,desc',
      })
      .subscribe({
        next: (res) => {
          this.orders = res.items;
          this.totalRecords = res.total;
          this.originalOrders.clear();
          res.items.forEach(order => {
            this.originalOrders.set(order.id, { ...order });
          });
          this.modifiedOrders.clear();
          this.loadedOnce = true;
          this.inFlightKey = null;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          console.error(err);
          this.error = 'No se pudieron cargar los pedidos.';
          this.inFlightKey = null;
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
