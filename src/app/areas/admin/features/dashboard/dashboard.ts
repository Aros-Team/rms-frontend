import { Component, inject, OnInit, OnDestroy, signal, HostListener, computed, DestroyRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { CommonModule } from '@angular/common';
import { Order } from '@app/core/services/orders/order';
import { Table } from '@app/core/services/tables/table';
import { Product, ProductData } from '@app/core/services/products/product';
import { OrderDetailDialog } from '@shared/components/order-detail-dialog/order-detail-dialog';
import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OrderDetailsResponse } from '@app/shared/models/dto/orders/order-details-response.model';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';
import { of, interval, Subscription } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { calculateTotalPrice } from '@app/shared/models/dto/orders/order-response.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { ListSkeleton } from '@shared/skeletons/list-skeleton';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';

const RHYTHM_START_HOUR = 8;
const RHYTHM_END_HOUR = 23;

const WS_TOPICS = {
  created:     '/topic/orders/created',
  preparing:   '/topic/orders/preparing',
  ready:       '/topic/orders/ready',
  delivered:   '/topic/orders/delivered',
  cancelled:   '/topic/orders/cancelled',
  tableStatus: '/topic/tables/status',
} as const;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    BadgeModule,
    CardModule,
    SkeletonModule,
    TagModule,
    ChartModule,
    OrderDetailDialog,
    ListSkeleton,
    TableSkeleton,
  ],
})
export class Dashboard implements OnInit, OnDestroy {
  private orderService = inject(Order);
  private tableService = inject(Table);
  private productService = inject(Product);
  private logger = inject(Logging);
  private http = inject(HttpClient);
  private wsService = inject(WebSocket);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  serverStatus = signal<'online' | 'offline' | 'checking'>('checking');
  private healthCheckSubscription: Subscription | undefined;

  // All today's orders — kept in sync via WebSocket events
  orders = signal<OrderResponse[]>([]);
  isOrdersLoading = signal(true);
  isStatsLoaded = signal(false);
  orderDetails = signal<OrderDetailsResponse[]>([]);

  completedOrdersCount = computed(() =>
    this.orders().filter(o => o.status === 'DELIVERED').length
  );
  preparingOrdersCount = computed(() =>
    this.orders().filter(o => o.status === 'PREPARING').length
  );
  totalSales = computed(() =>
    this.orders()
      .filter(o => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + calculateTotalPrice(o), 0)
  );

  // Tables — kept in sync via WebSocket events
  private allTables = signal<TableResponse[]>([]);
  occupiedTablesCount = computed(() =>
    this.allTables().filter(t => t.status === 'OCCUPIED').length
  );
  totalTables = computed(() => this.allTables().length);

  currentDate = signal('');
  currentTime = signal('');
  showSales = signal(true);

  showOrderDetail = signal(false);
  selectedOrder = signal<OrderResponse | null>(null);
  selectedProduct = signal<ProductData | null>(null);
  private isMobile = signal(false);

