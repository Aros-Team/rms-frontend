/**
 * Tests for the waiter table picker.
 *
 * Feature: choose a table from the restaurant floor map using real occupancy.
 * Contract:
 *  - only AVAILABLE tables are selectable;
 *  - the current table is shown as context and never duplicated in the free
 *    list;
 *  - free tables without a map position stay reachable;
 *  - the accessible name states number, status and capacity.
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Area } from '@app/core/services/areas/area';
import { FloorLayoutApi } from '@app/core/services/floor-layout/floor-layout';
import { OrderDock } from '@app/core/services/order-dock/order-dock';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { Order } from '@app/core/services/orders/order';
import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type { FloorLayout } from '@app/shared/models/dto/floor-layout/floor-layout';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';
import { WaiterTablePicker } from './table-picker';

const tables: TableResponse[] = [
  { id: 1, tableNumber: 1, capacity: 4, status: 'AVAILABLE' },
  { id: 2, tableNumber: 2, capacity: 2, status: 'OCCUPIED' },
  { id: 3, tableNumber: 3, capacity: 6, status: 'RESERVED' },
  { id: 4, tableNumber: 4, capacity: 4, status: 'AVAILABLE' },
];

const AREAS: AreaResponse[] = [
  { id: 1, name: 'Salón', activities: ['SERVE'], enabled: true, exclusive: false },
];

const LAYOUT: FloorLayout = {
  columns: 8,
  rows: 6,
  regions: [{ key: 'r1', areaId: 1, segments: [{ row: 2, from: 1, to: 4 }] }],
  updatedAt: null,
};

interface MountOptions {
  placements?: { tableId: number; row: number; column: number }[];
}

function mount(options: MountOptions = {}): {
  picker: WaiterTablePicker;
  cart: OrderDock;
} {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: Order, useValue: {} },
      { provide: Logging, useValue: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      { provide: MasterData, useValue: { reloadTables: () => of(tables) } },
      {
        provide: FloorLayoutApi,
        useValue: { getMap: () => of({ layout: LAYOUT, tables: options.placements ?? [] }) },
      },
      { provide: Area, useValue: { getAreas: () => of(AREAS) } },
    ],
  });
  const cart = TestBed.inject(OrderDock);
  cart.allTables.set(tables);
  const picker = TestBed.runInInjectionContext(() => new WaiterTablePicker());
  return { picker, cart };
}

describe('WaiterTablePicker', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the floor map and placements when opened', () => {
    const { picker } = mount({ placements: [{ tableId: 1, row: 2, column: 2 }] });

    picker.open = true;

    expect(picker.layout()).toEqual(LAYOUT);
    expect(picker.placements()).toEqual([{ tableId: 1, row: 2, column: 2 }]);
    expect(picker.areas()).toEqual(AREAS);
    expect(picker.mapError()).toBeNull();
  });

  it('offers only free tables and keeps the current one out of the list', () => {
    const { picker, cart } = mount();
    cart.selectTable(1);

    expect(picker.freeTables().map((table) => table.id)).toEqual([4]);
  });

  it('lists free tables that have no position on the map', () => {
    const { picker } = mount({ placements: [{ tableId: 1, row: 2, column: 2 }] });
    picker.open = true;

    expect(picker.unplacedFreeTables().map((table) => table.id)).toEqual([4]);
  });

  it('selects a free table from the map', () => {
    const { picker, cart } = mount({ placements: [{ tableId: 1, row: 2, column: 2 }] });
    picker.open = true;

    picker.chooseById(1);

    expect(cart.selectedTableId()).toBe(1);
    expect(picker.selectionError()).toBeNull();
  });

  it('rejects an occupied table without selecting it', () => {
    const { picker, cart } = mount({ placements: [{ tableId: 2, row: 2, column: 2 }] });
    picker.open = true;

    picker.chooseById(2);

    expect(cart.selectedTableId()).toBeNull();
    expect(picker.selectionError()).toBe('La mesa 2 no está disponible.');
  });

  it('labels a table with number, status and capacity', () => {
    const { picker } = mount();
    const [table] = tables;

    expect(picker.tableLabel(table)).toBe('Mesa 1 · Disponible · 4 puestos');
  });

  it('maps table status to semantic tones', () => {
    const { picker } = mount();
    const [available, occupied, reserved] = tables;

    expect(picker.tone(available.status)).toBe('success');
    expect(picker.tone(occupied.status)).toBe('info');
    expect(picker.tone(reserved.status)).toBe('warning');
  });
});
