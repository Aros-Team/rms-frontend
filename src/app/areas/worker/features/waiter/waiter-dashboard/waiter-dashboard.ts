import { Component, ChangeDetectionStrategy, DestroyRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { DayMenu } from '@areas/worker/features/waiter/day-menu/day-menu';
import { TakeOrder } from '@areas/worker/features/waiter/take-order/take-order';
import { TodayOrders } from '@areas/worker/features/waiter/today-orders/today-orders';
import { Auth } from '@app/core/services/auth/auth';
import { OrderDock } from '@app/core/services/order-dock/order-dock';

type TabId = 'menu' | 'carta' | 'pedidos';

const VALID_TABS: readonly TabId[] = ['menu', 'carta', 'pedidos'];

function isValidTab(value: string | null): value is TabId {
  return value !== null && (VALID_TABS as readonly string[]).includes(value);
}

interface DashboardTab {
  id: TabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-waiter-dashboard',
  templateUrl: './waiter-dashboard.html',
  styleUrl: './waiter-dashboard.css',
  imports: [CommonModule, DayMenu, TakeOrder, TodayOrders],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaiterDashboard {
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  protected dock = inject(OrderDock);

  activeTab = signal<TabId>('menu');

  tabs: DashboardTab[] = [
    { id: 'menu',    label: 'Menú del Día', icon: 'pi pi-sun' },
    { id: 'carta',   label: 'Carta',        icon: 'pi pi-book' },
    { id: 'pedidos', label: 'Pedidos',      icon: 'pi pi-list' },
  ];

  userName = computed(() => {
    const u = this.auth.getData();
    return u?.name ?? 'Mesero';
  });

  constructor() {
    const sub = this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      if (isValidTab(tab)) {
        this.activeTab.set(tab);
      }
    });
    this.destroyRef.onDestroy(() => { sub.unsubscribe(); });
  }

  setTab(id: TabId): void {
    if (this.activeTab() === id) {
      return;
    }
    this.activeTab.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id },
      replaceUrl: true,
    });
  }
}