  // ─── Hourly rhythm chart ──────────────────────────────────────────────────
  // Computed from today's orders. The WebSocket subscriptions keep `orders()`
  // in sync, so this chart updates live as orders are delivered.
  readonly rhythmRange = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  });

  readonly hourlyRhythm = computed<{ hour: number; label: string; delivered: number; isCurrent: boolean }[]>(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const todayStartMs = todayStart.getTime();
    const todayEndMs = todayEnd.getTime();
    const currentHour = now.getHours();

    const buckets: { delivered: number }[] = [];
    for (let h = RHYTHM_START_HOUR; h <= RHYTHM_END_HOUR; h++) {
      buckets.push({ delivered: 0 });
    }

    for (const order of this.orders()) {
      const orderDate = new Date(order.date);
      const ms = orderDate.getTime();
      if (ms < todayStartMs || ms >= todayEndMs) continue;
      const hour = orderDate.getHours();
      if (hour < RHYTHM_START_HOUR || hour > RHYTHM_END_HOUR) continue;
      if (order.status === 'DELIVERED') {
        buckets[hour - RHYTHM_START_HOUR].delivered++;
      }
    }

    return buckets.map((b, idx) => {
      const hour = idx + RHYTHM_START_HOUR;
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        delivered: b.delivered,
        isCurrent: hour === currentHour,
      };
    });
  });

  readonly rhythmPeak = computed(() => {
    const rhythm = this.hourlyRhythm();
    return rhythm.reduce((max, b) => (b.delivered > max.delivered ? b : max), rhythm[0] ?? { hour: 0, label: '—', delivered: 0, isCurrent: false });
  });

  readonly rhythmTotalToday = computed(() =>
    this.hourlyRhythm().reduce((sum, b) => sum + b.delivered, 0),
  );

  /** Returns a percentage height (5%–90%) for a CSS bar proportional to the peak. */
  barHeightPercent(delivered: number): number {
    const peak = this.rhythmPeak().delivered;
    if (peak <= 0) return 5;
    return 5 + (delivered / peak) * 85;
  }

  // ─── Sales by category + top products (composed in one rectangle) ───────
  // categoryName comes from OrderDetailResponse.categoryName (added on the
  // backend). When null, the detail falls into "Sin categoría".
  readonly topProductsBySales = computed<{ product: string; category: string; total: number; units: number }[]>(() => {
    const map = new Map<string, { category: string; total: number; units: number }>();
    for (const order of this.orders()) {
      if (order.status !== 'DELIVERED') continue;
      for (const detail of order.details) {
        const productName = detail.productName.trim() || 'Sin nombre';
        const categoryName = detail.categoryName?.trim() ?? 'Sin categoría';
        const current = map.get(productName) ?? { category: categoryName, total: 0, units: 0 };
        current.total += calculateTotalPrice({ ...order, details: [detail] });
        current.units += 1;
        current.category = categoryName;
        map.set(productName, current);
      }
    }
    return Array.from(map, ([product, v]) => ({ product, category: v.category, total: v.total, units: v.units }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  });

  readonly salesByCategory = computed<{ category: string; total: number; units: number }[]>(() => {
    const map = new Map<string, { total: number; units: number }>();
    for (const order of this.orders()) {
      if (order.status !== 'DELIVERED') continue;
      for (const detail of order.details) {
        const categoryName = detail.categoryName?.trim() ?? 'Sin categoría';
        const current = map.get(categoryName) ?? { total: 0, units: 0 };
        current.total += calculateTotalPrice({ ...order, details: [detail] });
        current.units += 1;
        map.set(categoryName, current);
      }
    }
    return Array.from(map, ([category, v]) => ({ category, total: v.total, units: v.units }))
      .sort((a, b) => b.total - a.total);
  });

  readonly salesByCategoryTotal = computed(() =>
    this.salesByCategory().reduce((sum, c) => sum + c.total, 0),
  );

  readonly salesByCategoryChartData = computed(() => {
    const rows = this.salesByCategory();
    const palette = [
      '#F9BB0B', '#42A5F5', '#26A69A', '#AB47BC', '#FFA726',
      '#EC407A', '#78909C', '#66BB6A', '#5C6BC0', '#8D6E63',
    ];
    return {
      labels: rows.map(r => r.category),
      datasets: [
        {
          data: rows.map(r => r.total),
          backgroundColor: rows.map((_, i) => palette[i % palette.length]),
          hoverOffset: 6,
          borderWidth: 0,
        },
      ],
    };
  });

  readonly salesByCategoryChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '55%',
    animation: { duration: 250 },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: { size: 11 },
          boxWidth: 10,
          boxHeight: 10,
          padding: 8,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number }): string => {
            const total = this.salesByCategoryTotal();
            const pct = total > 0 ? (ctx.parsed / total) * 100 : 0;
            return ` ${ctx.label}: $ ${this.formatMoney(ctx.parsed)} (${pct.toFixed(1)}%)`;
          },
        },
      },
    },
  };

  readonly topProductsTotal = computed(() =>
    this.topProductsBySales().reduce((sum, p) => sum + p.total, 0),
  );

  ngOnInit(): void {
    this.checkScreenSize();
    this.updateDateTime();
    this.loadSalesVisibility();
    this.startHealthCheck();

    // Skeletons pintan inmediatamente. Datos cargan en orden estricto.
    setTimeout(() => {
      this.loadStatsThenOrders();
    }, 0);

    this.connectWebSocket();
    setInterval(() => { this.updateDateTime(); }, 60000);
  }

  ngOnDestroy(): void {
    this.healthCheckSubscription?.unsubscribe();
  }

  // ─── WebSocket ─────────────────────────────────────────────────────────────

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) return;

    this.wsService.connect(environment.wsUrl, token);

    // ── Orders ──────────────────────────────────────────────────────────────

    // New order created → add to list (avoid duplicates)
    this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.created)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((order) => {
        this.logger.debug('Dashboard: orderCreated', order.id);
        this.orders.update(list =>
          list.some(o => o.id === order.id) ? list : [order, ...list]
        );
        this.cdr.markForCheck();
      });

    // Status transitions — update the order in-place so computed metrics react
    const updateOrderStatus = (updated: OrderResponse): void => {
      this.orders.update(list =>
        list.map(o => o.id === updated.id ? { ...o, status: updated.status } : o)
      );
      this.cdr.markForCheck();
    };

    this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.preparing)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((o) => { this.logger.debug('Dashboard: orderPreparing', o.id); updateOrderStatus(o); });

    this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.ready)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((o) => { this.logger.debug('Dashboard: orderReady', o.id); updateOrderStatus(o); });

    this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.delivered)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((o) => { this.logger.debug('Dashboard: orderDelivered', o.id); updateOrderStatus(o); });

    this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.cancelled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((o) => { this.logger.debug('Dashboard: orderCancelled', o.id); updateOrderStatus(o); });

    // ── Tables ───────────────────────────────────────────────────────────────

    this.wsService.subscribeToTopic<TableResponse>(WS_TOPICS.tableStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        this.logger.debug('Dashboard: tableStatus', updated.id, updated.status);
        this.allTables.update(list =>
          list.map(t => t.id === updated.id ? { ...t, ...updated } : t)
        );
        this.cdr.markForCheck();
      });
  }

  // ─── Health check ──────────────────────────────────────────────────────────

  private startHealthCheck(): void {
    this.checkServerStatus();
    this.healthCheckSubscription = interval(30000).subscribe(() => {
      this.checkServerStatus();
    });
  }

  checkServerStatus(): void {
    this.serverStatus.set('checking');
    const baseUrl = environment.apiUrl.replace('/api', '');
    this.http.get<{ status: string }>(`${baseUrl}/health`).subscribe({
      next: (response) => {
        this.serverStatus.set(response.status === 'UP' ? 'online' : 'offline');
        this.cdr.markForCheck();
      },
      error: () => {
        this.serverStatus.set('offline');
        this.cdr.markForCheck();
      }
    });
  }

  private loadStatsThenOrders() {
    // Only 2 API calls — everything else is derived via computed() from orders()
    this.orderService.getTodayOrders().pipe(
      catchError(() => of([] as OrderResponse[])),
      finalize(() => { this.isOrdersLoading.set(false); })
    ).subscribe(orders => {
      this.orders.set(orders);
      this.isStatsLoaded.set(true);
    });

    this.tableService.getTables().pipe(
      catchError(() => of([] as TableResponse[]))
    ).subscribe(tables => {
      this.allTables.set(tables);
    });
  }

  private updateDateTime(): void {
    const now = new Date();

    // Format date in Spanish
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour12: true
    };
    this.currentDate.set(now.toLocaleDateString('es-ES', dateOptions));

    // Format time
    this.currentTime.set(now.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }));
  }

  formatDate(date: string | Date): string {
    if (!date) return '-';

    const dateObj = typeof date === 'string' ? new Date(date) : date;

    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(dateObj);
  }

  calcTotal(order: OrderResponse): number {
    return calculateTotalPrice(order);
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
  }

  shortMoney(value: number | string): string {
    const n = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (Number.isNaN(n)) return String(value);
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'DELIVERED': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-300';
      case 'PREPARING':  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-300';
      case 'READY':      return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-300';
      case 'QUEUE':      return 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-300';
      case 'CANCELLED':  return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-300';
      default:           return 'bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-300';
    }
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'secondary' | 'danger' {
    switch (status) {
      case 'QUEUE':      return 'info';
      case 'PREPARING':  return 'warn';
      case 'READY':      return 'success';
      case 'DELIVERED':  return 'secondary';
      case 'CANCELLED':  return 'danger';
      default:           return 'secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'DELIVERED': return 'Entregado';
      case 'PREPARING': return 'En preparación';
      case 'READY':     return 'Listo';
      case 'QUEUE':     return 'En cola';
      case 'CANCELLED': return 'Cancelado';
      default:          return status;
    }
  }

  viewOrderDetails(order: OrderResponse): void {
    this.selectedOrder.set(order);
    this.productService.getProductById(1).subscribe({
      next: (product) => {
        this.selectedProduct.set(product ?? null);
        this.showOrderDetail.set(true);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.logger.error('Dashboard: error loading product details', error);
      }
    });
  }

  closeOrderDetail(): void {
    this.showOrderDetail.set(false);
    this.selectedOrder.set(null);
    this.orderDetails.set([]);
  }

  toggleSalesVisibility(): void {
    const newVisibility = !this.showSales();
    this.showSales.set(newVisibility);
    localStorage.setItem('dashboard_sales_visible', newVisibility.toString());
  }

  private loadSalesVisibility(): void {
    const stored = localStorage.getItem('dashboard_sales_visible');
    if (stored !== null) {
      this.showSales.set(stored === 'true');
    }
  }

  private checkScreenSize(): void {
    this.isMobile.set(window.innerWidth < 1024);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.checkScreenSize();
  }

}