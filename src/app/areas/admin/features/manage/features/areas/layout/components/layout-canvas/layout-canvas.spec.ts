import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryElement, resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { LayoutCanvas } from './layout-canvas';
import canvasHtml from './layout-canvas.html?raw';

function layout() {
  return {
    columns: 10,
    rows: 10,
    regions: [
      {
        key: 'a',
        areaId: 1,
        cells: new Set(['0:0', '0:1']),
      },
      {
        key: 'b',
        areaId: 2,
        cells: new Set(['5:5']),
      },
    ],
  };
}

function pointer(x: number, y: number, pointerId = 1): PointerEvent {
  return {
    button: 0,
    pointerId,
    clientX: x,
    clientY: y,
    preventDefault: vi.fn(),
  } as unknown as PointerEvent;
}

describe('LayoutCanvas', () => {
  let fixture: ComponentFixture<LayoutCanvas>;
  let component: LayoutCanvas;

  beforeAll(async () => {
    await resolveUiResources({ 'layout-canvas.html': canvasHtml as unknown as string });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [LayoutCanvas] });
    fixture = TestBed.createComponent(LayoutCanvas);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('layout', layout());
    fixture.componentRef.setInput('tool', 'draw');
    fixture.componentRef.setInput('zoom', 1);
    fixture.componentRef.setInput('areas', [
      { id: 1, name: 'Cocina', activities: ['PREPARATION'], enabled: true, exclusive: false },
      { id: 2, name: 'Bar', activities: ['SERVE'], enabled: true, exclusive: false },
    ]);
    fixture.componentRef.setInput('selectedAreaId', 1);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const svg = queryElement(host, 'svg');
    svg.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 240, height: 240, right: 240, bottom: 240 }) as DOMRect;
    svg.setPointerCapture = vi.fn();
    svg.releasePointerCapture = vi.fn();
    component.refreshViewport();
    fixture.detectChanges();
  });

  it('should emit a stroke as cells and close it on pointer up', () => {
    const painted: string[][] = [];
    const starts = vi.fn();
    const ends = vi.fn();
    component.paintCells.subscribe((cells: readonly string[]) => {
      painted.push([...cells]);
    });
    component.strokeStart.subscribe(starts);
    component.strokeEnd.subscribe(ends);

    component.onPointerDown(pointer(36, 36));
    component.onPointerMove(pointer(84, 36));
    component.onPointerUp(pointer(84, 36));

    expect(starts).toHaveBeenCalledTimes(1);
    expect(ends).toHaveBeenCalledTimes(1);
    expect(painted[0]).toHaveLength(1);
    expect(painted.length).toBeGreaterThan(1);
  });

  it('should pan into negative camera space', () => {
    fixture.componentRef.setInput('tool', 'pan');
    fixture.detectChanges();

    component.onPointerDown(pointer(120, 120));
    component.onPointerMove(pointer(320, 220));
    component.onPointerUp(pointer(320, 220));

    const viewBox = component.frame().viewBox.split(' ').map(Number);
    expect(viewBox[0]).toBeLessThan(0);
    expect(viewBox[1]).toBeLessThan(0);
  });

  it('should render one merged area boundary and a separate selection outline', () => {
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const area = queryElement(host, 'g.area-shape');
    expect(area.getAttribute('data-color')).toBe('1');
    expect(area.querySelector('.area-shape__outline')?.getAttribute('d')).toContain('M0 0L1 0');
    expect(host.querySelectorAll('g.area-shape')).toHaveLength(2);
    expect(queryElement(host, '.region-selection').getAttribute('d')).toContain('M0 0L1 0');
    expect(host.querySelector('svg')?.getAttribute('aria-label')).toContain('Lienzo de distribución');
  });
});
