import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DayMenu } from '@areas/worker/features/waiter/day-menu/day-menu';
import { TakeOrder } from '@areas/worker/features/waiter/take-order/take-order';
import { TodayOrders } from '@areas/worker/features/waiter/today-orders/today-orders';
import { OrderDockComponent } from '@app/shared/components/order-dock/order-dock';
import { Auth } from '@app/core/services/auth/auth';
import { OrderDock } from '@app/core/services/order-dock/order-dock';

type TabId = 'menu' | 'carta' | 'pedidos';

interface DashboardTab {
  id: TabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-waiter-dashboard',
  templateUrl: './waiter-dashboard.html',
  styleUrl: './waiter-dashboard.css',
  imports: [CommonModule, DayMenu, TakeOrder, TodayOrders, OrderDockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaiterDashboard {
  private auth = inject(Auth);
  dock = inject(OrderDock);

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

  setTab(id: TabId): void {
    this.activeTab.set(id);
  }
}
