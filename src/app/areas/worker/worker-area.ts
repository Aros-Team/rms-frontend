import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';

import { Layout } from '@app/shared/layout/layout';
import { MenuService, MenuItem } from '@app/core/services/menu/menu-service';
import { AuthService } from '@app/core/services/authentication/auth-service';
import { LoggingService } from '@app/core/services/logging/logging-service';
import { NotificationService } from '@app/core/services/notifications/notification.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-worker-area',
  templateUrl: './worker-area.html',
  imports: [Layout, RouterOutlet, ToastModule],
  providers: [MessageService]
})
export class WorkerArea implements OnInit, OnDestroy {
  private menuService = inject(MenuService);
  private authService = inject(AuthService);
  private loggingService = inject(LoggingService);
  private notificationService = inject(NotificationService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  workerType = 'waiter';
  hideSidebar = false;
  role = 'WORKER';

  ngOnInit(): void {
    this.determineRole();
    this.determineWorkerType();
    this.configureWorkerMenu();
    this.startNotifications();
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
  }

  private startNotifications(): void {
    if (this.workerType === 'waiter') {
      this.notificationService.startPolling();

      setInterval(() => {
        const orders = this.notificationService.unseenReadyOrders();
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

        if (orders.length > 0) {
          this.notificationService.markAllAsSeen();
        }
      }, 1000);
    }
  }

  private determineRole(): void {
    const userData = this.authService.getData();
    this.role = userData?.role || 'WORKER';
    this.loggingService.debug('WorkerArea: User role:', this.role);
  }

  private determineWorkerType(): void {
    const userData = this.authService.getData();
    this.loggingService.debug('WorkerArea: Determining worker type from user data:', userData);

    if (userData && userData.areas) {
      const workerAreas = ['WAITER', 'KITCHEN', 'BAR', 'CASHIER'];

      for (const area of userData.areas) {
        const areaName = area.name.toUpperCase();
        if (workerAreas.includes(areaName)) {
          this.workerType = areaName.toLowerCase();
          this.loggingService.debug(`WorkerArea: Determined worker type as '${this.workerType}' from area '${area.name}'`);
          return;
        }
      }

      if (userData.areas.some(area => area.name === 'ADMINISTRATION')) {
        this.loggingService.warn('WorkerArea: Admin user in worker area, defaulting to waiter');
        this.workerType = 'waiter';
      } else {
        this.loggingService.warn('WorkerArea: No recognized worker area found, defaulting to waiter');
        this.workerType = 'waiter';
      }
    } else {
      this.loggingService.warn('WorkerArea: No user data available, defaulting to waiter');
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