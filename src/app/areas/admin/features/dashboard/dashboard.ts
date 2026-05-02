import { Component, inject, OnInit, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { BadgeModule } from 'primeng/badge';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { CommonModule } from '@angular/common';
import { Order } from '@app/core/services/orders/order';
import { Table } from '@app/core/services/tables/table';
import { Product, ProductData } from '@app/core/services/products/product';
import { DayMenuService } from '@app/core/services/daymenu/daymenu';
import { DayMenuResponse } from '@app/shared/models/dto/daymenu/daymenu-response';
import { ProductOption } from '@app/shared/models/dto/products/product-option.model';
import { OrderDetailDialog } from '@shared/components/order-detail-dialog/order-detail-dialog';
import { Logging } from '@app/core/services/logging/logging';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OrderDetailsResponse } from '@app/shared/models/dto/orders/order-details-response.model';
import { of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { calculateTotalPrice } from '@app/shared/models/dto/orders/order-response.model';
import { Message } from "primeng/message";

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
    OrderDetailDialog,
    Message
  ],

})
export class Dashboard implements OnInit {
  private orderService = inject(Order);
  private tableService = inject(Table);
  private productService = inject(Product);
  private dayMenuService = inject(DayMenuService);
  private logger = inject(Logging);

  orders = signal<OrderResponse[]>([]);
  orderDetails = signal<OrderDetailsResponse[]>([]);
  dayMenu = signal<DayMenuResponse | null>(null);
  dayMenuOptions = signal<ProductOption[]>([]);
  loadingDayMenuOptions = signal(false);
  existDayMenu = false;
  completedOrdersCount = signal(0);
  preparingOrdersCount = signal(0);
  occupiedTablesCount = signal(0);
  totalTables = signal(0);
  totalSales = signal(0);
  currentDate = signal('');
  currentTime = signal('');
  showSales = signal(true);

  // Dialog state
  showOrderDetail = signal(false);
  selectedOrder = signal<OrderResponse | null>(null);
  selectedProduct = signal<ProductData | null>(null);

  ngOnInit() {
    this.loadDashboardData();
    this.loadDayMenu();
    this.updateDateTime();
    this.loadSalesVisibility();
    // Update time every minute
    setInterval(() => this.updateDateTime(), 60000);
  }

  private loadDashboardData() {
    // Load orders
    this.orderService.getTodayOrders().subscribe({
      next: (orders) => {
        this.logger.debug('Dashboard: Orders loaded:', orders);
        this.orders.set(orders);
      },
      error: (error) => {
        this.logger.error('Error loading orders:', error);
        // Fallback: try to get all orders without date filter
        this.orderService.getOrdersByStatusOrAll().subscribe({
          next: (allOrders) => {
            this.logger.debug('Dashboard: Fallback orders loaded:', allOrders);
            this.orders.set(allOrders);
          },
          error: (fallbackError) => {
            this.logger.error('Error loading fallback orders:', fallbackError);
          }
        });
      }
    });

    // Load statistics
    this.orderService.getCompletedOrdersCount().subscribe({
      next: (count) => {
        this.completedOrdersCount.set(count);
      },
      error: (error) => {
        this.logger.error('Error loading completed orders count:', error);
        this.completedOrdersCount.set(0);
      }
    });

    this.orderService.getPreparingOrdersCount().subscribe({
      next: (count) => {
        this.preparingOrdersCount.set(count);
      },
      error: (error) => {
        this.logger.error('Error loading preparing orders count:', error);
        this.preparingOrdersCount.set(0);
      }
    });

    this.tableService.getOccupiedTablesCount().subscribe({
      next: (count) => {
        this.occupiedTablesCount.set(count);
      },
      error: (error) => {
        this.logger.error('Error loading occupied tables count:', error);
        this.occupiedTablesCount.set(0);
      }
    });

    this.tableService.getTotalTablesCount().subscribe({
      next: (count) => {
        this.totalTables.set(count);
      },
      error: (error) => {
        this.logger.error('Error loading tables count:', error);
        this.occupiedTablesCount.set(0);
      }
    })

    this.orderService.getTotalSales().subscribe({
      next: (total) => {
        this.totalSales.set(total);
      },
      error: (error) => {
        this.logger.error('Error loading total sales:', error);
        this.totalSales.set(0);
      }
    });
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

  private loadDayMenu() {
    this.dayMenuService.getCurrentDayMenu().pipe(
      switchMap(menu => {
        // 204 No Content llega como null
        if (!menu) {
          this.dayMenu.set(null);
          this.existDayMenu = false;
          return of([] as ProductOption[]);
        }
        this.dayMenu.set(menu);
        this.existDayMenu = true;
        this.loadingDayMenuOptions.set(true);
        return this.productService.getOptions(menu.productId).pipe(
          catchError(() => of([] as ProductOption[]))
        );
      }),
      catchError(() => {
        this.dayMenu.set(null);
        this.existDayMenu = false;
        return of([] as ProductOption[]);
      })
    ).subscribe(opts => {
      this.dayMenuOptions.set(opts);
      this.loadingDayMenuOptions.set(false);
    });
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
        this.selectedProduct.set(product || null);
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
}
