import { Component, inject, OnInit, signal, HostListener, computed, DestroyRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { ChartOptions, TooltipItem } from 'chart.js';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { ChartModule } from 'primeng/chart';
import { CommonModule } from '@angular/common';
import { Order } from '@app/core/services/orders/order';
import { Table } from '@app/core/services/tables/table';
import { Product, ProductData } from '@app/core/services/products/product';
import { Analytics } from '@app/core/services/analytics/analytics';
import { OrderDetailDialog } from '@shared/components/order-detail-dialog/order-detail-dialog';
import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { ServerStatus } from '@core/services/server-status/server-status';
import { OrderDetailItem, OrderResponse } from '@app/shared/models/dto/orders/order-response';
import { OrderDetailsResponse } from '@app/shared/models/dto/orders/order-details-response';
import { TableResponse } from '@app/shared/models/dto/tables/table-response';
import type { TopSellingProduct } from '@app/shared/models/dto/analytics/top-selling-product';
import { toAmount, type MoneyLike } from '@app/shared/models/dto/common/money';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { environment } from '@environments/environment';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { calculateLineTotal, calculateTotalPrice } from '@app/shared/models/dto/orders/order-response';
import { ListSkeleton } from '@shared/skeletons/list-skeleton/list-skeleton';
import { TableSkeleton } from '@shared/skeletons/table-skeleton/table-skeleton';
import { ServerDownPage } from '@shared/components/server-down-page/server-down-page';
import { Money } from '@shared/pipes/money/money';
import { rmsChartPalette, rmsDoughnutOptions } from '@app/shared/ui/chart/chart-theme';
import { RmsBadge } from '@shared/ui/badge/badge';
import { RmsButton } from '@shared/ui/button/button';
import { RmsChartFrame } from '@shared/ui/chart-frame/chart-frame';
import { RmsEmptyState } from '@shared/ui/empty-state/empty-state';
import { RmsIconButton } from '@shared/ui/icon-button/icon-button';
import { RmsStatusPill } from '@shared/ui/status-pill/status-pill';
import type { RmsStatus } from '@shared/ui/types/ui-types';

/** Chart tooltips format money through the same pipe the templates use. */
const moneyPipe = new Money();

/** Row rendered by the "Top 8 productos" panel (server ranking or local fallback). */
interface TopProductRow {
  productId: number;
  product: string;
  category: string;
  total: MoneyLike;
  units: number;
}

/**
 * Category doughnut options from the DS chart theme.
 *
 * The canvas legend is off: the dashboard renders an HTML legend below the plot
 * so it can never overprint the data (F-002). Tooltips keep the percentage.
 */
function categoryDoughnutOptions(total: () => number): ChartOptions<'doughnut'> {
  const base = rmsDoughnutOptions();
  return {
    ...base,
    cutout: '60%',
    plugins: {
      ...base.plugins,
      legend: { display: false },
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          label: (ctx: TooltipItem<'doughnut'>) => {
            const value = typeof ctx.parsed === 'number' ? ctx.parsed : 0;
            const sum = total();
            const pct = sum > 0 ? (value / sum) * 100 : 0;
            return ` ${ctx.label}: ${moneyPipe.transform(value)} (${pct.toFixed(1)}%)`;
          },
        },
      },
    },
  };
}

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
    TableModule,
    SkeletonModule,
    ChartModule,
    OrderDetailDialog,
    ListSkeleton,
    TableSkeleton,
    ServerDownPage,
    Money,
    RmsBadge,
    RmsButton,
    RmsChartFrame,
    RmsEmptyState,
    RmsIconButton,
    RmsStatusPill,
  ],
})
export class Dashboard implements OnInit {
  private orderService = inject(Order);
  private tableService = inject(Table);
  private productService = inject(Product);
  private analyticsService = inject(Analytics);
  private logger = inject(Logging);
  private wsService = inject(WebSocket);
  private authService = inject(Auth);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private serverStatusService = inject(ServerStatus);

  readonly serverStatus = computed(() => this.serverStatusService.status());

  orders = signal<OrderResponse[]>([]);
  isOrdersLoading = signal(true);
  isStatsLoaded = signal(false);
  /** RFC 7807 `detail` when today's orders could not be loaded. */
  ordersError = signal<string | null>(null);
  /**
   * `true` when the day was too large to walk completely; the KPIs then cover
   * only the first `MAX_ORDER_PAGES` pages and the UI says so instead of
   * pretending the numbers are complete.
   */
  ordersTruncated = signal(false);
  orderDetails = signal<OrderDetailsResponse[]>([]);

  /** Server ranking from `GET /v1/products/top-selling` for today. */
  topSelling = signal<TopSellingProduct[]>([]);
  topSellingLoading = signal(true);
  topSellingError = signal<string | null>(null);

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

  /** productId -> category name, used because order details omit categoryName. */
  private categoryByProductId = signal<Map<number, string>>(new Map());

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

