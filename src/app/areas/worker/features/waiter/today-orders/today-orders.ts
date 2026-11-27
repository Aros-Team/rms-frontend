import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';

import { Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import {
  OrderDetailItem,
  OrderResponse,
  calculateTotalPrice,
  calculateLineTotal,
} from '@app/shared/models/dto/orders/order-response';
import type { RmsStatus } from '@app/shared/ui/types/ui-types';
import { Money } from '@app/shared/pipes/money/money';

import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import { TodayOrdersSkeleton } from './skeletons/today-orders-skeleton';

const STATUS_LABEL: Record<string, string> = {
  QUEUE: 'En cola',
  PREPARING: 'Preparando',
  READY: 'Listo',
  DELIVERED: 'Entregada',
  CANCELLED: 'Cancelada',
};

const STATUS_TONE: Record<string, RmsStatus> = {
  QUEUE: 'warning',
  PREPARING: 'info',
  READY: 'success',
  DELIVERED: 'neutral',
  CANCELLED: 'danger',
};

interface OrderLineView {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  options: string;
  instructions: string;
  detailIds: number[];
  ready: boolean;
  delivered: boolean;
}

function lineKey(detail: OrderDetailItem): string {
  const options = (detail.selectedOptions ?? []).map((option) => option.name).join(',');
  return `${String(detail.productId)}|${detail.instructions ?? ''}|${options}`;
}

function groupLines(details: readonly OrderDetailItem[]): OrderLineView[] {
  const lines = new Map<string, OrderLineView>();
  for (const detail of details) {
    const key = lineKey(detail);
    const current = lines.get(key);
    if (current) {
      current.quantity += 1;
      current.total = current.unitPrice * current.quantity;
      current.detailIds.push(detail.id);
      current.ready = current.ready && detail.ready === true;
      current.delivered = current.delivered && detail.delivered === true;
      continue;
    }
    lines.set(key, {
      key,
      name: detail.productName ?? '',
      quantity: 1,
      unitPrice: calculateLineTotal(detail),
      total: calculateLineTotal(detail),
      options: (detail.selectedOptions ?? []).map((option) => option.name).join(', '),
      instructions: detail.instructions ?? '',
      detailIds: [detail.id],
      ready: detail.ready === true,
      delivered: detail.delivered === true,
    });
  }
  return [...lines.values()];
}

/**
 * Waiter "Pedidos" — today's live order board.
 *
 * Feature: follow what was sent to the kitchen and hand the bill to the cashier.
 *
 * Contract:
 *  - polls the current day every 30 seconds;
 *  - status is text plus semantic colour, never a bare dot;
 *  - the empty state offers the next action instead of a dead end;
 *  - the bill preview is a read-only total: payments are registered by the
 *    cashier, so this screen never invents payment UI.
 */
@Component({
  selector: 'app-today-orders',
  templateUrl: './today-orders.html',
  styleUrl: './today-orders.css',
  imports: [Money, RmsButton, RmsDialog, RmsStatusPill, TodayOrdersSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayOrders implements OnInit {
  private readonly orderService = inject(Order);
  private readonly log = inject(Logging);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly orders = signal<OrderResponse[]>([]);
  private readonly processingIds = signal(new Set<number>());

  readonly billOrder = signal<OrderResponse | null>(null);
  readonly billLines = computed(() => {
    const order = this.billOrder();
    return order ? groupLines(order.details) : [];
  });

  readonly billTitle = computed(() => {
    const order = this.billOrder();
    return order ? `Cuenta · Pedido #${String(order.id)}` : 'Cuenta';
  });

  readonly billTable = computed(() => {
    const order = this.billOrder();
    return order ? this.tableLabel(order) : '';
  });

  readonly billTotal = computed(() => {
    const order = this.billOrder();
    return order ? calculateTotalPrice(order) : 0;
  });

  private subscription?: Subscription;
  private loadSeq = 0;
  private pollingInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.pollingInterval = setInterval(() => {
      this.fetchOrders();
    }, 30_000);
    this.destroyRef.onDestroy(() => {
      if (this.pollingInterval) clearInterval(this.pollingInterval);
    });
  }

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(): void {
    const seq = ++this.loadSeq;
    this.loading.set(true);
    this.error.set(null);

    const today = new Date();
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);

    this.subscription?.unsubscribe();
    this.subscription = this.orderService
      .getAllOrdersByDateRange(startDate, endDate)
      .subscribe({
        next: (result) => {
          if (seq !== this.loadSeq) return;
          this.orders.set(result.items);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          if (seq !== this.loadSeq) return;
          this.log.error('TodayOrders: error', err);
          this.error.set('No se pudieron cargar los pedidos. Revisa la conexión.');
          this.loading.set(false);
        },
      });
  }

  deliverLine(order: OrderResponse, line: OrderLineView): void {
    if (this.isProcessing(order.id) || !line.ready || line.delivered) return;
    this.toggleProcessing(order.id);
    let index = 0;
    const step = (): void => {
      if (index >= line.detailIds.length) {
        this.clearProcessing(order.id);
        return;
      }
      this.orderService.deliverDetail(order.id, line.detailIds[index]).subscribe({
        next: (updated) => {
          this.orders.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
          index += 1;
          step();
        },
        error: (err: unknown) => {
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          this.messageService.add({
            severity: status === 400 ? 'warn' : 'error',
            summary: status === 409 ? 'Conflicto' : 'Error al entregar',
            detail: extractError(err),
            life: 6000,
          });
          this.clearProcessing(order.id);
        },
      });
    };
    step();
  }

  deliverOrder(order: OrderResponse): void {
    if (this.isProcessing(order.id)) return;
    this.toggleProcessing(order.id);

    this.orderService.deliverOrder(order.id).subscribe({
      next: (updated) => {
        this.orders.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
        this.clearProcessing(order.id);
      },
      error: (err: unknown) => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        this.messageService.add({
          severity: status === 400 ? 'warn' : 'error',
          summary: status === 409 ? 'Conflicto' : 'Error al entregar',
          detail: extractError(err),
          life: 6000,
        });
        this.clearProcessing(order.id);
      },
    });
  }

  isProcessing(id: number): boolean {
    return this.processingIds().has(id);
  }

  private toggleProcessing(id: number): void {
    this.processingIds.update((set) => {
      const next = new Set(set);
      next.add(id);
      return next;
    });
  }

  private clearProcessing(id: number): void {
    this.processingIds.update((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });
  }

  statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  statusTone(status: string): RmsStatus {
    return STATUS_TONE[status] ?? 'neutral';
  }

  orderTime(date: string): string {
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  tableLabel(order: OrderResponse): string {
    return order.table ?? `Mesa ${String(order.tableId)}`;
  }

  orderLines(order: OrderResponse): OrderLineView[] {
    return groupLines(order.details);
  }

  orderTotal(order: OrderResponse): number {
    return calculateTotalPrice(order);
  }

  showBill(order: OrderResponse): void {
    this.billOrder.set(order);
  }

  closeBill(): void {
    this.billOrder.set(null);
  }

  onBillVisible(visible: boolean): void {
    if (!visible) this.closeBill();
  }

  goToCarta(): void {
    void this.router.navigate(['/worker/waiter'], { queryParams: { tab: 'carta' } });
  }

  refresh(): void {
    this.fetchOrders();
  }

  lineOptions(line: OrderLineView): string {
    return line.options.length > 0 ? line.options : '';
  }
}

function extractError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const errorBody: unknown = err.error;
    const body = errorBody as { detail?: string; message?: string } | null;
    return body?.detail ?? body?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}
