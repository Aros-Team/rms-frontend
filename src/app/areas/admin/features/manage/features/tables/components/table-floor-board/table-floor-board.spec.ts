import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type { FloorLayout } from '@app/shared/models/dto/floor-layout/floor-layout';
import { queryElement, resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { TableFloorBoard } from './table-floor-board';
import boardHtml from './table-floor-board.html?raw';

const AREAS: AreaResponse[] = [
  { id: 1, name: 'Salón', activities: ['SERVE'], enabled: true, exclusive: false },
  { id: 2, name: 'Cocina', activities: ['PREPARATION'], enabled: true, exclusive: false },
];

const LAYOUT: FloorLayout = {
  columns: 12,
  rows: 10,
  regions: [
    { key: 'a', areaId: 1, segments: [{ row: 2, from: 2, to: 6 }] },
    { key: 'b', areaId: 2, segments: [{ row: 5, from: 2, to: 4 }] },
  ],
  updatedAt: null,
};

const TABLES = [{ id: 7, tableNumber: 7, capacity: 4, status: 'AVAILABLE' as const }];

describe('TableFloorBoard', () => {
  let fixture: ComponentFixture<TableFloorBoard>;

  beforeAll(async () => {
    await resolveUiResources({ 'table-floor-board.html': boardHtml as unknown as string });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TableFloorBoard] });
    fixture = TestBed.createComponent(TableFloorBoard);
    fixture.componentRef.setInput('layout', LAYOUT);
    fixture.componentRef.setInput('areas', AREAS);
    fixture.componentRef.setInput('tables', TABLES);
  });

  it('should highlight only enabled serve areas as drop zones', () => {
    fixture.componentRef.setInput('placements', []);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.table-floor__area--serve')).toHaveLength(1);
    expect(host.textContent).toContain('Salón');
    expect(host.textContent).toContain('Cocina');
  });

  it('should render placed tables and mark invalid placements', () => {
    fixture.componentRef.setInput('placements', [
      { tableId: 7, row: 2, column: 2 },
    ]);
    fixture.detectChanges();
    expect(queryElement(fixture.nativeElement as HTMLElement, '.table-floor__table-label').textContent).toContain('7');

    fixture.componentRef.setInput('placements', [
      { tableId: 7, row: 9, column: 9 },
    ]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.table-floor__table--invalid')).not.toBeNull();
  });

  it('should emit a selection instead of dragging in read-only mode', () => {
    const selected: (number | null)[] = [];
    fixture.componentInstance.tableSelected.subscribe((id) => selected.push(id));
    fixture.componentRef.setInput('placements', [{ tableId: 7, row: 2, column: 2 }]);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const marker = queryElement(fixture.nativeElement as HTMLElement, '.table-floor__table');
    marker.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));

    expect(selected).toEqual([7]);
    expect((fixture.nativeElement as HTMLElement).querySelector('.table-floor--readonly')).not.toBeNull();
  });

  it('should show an empty state when the area map is empty', () => {
    const empty: FloorLayout = { columns: 12, rows: 10, regions: [], updatedAt: null };
    fixture.componentRef.setInput('layout', empty);
    fixture.componentRef.setInput('placements', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Aún no hay una distribución de áreas para ubicar mesas.',
    );
  });
});
