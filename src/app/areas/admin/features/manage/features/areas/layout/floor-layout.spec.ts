import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { Area } from '@app/core/services/areas/area';
import { FloorLayoutApi } from '@app/core/services/floor-layout/floor-layout';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { FloorLayout } from './floor-layout';
import { cellKey, layoutToDto } from './lib/geometry';

import pageHtml from './floor-layout.html?raw';
import areaPaletteHtml from './components/area-palette/area-palette.html?raw';
import canvasHtml from './components/layout-canvas/layout-canvas.html?raw';
import toolbarHtml from './components/layout-toolbar/layout-toolbar.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import dialogHtml from '@shared/ui/dialog/dialog.html?raw';
import emptyStateHtml from '@shared/ui/empty-state/empty-state.html?raw';
import fieldHtml from '@shared/ui/field/field.html?raw';
import iconButtonHtml from '@shared/ui/icon-button/icon-button.html?raw';
import inputHtml from '@shared/ui/input/input.html?raw';
import pageHeaderHtml from '@shared/ui/page-header/page-header.html?raw';
import skeletonHtml from '@shared/ui/skeleton/skeleton.html?raw';
import statusPillHtml from '@shared/ui/status-pill/status-pill.html?raw';

const AREA = {
  id: 1,
  name: 'Cocina',
  activities: ['PREPARATION'] as const,
  enabled: true,
  exclusive: false,
};

function layoutDto() {
  return {
    columns: 10,
    rows: 10,
    regions: [
      {
        key: 'a',
        areaId: 1,
        segments: [{ row: 9, from: 9, to: 9 }],
      },
    ],
    updatedAt: '2026-11-26T15:30:00Z',
  };
}

describe('FloorLayout', () => {
  let api: {
    getLayout: ReturnType<typeof vi.fn>;
    updateLayout: ReturnType<typeof vi.fn>;
  };
  let areaService: { getAreas: ReturnType<typeof vi.fn> };
  let component: FloorLayout;
  let fixture: ComponentFixture<FloorLayout>;

  beforeAll(async () => {
    await resolveUiResources({
      'floor-layout.html': pageHtml as unknown as string,
      'area-palette.html': areaPaletteHtml as unknown as string,
      'layout-canvas.html': canvasHtml as unknown as string,
      'layout-toolbar.html': toolbarHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'dialog.html': dialogHtml as unknown as string,
      'empty-state.html': emptyStateHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
      'icon-button.html': iconButtonHtml as unknown as string,
      'input.html': inputHtml as unknown as string,
      'page-header.html': pageHeaderHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
      'status-pill.html': statusPillHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      getLayout: vi.fn(() => of(layoutDto())),
      updateLayout: vi.fn((body: unknown) =>
        of({ ...(body as Record<string, unknown>), updatedAt: '2026-11-26T16:00:00Z' }),
      ),
    };
    areaService = { getAreas: vi.fn(() => of([{ ...AREA, activities: ['PREPARATION'] }])) };

    TestBed.configureTestingModule({
      imports: [FloorLayout],
      providers: [
        provideRouter([]),
        { provide: FloorLayoutApi, useValue: api },
        { provide: Area, useValue: areaService },
      ],
    });

    fixture = TestBed.createComponent(FloorLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('should load areas and the layout and start clean', () => {
    expect(component.loading()).toBe(false);
    expect(component.areas()).toHaveLength(1);
    expect(component.layout().regions).toHaveLength(1);
    expect(component.selectedAreaId()).toBe(1);
    expect(component.dirty()).toBe(false);
  });

  it('should change the selected area from the palette', () => {
    component.areas.set([
      { ...AREA, activities: ['PREPARATION'] },
      {
        id: 2,
        name: 'Salón',
        activities: ['SERVE'],
        enabled: true,
        exclusive: false,
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const buttons = host.querySelectorAll<HTMLButtonElement>('.area-item');
    expect(buttons).toHaveLength(2);

    buttons[1].click();
    fixture.detectChanges();

    expect(component.selectedAreaId()).toBe(2);
  });

  it('should paint, mark dirty and save the normalized document', () => {
    component.onStrokeStart();
    component.onPaintCells([cellKey(2, 2)]);
    component.onStrokeEnd();

    expect(component.dirty()).toBe(true);
    expect(component.layout().regions).toHaveLength(2);

    component.save();

    expect(api.updateLayout).toHaveBeenCalledTimes(1);
    const payload = api.updateLayout.mock.calls[0][0] as {
      regions: { key: string; segments: unknown[] }[];
    };
    expect(payload.regions).toHaveLength(2);
    expect(component.dirty()).toBe(false);
    expect(component.saving()).toBe(false);
  });

  it('should grow the canvas instead of blocking an edge stroke', () => {
    const before = component.layout().rows;

    component.onStrokeStart();
    component.onPaintCells([cellKey(9, 5)]);
    component.onStrokeEnd();

    expect(component.layout().rows).toBeGreaterThan(before);
    expect(component.layout().regions.some((region) => region.cells.has(cellKey(9, 5)))).toBe(true);
    expect(component.dirty()).toBe(true);
  });

  it('should ask before closing with unsaved changes', () => {
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component.onStrokeStart();
    component.onPaintCells([cellKey(2, 2)]);
    component.onStrokeEnd();

    component.requestClose();
    expect(component.discardVisible()).toBe(true);
    component.cancelDiscard();
    expect(closed).not.toHaveBeenCalled();

    component.requestClose();
    component.acceptDiscard();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('should block the browser unload while dirty', () => {
    component.onStrokeStart();
    component.onPaintCells([cellKey(2, 2)]);
    component.onStrokeEnd();

    const event = new Event('beforeunload', { cancelable: true });
    const prevent = vi.spyOn(event, 'preventDefault');
    component.onBeforeUnload(event as BeforeUnloadEvent);

    expect(prevent).toHaveBeenCalled();
  });

  it('should remove the selected area from the keyboard', () => {
    component.selectArea(1);
    expect(component.layout().regions.some((region) => region.areaId === 1)).toBe(true);

    component.onKeydown({
      key: 'Delete',
      target: document.body,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);

    expect(component.layout().regions.some((region) => region.areaId === 1)).toBe(false);
    expect(component.dirty()).toBe(true);
  });

  it('should not change the stored document when zooming', () => {
    const before = JSON.stringify(layoutToDto(component.layout()));

    component.zoomIn();
    component.zoomIn();
    component.zoomOut();

    expect(component.zoom()).not.toBe(1);
    expect(JSON.stringify(layoutToDto(component.layout()))).toBe(before);
  });

  it('should undo a stroke and return to the saved state', () => {
    component.onStrokeStart();
    component.onPaintCells([cellKey(2, 2)]);
    component.onStrokeEnd();
    expect(component.dirty()).toBe(true);

    component.undo();

    expect(component.layout().regions).toHaveLength(1);
    expect(component.dirty()).toBe(false);
  });
});
