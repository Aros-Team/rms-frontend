import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';

import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { Notification } from '@app/core/services/notifications/notification';
import { OrderDock } from '@app/core/services/order-dock/order-dock';
import { WorkerLayout } from '@app/shared/layout/worker-layout/worker-layout';
import { OrderDock as OrderDockPanel } from '@app/shared/components/order-dock/order-dock';
import type { WorkerWorkspace } from '@app/core/config/navigation/role-navigation';
import {
  isServiceWorker,
  primaryWorkerWorkspace,
} from '@app/core/config/navigation/role-navigation';

/** Chrome for a URL, or `null` when the route does not identify a workspace. */
function workspaceForUrl(url: string): WorkerWorkspace | null {
  if (url.startsWith('/worker/kitchen')) {
    return 'kitchen';
  }
  if (url.startsWith('/worker/cashier')) {
    return 'cashier';
  }
  if (url.startsWith('/worker/waiter') || url.startsWith('/worker/combos')) {
    return 'waiter';
  }
  return null;
}

@Component({
  selector: 'app-worker-area',
  templateUrl: './worker-area.html',
  styleUrl: './worker-area.css',
  imports: [WorkerLayout, RouterOutlet, ToastModule, OrderDockPanel],
  providers: [MessageService],
  host: { '[class.has-order-dock]': 'canOrder()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkerArea implements OnInit, OnDestroy {
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

  /** Chrome the layout renders: waiter (bottom nav), kitchen (none), cashier. */
  workspace = signal<WorkerWorkspace>('waiter');
  canOrder = signal(false);
  role = 'WORKER';

  constructor() {
    // effect() must be called in injection context (constructor or field initializer)
    effect(() => {
      const orders = this.notificationService.unseenReadyOrders();
      if (orders.length > 0) {
        orders.forEach((order) => {
          const tableName = order.table ?? `Mesa ${String(order.tableId)}`;
          this.messageService.add({
            severity: 'info',
            summary: 'Orden lista para entregar',
            detail: `${tableName} - Orden #${String(order.id)}`,
            life: 10000,
            sticky: true,
          });
        });
        this.notificationService.markAllAsSeen();
      }
    });
  }

  ngOnInit(): void {
    void this.waitForUserData().then(() => {
      this.determineRole();
      this.determineWorkspace();
      this.cdr.markForCheck();
      this.startNotifications();
      this.setupRouterListener();
    });
  }

  private waitForUserData(): Promise<void> {
    const userData = this.authService.getData();
    if (userData) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
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
    const sub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const fromUrl = workspaceForUrl(event.urlAfterRedirects);
        if (fromUrl) {
          this.workspace.set(fromUrl);
        }
        this.cdr.markForCheck();
      });
    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
  }

  private startNotifications(): void {
    if (this.workspace() === 'waiter') {
      this.notificationService.startPolling();
    }
  }

  private determineRole(): void {
    const userData = this.authService.getData();
    this.role = userData?.role ?? 'WORKER';
    this.logger.debug('WorkerArea: User role:', this.role);
  }

  /**
   * Resolve the workspace from the assigned areas (SERVICE/BAR → waiter,
   * KITCHEN/GRILL → kitchen, CASH → cashier) and mirror it in `canOrder`.
   */
  private determineWorkspace(): void {
    const userData = this.authService.getData();
    if (!userData?.areas) {
      this.logger.warn('WorkerArea: No user data or areas available');
      void this.router.navigate(['/forbidden']);
      return;
    }

    const fromUrl = workspaceForUrl(this.router.url);
    const fromAreas = primaryWorkerWorkspace(userData);
    const workspace = fromUrl ?? fromAreas;

    if (!workspace) {
      this.logger.warn('WorkerArea: No recognized worker area found');
      void this.router.navigate(['/forbidden']);
      return;
    }

    this.workspace.set(workspace);
    this.canOrder.set(isServiceWorker(userData));
    this.logger.debug(`WorkerArea: workspace=${workspace}, canOrder=${String(this.canOrder())}`);
  }
}
