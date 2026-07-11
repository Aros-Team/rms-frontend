import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, DestroyRef, ChangeDetectorRef, effect, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { Menu, MenuItem } from '@app/core/services/menu/menu';
import { Notification } from '@app/core/services/notifications/notification';
import { OrderDock } from '@app/core/services/order-dock/order-dock';
import { WorkerLayout } from '@app/shared/layout/worker-layout';
import { OrderDock as OrderDockPanel } from '@app/shared/components/order-dock/order-dock';

@Component({
  selector: 'app-worker-area',
  templateUrl: './worker-area.html',
  styleUrl: './worker-area.css',
  imports: [WorkerLayout, RouterOutlet, ToastModule, OrderDockPanel],
  providers: [MessageService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkerArea implements OnInit, OnDestroy {
  private menuService = inject(Menu);
  private authService = inject(Auth);
  private logger = inject(Logging);
  private notificationService = inject(Notification);
  // OrderDock service injected here so the singleton lives in the worker shell
  // and persists across tab switches inside /worker?tab=*.
  protected dock = inject(OrderDock);
  private messageService = inject(MessageService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  workerType = signal('');
  canOrder = signal(false);
  role = 'WORKER';

  constructor() {
    // effect() must be called in injection context (constructor or field initializer)
    effect(() => {
      const orders = this.notificationService.unseenReadyOrders();
      if (orders.length > 0) {
        orders.forEach(order => {
          const tableName = order.table ?? `Mesa ${String(order.tableId)}`;
          this.messageService.add({
            severity: 'info',
            summary: 'Orden lista para entregar',
            detail: `${tableName} - Orden #${String(order.id)}`,
            life: 10000,
            sticky: true
          });
        });
        this.notificationService.markAllAsSeen();
      }
    });
  }

  ngOnInit(): void {
    void this.waitForUserData().then(() => {
      this.determineRole();
      this.determineWorkerType();
      this.computeCanOrder();
      this.cdr.markForCheck();
      this.configureWorkerMenu();
      this.startNotifications();
      this.setupRouterListener();
    });
  }

  private computeCanOrder(): void {
    const userData = this.authService.getData();
    const canOrder = userData?.areas.some(
      a => a.type === 'SERVICE' || a.type === 'WAITER'
    ) ?? false;
    this.canOrder.set(canOrder);
    this.logger.debug(`WorkerArea: canOrder=${String(canOrder)} based on user areas`);
  }

  private waitForUserData(): Promise<void> {
    const userData = this.authService.getData();
    if (userData) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      const check = () => {
        if (this.authService.getData()) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      setTimeout(check, 100);
    });
  }

  private setupRouterListener(): void {
    const sub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.cdr.markForCheck();
    });
    this.destroyRef.onDestroy(() => { sub.unsubscribe(); });
  }

ngOnDestroy(): void {
    this.notificationService.stopPolling();
  }

  private startNotifications(): void {
    if (this.workerType() === 'waiter' || this.workerType() === 'service') {
      this.notificationService.startPolling();
    }
  }

  private determineRole(): void {
    const userData = this.authService.getData();
    this.role = userData?.role ?? 'WORKER';
    this.logger.debug('WorkerArea: User role:', this.role);
  }

  private determineWorkerType(): void {
    const userData = this.authService.getData();
    this.logger.debug('WorkerArea: Determining worker type from user data:', userData);

    if (!userData?.areas) {
      this.logger.warn('WorkerArea: No user data or areas available');
      void this.router.navigate(['/login']);
      return;
    }

    // Priority-based selection: SERVICE > WAITER > KITCHEN > BAR > CASHIER
    const priority = ['service', 'waiter', 'kitchen', 'bar', 'cashier'];
    for (const p of priority) {
      if (userData.areas.some(a => a.type?.toLowerCase() === p)) {
        this.workerType.set(p);
        this.logger.debug(`WorkerArea: Determined worker type as '${this.workerType()}' via priority selection`);
        return;
      }
    }

    this.logger.warn('WorkerArea: No recognized worker area found');
    void this.router.navigate(['/login']);
  }

  private configureWorkerMenu(): void {
    const restrictedIds = new Set(['take-order', 'orders', 'kitchen']);

    const waiterItems: MenuItem[] = [
      {
        id: 'take-order',
        label: 'Carta',
        description: 'Seleccionar productos',
        icon: 'pi pi-book',
        routerLink: '/worker?tab=carta'
      },
      {
        id: 'orders',
        label: 'Pedidos',
        description: 'Ver pedidos del día',
        icon: 'pi pi-list',
        routerLink: '/worker?tab=pedidos'
      },
      {
        id: 'day-menu',
        label: 'Menú del día',
        description: 'Ver menú del día',
        icon: 'pi pi-calendar',
        routerLink: '/worker?tab=menu'
      },
      {
        id: 'my-schedule',
        label: 'Mi Horario',
        description: 'Ver turnos asignados',
        icon: 'pi pi-clock',
        routerLink: '/worker/my-schedule'
      },
      {
        id: 'profile',
        label: 'Configuración',
        description: 'Ajustes de cuenta',
        icon: 'pi pi-cog',
        routerLink: '/worker/profile'
      }
    ];

    const kitchenItems: MenuItem[] = [];

    const allItems = this.workerType() === 'kitchen' ? kitchenItems : waiterItems;
    const items = this.authService.isRestricted()
      ? allItems.filter(item => !restrictedIds.has(item.id))
      : allItems;
    this.menuService.setMenuItems(items);
  }
}