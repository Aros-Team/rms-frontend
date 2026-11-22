import { Component, ChangeDetectionStrategy, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { Combos } from '@areas/worker/features/waiter/combos/combos';
import { Products } from '@areas/worker/features/waiter/products/products';
import { TodayOrders } from '@areas/worker/features/waiter/today-orders/today-orders';
import { WaiterTablePicker } from '@areas/worker/features/waiter/table-picker/table-picker';
import { OrderDock, tableStatusLabel } from '@app/core/services/order-dock/order-dock';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import type { RmsStatus } from '@app/shared/ui/types/ui-types';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';

type TabId = 'menu' | 'carta' | 'pedidos';

const VALID_TABS: readonly TabId[] = ['menu', 'carta', 'pedidos'];

const TABLE_TONE: Record<TableResponse['status'], RmsStatus> = {
  AVAILABLE: 'success',
  OCCUPIED: 'info',
  RESERVED: 'warning',
};

const PAGE_COPY: Record<TabId, { title: string; subtitle: string }> = {
  menu: {
    title: 'Menú del día',
    subtitle: 'Combos disponibles en este horario.',
  },
  carta: {
    title: 'Carta',
    subtitle: 'Busca, elige opciones y arma el pedido.',
  },
  pedidos: {
    title: 'Pedidos',
    subtitle: 'Estado de los pedidos de hoy.',
  },
};

function isValidTab(value: string | null): value is TabId {
  return value !== null && (VALID_TABS as readonly string[]).includes(value);
}

/**
 * Waiter workspace.
 *
 * The shell owns the bottom navigation (Menú / Carta / Pedidos / Cuenta); this
 * component only switches the tab content from the `tab` query param and
 * renders the shared table context.
 */
@Component({
  selector: 'app-waiter-dashboard',
  templateUrl: './waiter-dashboard.html',
  styleUrl: './waiter-dashboard.css',
  imports: [CommonModule, Combos, Products, TodayOrders, WaiterTablePicker, RmsButton, RmsPageHeader, RmsStatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaiterDashboard {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dock = inject(OrderDock);

  readonly activeTab = signal<TabId>('menu');
  readonly tablePickerOpen = signal(false);

  readonly pageTitle = computed(() => PAGE_COPY[this.activeTab()].title);
  readonly pageSubtitle = computed(() => PAGE_COPY[this.activeTab()].subtitle);

  readonly selectedTable = computed(() => this.dock.selectedTable());
  readonly tableLabel = computed(() => this.dock.selectedTableLabel());
  readonly tableStatusText = computed(() => {
    const table = this.selectedTable();
    return table ? tableStatusLabel(table.status) : 'Sin mesa';
  });
  readonly tableTone = computed<RmsStatus>(() => {
    const table = this.selectedTable();
    return table ? TABLE_TONE[table.status] : 'neutral';
  });

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

  openTablePicker(): void {
    this.tablePickerOpen.set(true);
  }
}
