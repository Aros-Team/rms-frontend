import { Component, inject, OnInit, OnDestroy, signal, HostListener, computed, DestroyRef, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { CommonModule } from '@angular/common';
import { Order } from '@app/core/services/orders/order';
import { Table } from '@app/core/services/tables/table';
import { Product, ProductData } from '@app/core/services/products/product';
import { DayMenuService } from '@app/core/services/daymenu/daymenu';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { OrderDetailDialog } from '@shared/components/order-detail-dialog/order-detail-dialog';
import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OrderDetailsResponse } from '@app/shared/models/dto/orders/order-details-response.model';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';
import { forkJoin, of, interval, Subscription, EMPTY } from 'rxjs';
import { catchError, switchMap, finalize } from 'rxjs/operators';
import { calculateTotalPrice } from '@app/shared/models/dto/orders/order-response.model';
import { Message } from 'primeng/message';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { DaymenuSkeleton } from './skeletons/daymenu-skeleton';
import { ListSkeleton } from '@shared/skeletons/list-skeleton';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';
import { DayMenuCacheService } from '../manage/menu/daymenu-cache.service';

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
    OrderDetailDialog,
    Message,
    ListSkeleton,
    DaymenuSkeleton,
    TableSkeleton,
  ],
})
export class Dashboard implements OnInit, OnDestroy {
  private orderService = inject(Order);
  private tableService = inject(Table);
  private productService = inject(Product);
  private dayMenuService = inject(DayMenuService);
  private logger = inject(Logging);
  private http = inject(HttpClient);
  readonly dayMenuCache = inject(DayMenuCacheService);
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

  // Day menu from cache
  dayMenu = computed(() => this.dayMenuCache.currentMenu.data());
  loadingDayMenu = computed(() => this.dayMenuCache.currentMenu.isLoading());
  dayMenuOptions = computed(() => this.dayMenuCache.currentOptions.data() ?? []);
  loadingDayMenuOptions = computed(() => this.dayMenuCache.currentOptions.isLoading());

  existDayMenu = computed(() => this.dayMenu() !== null);
  completedOrdersCount = signal(0);
  preparingOrdersCount = signal(0);
  totalSales = signal(0);
  isLoading = signal(false);

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
  isSwipedLeft = signal(false);
  private touchStartX = 0;
  private touchEndX = 0;
  private readonly minSwipeDistance = 50;
  private isMobile = signal(false);

  ngOnInit(): void {
    this.checkScreenSize();
    this.updateDateTime();
    this.loadSalesVisibility();
    this.startHealthCheck();

    // Initialize day menu cache
    this.dayMenuCache.currentMenu.load();

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

  // ─── Initial data load ─────────────────────────────────────────────────────

  private loadDashboardData(): void {
    this.isLoading.set(true);

    // Load today's orders — metrics are derived via computed() from this signal
    this.orderService.getTodayOrders().subscribe({
      next: (orders) => {
        this.logger.debug('Dashboard: orders loaded', orders.length);
        this.orders.set(orders);
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.logger.error('Dashboard: error loading orders, trying fallback', error);
        this.orderService.getOrdersByStatusOrAll().subscribe({
          next: (allOrders) => {
            this.orders.set(allOrders);
            this.isLoading.set(false);
            this.cdr.markForCheck();
          },
          error: (fallbackError) => {
            this.logger.error('Dashboard: fallback also failed', fallbackError);
            this.isLoading.set(false);
            this.cdr.markForCheck();
          }
        });
      }
    });

    // Load tables — occupied count is derived via computed() from this signal
    this.tableService.getTables().subscribe({
      next: (tables) => {
        this.allTables.set(tables);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.logger.error('Dashboard: error loading tables', error);
      }
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
    const stats$ = forkJoin({
      completedOrders: this.orderService.getCompletedOrdersCount().pipe(
        catchError(error => {
          this.logger.error('Error loading completed orders count:', error);
          return of(0);
        })
      ),
      preparingOrders: this.orderService.getPreparingOrdersCount().pipe(
        catchError(error => {
          this.logger.error('Error loading preparing orders count:', error);
          return of(0);
        })
      ),
      occupiedTables: this.tableService.getOccupiedTablesCount().pipe(
        catchError(error => {
          this.logger.error('Error loading occupied tables count:', error);
          return of(0);
        })
      ),
      totalTables: this.tableService.getTotalTablesCount().pipe(
        catchError(error => {
          this.logger.error('Error loading tables count:', error);
          return of(0);
        })
      ),
      totalSales: this.orderService.getTotalSales().pipe(
        catchError(error => {
          this.logger.error('Error loading total sales:', error);
          return of(0);
        })
      ),
    }).pipe(
      finalize(() => { this.isStatsLoaded.set(true); })
    );

    const orders$ = this.orderService.getTodayOrders().pipe(
      catchError(error => {
        this.logger.error('Error loading orders:', error);
        return this.orderService.getOrdersByStatusOrAll().pipe(
          catchError(fallbackError => {
            this.logger.error('Error loading fallback orders:', fallbackError);
            return of([] as OrderResponse[]);
          })
        );
      }),
      finalize(() => { this.isOrdersLoading.set(false); })
    );

    stats$.pipe(
      switchMap(stats => {
        this.completedOrdersCount.set(stats.completedOrders);
        this.preparingOrdersCount.set(stats.preparingOrders);
        this.totalSales.set(stats.totalSales);
        return orders$;
      }),
      switchMap(orders => {
        this.orders.set(orders);
        return EMPTY;
      })
    ).subscribe();
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

  groupByCategory(options: ProductOption[]): { category: string; items: ProductOption[] }[] {
    const map = new Map<string, ProductOption[]>();
    for (const o of options) {
      const arr = map.get(o.optionCategoryName) ?? [];
      arr.push(o);
      map.set(o.optionCategoryName, arr);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }

  calcTotal(order: OrderResponse): number {
    return calculateTotalPrice(order);
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

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.touches[0].clientX;
  }

  onTouchMove(event: TouchEvent): void {
    this.touchEndX = event.touches[0].clientX;
  }

  onTouchEnd(): void {
    const swipeDistance = this.touchEndX - this.touchStartX;
    if (Math.abs(swipeDistance) > this.minSwipeDistance) {
      if (swipeDistance < 0 && !this.isSwipedLeft()) {
        this.isSwipedLeft.set(true);
      } else if (swipeDistance > 0 && this.isSwipedLeft()) {
        this.isSwipedLeft.set(false);
      }
    }
  }

  onIndicatorClick(direction: 'left' | 'right'): void {
    this.isSwipedLeft.set(direction === 'left');
  }
}