import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsSheet } from '@app/shared/ui/sheet/sheet';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import type { RmsStatus } from '@app/shared/ui/types/ui-types';
import { OrderDock, tableStatusLabel } from '@app/core/services/order-dock/order-dock';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';

const STATUS_TONE: Record<TableResponse['status'], RmsStatus> = {
  AVAILABLE: 'success',
  OCCUPIED: 'info',
  RESERVED: 'warning',
};

/**
 * Waiter table picker.
 *
 * Feature: choose the table that will receive the order, with real occupancy.
 *
 * Contract:
 *  - every table renders its number, capacity and status;
 *  - only free tables (and the current selection) are selectable, so the
 *    waiter cannot open a second order on an occupied table;
 *  - tiles are at least 56px tall so they are thumb targets at 320px;
 *  - selection is stored in the shared `OrderDock` service, so it survives tab
 *    changes, product browsing and the send confirmation.
 */
@Component({
  selector: 'app-waiter-table-picker',
  templateUrl: './table-picker.html',
  styleUrl: './table-picker.css',
  imports: [RmsBadge, RmsButton, RmsSheet, RmsStatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaiterTablePicker {
  readonly dock = inject(OrderDock);

  @Input() open = false;
  @Output() readonly openChange = new EventEmitter<boolean>();

  readonly freeTables = computed(() =>
    this.dock
      .allTables()
      .filter((table) => table.status === 'AVAILABLE' && table.id !== this.dock.selectedTableId()),
  );

  readonly busyTables = computed(() =>
    this.dock
      .allTables()
      .filter((table) => table.status !== 'AVAILABLE' && table.id !== this.dock.selectedTableId()),
  );

  readonly selectedTable = computed(() => this.dock.selectedTable());

  statusLabel(status: TableResponse['status']): string {
    return tableStatusLabel(status);
  }

  tone(status: TableResponse['status']): RmsStatus {
    return STATUS_TONE[status];
  }

  tableLabel(table: TableResponse): string {
    return `Mesa ${String(table.tableNumber)} · ${tableStatusLabel(table.status)} · ${String(table.capacity)} puestos`;
  }

  choose(table: TableResponse): void {
    if (!this.dock.canSelectTable(table)) return;
    this.dock.selectTable(table.id);
    this.close();
  }

  clear(): void {
    this.dock.resetTableSelection();
    this.close();
  }

  refresh(): void {
    this.dock.loadAvailableTables();
  }

  close(): void {
    this.open = false;
    this.openChange.emit(false);
  }
}
