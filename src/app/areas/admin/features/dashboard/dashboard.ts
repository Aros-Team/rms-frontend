import { Component, inject, OnInit, OnDestroy, signal, HostListener, computed } from '@angular/core';
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
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OrderDetailsResponse } from '@app/shared/models/dto/orders/order-details-response.model';
import { forkJoin, of, interval, Subscription, EMPTY } from 'rxjs';
import { catchError, switchMap, finalize } from 'rxjs/operators';
import { calculateTotalPrice } from '@app/shared/models/dto/orders/order-response.model';
import { Message } from "primeng/message";
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { DaymenuSkeleton } from './skeletons/daymenu-skeleton';
import { ListSkeleton } from '@shared/skeletons/list-skeleton';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';
import { DayMenuCacheService } from '../manage/menu/daymenu-cache.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
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

  serverStatus = signal<'online' | 'offline' | 'checking'>('checking');
  private healthCheckSubscription: Subscription | undefined;

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
  occupiedTablesCount = signal(0);
  totalTables = signal(0);
  totalSales = signal(0);
  currentDate = signal('');
  currentTime = signal('');
  showSales = signal(true);

  showOrderDetail = signal(false);
  selectedOrder = signal<OrderResponse | null>(null);
  selectedProduct = signal<ProductData | null>(null);
  isSwipedLeft = signal(false);
  private touchStartX = 0;
  private touchEndX = 0;
  private minSwipeDistance = 50;
  private isMobile = signal(false);

  ngOnInit() {
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

    setInterval(() => { this.updateDateTime(); }, 60000);
  }

  ngOnDestroy(): void {
    if (this.healthCheckSubscription) {
      this.healthCheckSubscription.unsubscribe();
    }
  }

  private startHealthCheck(): void {
    this.checkServerStatus();
    this.healthCheckSubscription = interval(30000).subscribe(() => {
      this.checkServerStatus();
    });
  }

  checkServerStatus(): void {
    this.serverStatus.set('checking');
    const baseUrl = environment.apiUrl.replace('/api', '');
    this.http.get<{status: string}>(`${baseUrl}/health`).subscribe({
      next: (response) => {
        this.serverStatus.set(response.status === 'UP' ? 'online' : 'offline');
      },
      error: () => {
        this.serverStatus.set('offline');
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
        this.occupiedTablesCount.set(stats.occupiedTables);
        this.totalTables.set(stats.totalTables);
        this.totalSales.set(stats.totalSales);
        return orders$;
      }),
      switchMap(orders => {
        this.orders.set(orders);
        return EMPTY;
      })
    ).subscribe();
  }

  private updateDateTime() {
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
      case 'DELIVERED':
        return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-300';
      case 'PREPARING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-300';
      case 'READY':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-300';
      case 'QUEUE':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-300';
      default:
        return 'bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-300';
    }
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'secondary' | 'danger' {
    switch (status) {
      case 'QUEUE':
        return 'info';
      case 'PREPARING':
        return 'warn';
      case 'READY':
        return 'success';
      case 'DELIVERED':
        return 'secondary';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'DELIVERED':
        return 'Entregado';
      case 'PREPARING':
        return 'En preparación';
      case 'READY':
        return 'Listo';
      case 'QUEUE':
        return 'En cola';
      case 'CANCELLED':
        return 'Cancelado';
      default:
        return status;
    }
  }

  viewOrderDetails(order: OrderResponse) {
    this.selectedOrder.set(order);
    // For now, get a sample product to show in the dialog
    this.productService.getProductById(1).subscribe({
      next: (product) => {
        this.selectedProduct.set(product ?? null);
        this.showOrderDetail.set(true);
      },
      error: (error) => {
        this.logger.error('Error loading product details:', error);
      }
    });
  }

  closeOrderDetail() {
    this.showOrderDetail.set(false);
    this.selectedOrder.set(null);
    this.orderDetails.set([]);
  }

  toggleSalesVisibility() {
    const newVisibility = !this.showSales();
    this.showSales.set(newVisibility);
    localStorage.setItem('dashboard_sales_visible', newVisibility.toString());
  }

  private loadSalesVisibility() {
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