  barHeightPercent(delivered: number): number {
    const peak = this.rhythmPeak().delivered;
    if (peak <= 0) return 5;
    return 5 + (delivered / peak) * 85;
  }

  /**
   * Local aggregation fallback for the Top 8 panel.
   *
   * Used only when `GET /v1/products/top-selling` fails or returns no rows for
   * today; the server ranking is the source of truth.
   */
  readonly topProductsBySales = computed<{ product: string; category: string; total: number; units: number }[]>(() => {
    const map = new Map<string, { category: string; total: number; units: number }>();
    for (const order of this.orders()) {
      if (order.status !== 'DELIVERED') continue;
      for (const detail of order.details) {
        const productName = detail.productName.trim() || 'Sin nombre';
        const categoryName = this.categoryFor(detail);
        const current = map.get(productName) ?? { category: categoryName, total: 0, units: 0 };
        current.total += calculateLineTotal(detail);
        current.units += 1;
        current.category = categoryName;
        map.set(productName, current);
      }
    }
    return Array.from(map, ([product, v]) => ({ product, category: v.category, total: v.total, units: v.units }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  });

  /**
   * Rows for the Top 8 panel: the real server ranking when available, else the
   * local aggregation so the panel never goes blank on an endpoint failure.
   */
  readonly topProducts = computed<TopProductRow[]>(() => {
    const ranking = this.topSelling();
    if (ranking.length > 0) {
      return ranking.map((row) => ({
        productId: row.productId,
        product: row.productName.trim() || 'Sin nombre',
        category: this.categoryForProductId(row.productId),
        total: row.revenue,
        units: row.unitsSold,
      }));
    }
    return this.topProductsBySales().map((row, index) => ({
      productId: index,
      product: row.product,
      category: row.category,
      total: row.total,
      units: row.units,
    }));
  });

  /** True while the ranking request or the order walk is still loading. */
  readonly topProductsLoading = computed(
    () => this.topSellingLoading() || (this.isOrdersLoading() && this.orders().length === 0),
  );

  /** Honest note when the panel fell back to local aggregation. */
  readonly topSellingNotice = computed(() => {
    const error = this.topSellingError();
    if (error) return `Ranking del servidor no disponible (${error}). Se muestra el cálculo local.`;
    if (!this.topSellingLoading() && this.topSelling().length === 0 && this.topProductsBySales().length > 0) {
      return 'El servidor no devolvió un ranking para hoy; se muestra el cálculo local.';
    }
    return '';
  });

  readonly salesByCategory = computed<{ category: string; total: number; units: number }[]>(() => {
    const map = new Map<string, { total: number; units: number }>();
    for (const order of this.orders()) {
      if (order.status !== 'DELIVERED') continue;
      for (const detail of order.details) {
        const categoryName = this.categoryFor(detail);
        const current = map.get(categoryName) ?? { total: 0, units: 0 };
        current.total += calculateLineTotal(detail);
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

  /** DS chart palette resolved for the active theme. */
  readonly categoryColors = computed<string[]>(() => {
    const palette = rmsChartPalette();
    return this.salesByCategory().map((_, index) => palette[index % palette.length]);
  });

  /** Colour for the i-th category; wraps the eight-series DS palette. */
  categoryColor(index: number): string {
    const colors = this.categoryColors();
    return colors.length > 0 ? colors[index % colors.length] : 'currentColor';
  }

  readonly salesByCategoryChartData = computed(() => {
    const rows = this.salesByCategory();
    const colors = this.categoryColors();
    return {
      labels: rows.map(r => r.category),
      datasets: [
        {
          data: rows.map(r => r.total),
          backgroundColor: colors,
          hoverOffset: 6,
          borderWidth: 0,
        },
      ],
    };
  });

  readonly salesByCategoryChartOptions = categoryDoughnutOptions(() => this.salesByCategoryTotal());

  /** Text alternative summarising the doughnut for screen readers. */
  readonly categoryChartSummary = computed(() => {
    const rows = this.salesByCategory();
    if (rows.length === 0) return '';
    const total = this.salesByCategoryTotal();
    const parts = rows.map((row) => {
      const pct = total > 0 ? Math.round((row.total / total) * 100) : 0;
      return `${row.category} ${String(pct)}%`;
    });
    return `Distribución de ventas por categoría: ${parts.join(', ')}.`;
  });

  readonly topProductsTotal = computed(() =>
    this.topProducts().reduce((sum, product) => sum + toAmount(product.total), 0),
  );

  ngOnInit(): void {
    this.checkScreenSize();
    this.updateDateTime();
    this.loadSalesVisibility();

    this.loadProductCategories();
    this.loadTopSelling();
    setTimeout(() => {
      this.loadStatsThenOrders();
    }, 0);

    this.connectWebSocket();
    setInterval(() => { this.updateDateTime(); }, 60000);
  }

  /**
   * Loads product categories once so the dashboard can attribute order lines to
   * a category. The order response intentionally omits `categoryName`.
   */
  private loadProductCategories(): void {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          const map = new Map<number, string>();
          for (const product of products) {
            if (product.categoryName) {
              map.set(product.id, product.categoryName);
            } else if (product.selectionType === 'SPECIAL_SELECTION') {
              map.set(product.id, 'Combos');
            }
          }
          this.categoryByProductId.set(map);
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.logger.warn('Dashboard: product categories unavailable', err);
        },
      });
  }

  /**
   * Resolves the category label for an order line, falling back to the product
   * catalogue because the order response omits `categoryName`.
   */
  private categoryFor(detail: OrderDetailItem): string {
    const fromOrder = detail.categoryName?.trim();
    if (fromOrder) return fromOrder;
    return this.categoryForProductId(detail.productId);
  }

  /** Category for a catalogue product id; the top-selling payload omits it. */
  private categoryForProductId(productId: number): string {
    return this.categoryByProductId().get(productId) ?? 'Sin categoría';
  }

  /** `YYYY-MM-DD` in the browser's local day, which is what the API ranks. */
  private localDateKey(date: Date): string {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Loads today's real product ranking.
   *
   * The endpoint is admin-only and concrete (`from`/`to` are ISO dates). Any
   * failure is recorded and the panel falls back to `topProductsBySales()`.
   */
  private loadTopSelling(): void {
    this.topSellingLoading.set(true);
    this.topSellingError.set(null);
    const today = this.localDateKey(new Date());

    this.analyticsService
      .getTopSellingProducts(today, today, 8)
      .pipe(
        catchError((error: unknown) => {
          this.logger.warn('Dashboard: top-selling unavailable', error);
          this.topSellingError.set(
            extractProblemDetail(error) ?? 'No se pudo cargar el ranking de productos.',
          );
          return of<TopSellingProduct[]>([]);
        }),
        finalize(() => {
          this.topSellingLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this.topSelling.set(Array.isArray(rows) ? rows : []);
        this.cdr.markForCheck();
      });
  }

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) return;

    this.wsService.connect(environment.wsUrl, token);

    this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.created)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((order) => {
        this.logger.debug('Dashboard: orderCreated', order.id);
        this.orders.update(list =>
          list.some(o => o.id === order.id) ? list : [order, ...list]
        );
        this.cdr.markForCheck();
      });

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

  checkServerStatus(): void {
    this.serverStatusService.check();
  }

  /** Retries the order walk and the top-selling request (error/empty states). */
  retryDashboard(): void {
    this.ordersError.set(null);
    this.isStatsLoaded.set(false);
    this.isOrdersLoading.set(true);
    this.retryTopSelling();
    this.loadStatsThenOrders();
  }

  /** Retries only the ranking request; drops stale rows so the fallback is real. */
  retryTopSelling(): void {
    this.topSelling.set([]);
    this.loadTopSelling();
  }

  private loadStatsThenOrders() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    this.ordersError.set(null);
    this.orderService.getAllOrdersByDateRange(todayStart, now).pipe(
      catchError((error: unknown) => {
        this.logger.warn('Dashboard: today orders unavailable', error);
        this.ordersError.set(
          extractProblemDetail(error) ?? 'No se pudieron cargar los pedidos de hoy.',
        );
        return of(null);
      }),
      finalize(() => { this.isOrdersLoading.set(false); })
    ).subscribe(result => {
      if (result !== null) {
        this.orders.set(result.items);
        this.ordersTruncated.set(result.truncated);
      }
      this.isStatsLoaded.set(true);
    });

    this.tableService.getTables().pipe(
      catchError(() => of(null))
    ).subscribe(tables => {
      if (tables !== null) {
        this.allTables.set(tables);
      }
    });
  }

  private updateDateTime(): void {
    const now = new Date();

    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour12: true
    };
    this.currentDate.set(now.toLocaleDateString('es-ES', dateOptions));

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

  /**
   * Domain status mapped to the DS status roles (docs/DESIGN.md §2.3).
   * QUEUE is a pending warning, PREPARING is in-progress info.
   */
  getStatusRole(status: string): RmsStatus {
    switch (status) {
      case 'READY':      return 'success';
      case 'PREPARING':  return 'info';
      case 'QUEUE':      return 'warning';
      case 'CANCELLED':  return 'danger';
      case 'DELIVERED':
      default:           return 'neutral';
    }
  }

  readonly serverStatusTone = computed<RmsStatus>(() => {
    switch (this.serverStatus()) {
      case 'online':   return 'success';
      case 'offline':  return 'danger';
      default:         return 'warning';
    }
  });

  readonly serverStatusLabel = computed(() => {
    switch (this.serverStatus()) {
      case 'online':   return 'Servidor online';
      case 'offline':  return 'Servidor offline';
      default:         return 'Verificando servidor';
    }
  });

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