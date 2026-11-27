import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { Area } from '@app/core/services/areas/area';
import { FloorLayoutApi } from '@app/core/services/floor-layout/floor-layout';
import { OrderDock, tableStatusLabel } from '@app/core/services/order-dock/order-dock';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type {
  FloorLayout,
  FloorTablePlacement,
} from '@app/shared/models/dto/floor-layout/floor-layout';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';
import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsSheet } from '@app/shared/ui/sheet/sheet';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import type { RmsStatus } from '@app/shared/ui/types/ui-types';

import { TableFloorBoard } from '../../../../admin/features/manage/features/tables/components/table-floor-board/table-floor-board';

const STATUS_TONE: Record<TableResponse['status'], RmsStatus> = {
  AVAILABLE: 'success',
  OCCUPIED: 'info',
  RESERVED: 'warning',
};

/**
 * Waiter table picker.
 *
 * Feature: choose the table that will receive the order from the restaurant
 * floor map, with real occupancy.
 *
 * Contract:
 *  - the floor distribution is shown with every placed table;
 *  - only free tables (and the current selection) are selectable, so the
 *    waiter cannot open a second order on an occupied table;
 *  - free tables that have no map position stay reachable in a compact list;
 *  - selection is stored in the shared `OrderDock` service, so it survives tab
 *    changes, product browsing and the send confirmation.
 */
@Component({
  selector: 'app-waiter-table-picker',
  templateUrl: './table-picker.html',
  styleUrl: './table-picker.css',
  imports: [RmsBadge, RmsButton, RmsSheet, RmsStatusPill, TableFloorBoard],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaiterTablePicker {
  readonly dock = inject(OrderDock);
  private readonly floorLayoutApi = inject(FloorLayoutApi);
  private readonly areaService = inject(Area);
  private readonly destroyRef = inject(DestroyRef);

  private openState = false;

  @Input()
  set open(value: boolean) {
    const wasOpen = this.openState;
    this.openState = value;
    if (value && !wasOpen) this.loadMap();
  }

  get open(): boolean {
    return this.openState;
  }

  @Output() readonly openChange = new EventEmitter<boolean>();

  readonly layout = signal<FloorLayout | null>(null);
  readonly placements = signal<readonly FloorTablePlacement[]>([]);
  readonly areas = signal<readonly AreaResponse[]>([]);
  readonly mapLoading = signal(false);
  readonly mapError = signal<string | null>(null);
  readonly selectionError = signal<string | null>(null);

  readonly freeTables = computed(() =>
    this.dock
      .allTables()
      .filter((table) => table.status === 'AVAILABLE' && table.id !== this.dock.selectedTableId()),
  );

  readonly unplacedFreeTables = computed(() => {
    const placed = new Set(this.placements().map((placement) => placement.tableId));
    return this.freeTables().filter((table) => !placed.has(table.id));
  });

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
    if (!this.dock.canSelectTable(table)) {
      this.selectionError.set(`La mesa ${String(table.tableNumber)} no está disponible.`);
      return;
    }
    this.selectionError.set(null);
    this.dock.selectTable(table.id);
    this.close();
  }

  chooseById(tableId: number | null): void {
    if (tableId === null) return;
    const table = this.dock.allTables().find((item) => item.id === tableId);
    if (table === undefined) return;
    this.choose(table);
  }

  clear(): void {
    this.dock.resetTableSelection();
    this.close();
  }

  refresh(): void {
    this.dock.loadAvailableTables();
    this.loadMap();
  }

  close(): void {
    this.openState = false;
    this.openChange.emit(false);
  }

  private loadMap(): void {
    this.mapLoading.set(true);
    this.mapError.set(null);
    forkJoin({
      map: this.floorLayoutApi.getMap(),
      areas: this.areaService.getAreas(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ map, areas }) => {
          this.layout.set(map.layout);
          this.placements.set(map.tables);
          this.areas.set(areas);
          this.mapLoading.set(false);
        },
        error: (error: unknown) => {
          this.mapError.set(
            extractProblemDetail(error) ?? 'No se pudo cargar la distribución del restaurante.',
          );
          this.mapLoading.set(false);
        },
      });
  }
}
