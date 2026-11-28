import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { Combos } from '@areas/worker/features/waiter/combos/combos';
import { Products } from '@areas/worker/features/waiter/products/products';
import { TodayOrders } from '@areas/worker/features/waiter/today-orders/today-orders';

type TabId = 'menu' | 'carta' | 'pedidos';

const VALID_TABS: readonly TabId[] = ['menu', 'carta', 'pedidos'];

const PAGE_TITLE: Record<TabId, string> = {
  menu: 'Menú del día',
  carta: 'Carta',
  pedidos: 'Pedidos',
};

function isValidTab(value: string | null): value is TabId {
  return value !== null && (VALID_TABS as readonly string[]).includes(value);
}

/**
 * Waiter workspace.
 *
 * The shell owns the bottom navigation (Menú / Carta / Pedidos / Cuenta); this
 * component only switches the tab content from the `tab` query param. Table
 * context lives in the floating order dock, so the screen stays free of
 * repeated headings and toolbars.
 */
@Component({
  selector: 'app-waiter-dashboard',
  templateUrl: './waiter-dashboard.html',
  styleUrl: './waiter-dashboard.css',
  imports: [CommonModule, Combos, Products, TodayOrders],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaiterDashboard {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeTab = signal<TabId>('menu');

  readonly pageTitle = computed(() => PAGE_TITLE[this.activeTab()]);

  constructor() {
    const sub = this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (isValidTab(tab)) {
        this.activeTab.set(tab);
      }
    });
    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }
}
