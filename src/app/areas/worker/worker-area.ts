import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, DestroyRef, ChangeDetectorRef, effect } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { Layout } from '@app/shared/layout/layout';
import { Menu, MenuItem } from '@app/core/services/menu/menu';
import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { Notification } from '@app/core/services/notifications/notification';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-worker-area',
  templateUrl: './worker-area.html',
  imports: [Layout, RouterOutlet, ToastModule],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkerArea implements OnInit, OnDestroy {
  private menuService = inject(Menu);
  private authService = inject(Auth);
  private logger = inject(Logging);
  private notificationService = inject(Notification);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  workerType = 'waiter';
  hideSidebar = false;
  role = 'WORKER';

  constructor() {
    // effect() must be called in injection context (constructor or field initializer)
    effect(() => {
      const orders = this.notificationService.unseenReadyOrders();
      if (orders.length > 0) {
        orders.forEach(order => {
          const tableName = order.table || `Mesa ${order.tableId}`;
          this.messageService.add({
            severity: 'info',
            summary: 'Orden lista para entregar',
            detail: `${tableName} - Orden #${order.id}`,
            life: 10000,
            sticky: true
          });
        });
        this.notificationService.markAllAsSeen();
      }
    });
  }

  ngOnInit(): void {
    this.determineRole();
    this.determineWorkerType();
    this.configureWorkerMenu();
    this.startNotifications();
    this.setupRouterListener();
  }

  private setupRouterListener(): void {
    const sub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.cdr.markForCheck();
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

ngOnDestroy(): void {
    this.notificationService.stopPolling();
  }

  private startNotifications(): void {
    if (this.workerType === 'waiter') {
      this.notificationService.startPolling();
    }
  }

  private determineRole(): void {
    const userData = this.authService.getData();
    this.role = userData?.role || 'WORKER';
    this.logger.debug('WorkerArea: User role:', this.role);
  }

  private determineWorkerType(): void {
    const userData = this.authService.getData();
    this.logger.debug('WorkerArea: Determining worker type from user data:', userData);

    if (userData && userData.areas) {
      const workerAreas = ['WAITER', 'KITCHEN', 'BAR', 'CASHIER'];

      for (const area of userData.areas) {
        const areaName = area.name.toUpperCase();
        if (workerAreas.includes(areaName)) {
          this.workerType = areaName.toLowerCase();
          this.logger.debug(`WorkerArea: Determined worker type as '${this.workerType}' from area '${area.name}'`);
          return;
        }
      }

      if (userData.areas.some(area => area.name === 'ADMINISTRATION')) {
        this.logger.warn('WorkerArea: Admin user in worker area, defaulting to waiter');
        this.workerType = 'waiter';
      } else {
        this.logger.warn('WorkerArea: No recognized worker area found, defaulting to waiter');
        this.workerType = 'waiter';
      }
    } else {
      this.logger.warn('WorkerArea: No user data available, defaulting to waiter');
      this.workerType = 'waiter';
    }
  }

  private configureWorkerMenu(): void {
    const workerMenuItems: MenuItem[] = [
      {
        id: 'take-order',
        label: 'Tomar Orden',
        description: 'Crear nueva orden',
        icon: 'pi pi-plus-circle',
        routerLink: '/worker/take-order'
      },
      {
        id: 'orders',
        label: 'Órdenes del Día',
        description: 'Ver pedidos del día',
        icon: 'pi pi-list',
        routerLink: '/worker/orders'
      },
      {
        id: 'kitchen',
        label: 'Cocina',
        description: 'Pedidos en preparación',
        icon: 'pi pi-box',
        routerLink: '/worker/kitchen'
      },
      {
        id: 'day-menu',
        label: 'Menú del Día',
        description: 'Ver menú del día',
        icon: 'pi pi-calendar',
        routerLink: '/worker/day-menu'
      },
      {
        id: 'profile',
        label: 'Configuración',
        description: 'Ajustes de cuenta',
        icon: 'pi pi-cog',
        routerLink: '/worker/profile'
      }
    ];

    this.menuService.setMenuItems(workerMenuItems);
  }
}