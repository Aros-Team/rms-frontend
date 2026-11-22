/**
 * Tests for the waiter table picker.
 *
 * Feature: choose a table using real occupancy.
 * Contract:
 *  - only AVAILABLE tables are offered as selectable;
 *  - the current table is shown as context and never duplicated in the free
 *    grid;
 *  - occupied and reserved tables are listed with a readable status;
 *  - the accessible name states number, status and capacity.
 *
 * Approach: instantiate the component in the TestBed injection context with
 * the real cart service and assert its computed lists and labels.
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrderDock } from '@app/core/services/order-dock/order-dock';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { Order } from '@app/core/services/orders/order';
import type { TableResponse } from '@app/shared/models/dto/tables/table-response';
import { WaiterTablePicker } from './table-picker';

const tables: TableResponse[] = [
  { id: 1, tableNumber: 1, capacity: 4, status: 'AVAILABLE' },
  { id: 2, tableNumber: 2, capacity: 2, status: 'OCCUPIED' },
  { id: 3, tableNumber: 3, capacity: 6, status: 'RESERVED' },
  { id: 4, tableNumber: 4, capacity: 4, status: 'AVAILABLE' },
];

function mount(): { picker: WaiterTablePicker; cart: OrderDock } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: Order, useValue: {} },
      { provide: Logging, useValue: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      { provide: MasterData, useValue: { reloadTables: () => of(tables) } },
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

  it('offers only free tables and keeps the current one out of the list', () => {
    const { picker, cart } = mount();
    cart.selectTable(1);

    expect(picker.freeTables().map((table) => table.id)).toEqual([4]);
    expect(picker.busyTables().map((table) => table.id)).toEqual([2, 3]);
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
