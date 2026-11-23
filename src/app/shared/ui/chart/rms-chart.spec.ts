/**
 * Tests for the RmsChart primitive.
 *
 * Feature: the thin Chart.js canvas that replaces PrimeNG's `p-chart`
 * (which imported `chart.js/auto` and registered every chart type).
 * Contract:
 *  - the canvas is the labelled plot and the name comes from `ariaLabel`
 *  - a missing 2d context (SSR/jsdom) keeps the canvas and does not throw
 *  - the chart is created after render and destroyed with the component
 *  - a new `data` input replaces the previous chart instance
 *
 * Approach: mount the component with a minimal canvas context stub, then read
 * `Chart.getChart(canvas)` from the public registry.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Chart } from 'chart.js';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { resolveUiResources } from '../testing/ui-test-resources';
import { RmsChart } from './rms-chart';
import rmsChartHtml from './rms-chart.html?raw';

/** Chart.js observes its canvas through ResizeObserver, absent from jsdom. */
class ResizeObserverStub {
  readonly observe = (): void => undefined;
  readonly unobserve = (): void => undefined;
  readonly disconnect = (): void => undefined;
}

/** jsdom has no canvas; Chart.js only needs a context object to construct. */
function installCanvasContextStub(): void {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
      ResizeObserverStub;
  }
  const stub = {
    fillRect: () => undefined,
    clearRect: () => undefined,
    getImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      colorSpace: 'srgb',
    }),
    putImageData: () => undefined,
    createImageData: () => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      colorSpace: 'srgb',
    }),
    setTransform: () => undefined,
    resetTransform: () => undefined,
    reset: () => undefined,
    drawImage: () => undefined,
    save: () => undefined,
    fillText: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    stroke: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    rotate: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    measureText: () => ({ width: 0 }),
    transform: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    // Keeping the real canvas makes `Chart.getChart(canvas)` work as in a browser.
    return { ...stub, canvas: this } as unknown as CanvasRenderingContext2D;
  });
}

describe('RmsChart', () => {
  let fixture: ComponentFixture<RmsChart> | undefined;

  beforeAll(async () => {
    await resolveUiResources({ 'rms-chart.html': rmsChartHtml as unknown as string });
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    vi.restoreAllMocks();
  });

  async function setup(): Promise<ComponentFixture<RmsChart>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsChart] }).compileComponents();
    fixture = TestBed.createComponent(RmsChart);
    fixture.componentRef.setInput('type', 'bar');
    fixture.componentRef.setInput('data', {
      labels: ['Lun', 'Mar'],
      datasets: [{ data: [3, 5] }],
    });
    fixture.componentRef.setInput('ariaLabel', 'Ventas por día');
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function canvas(fixture: ComponentFixture<RmsChart>): HTMLElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('canvas');
    if (element === null) throw new Error('Expected the chart canvas');
    return element;
  }

  it('renders the canvas as a labelled image', async () => {
    installCanvasContextStub();
    const mounted = await setup();
    const element = canvas(mounted);

    expect(element.getAttribute('role')).toBe('img');
    expect(element.getAttribute('aria-label')).toBe('Ventas por día');
  });

  it('omits the aria-label when no name was given', async () => {
    installCanvasContextStub();
    const mounted = await setup();
    mounted.componentRef.setInput('ariaLabel', '');
    mounted.detectChanges();
    const element = canvas(mounted);

    expect(element.hasAttribute('aria-label')).toBe(false);
  });

  it('keeps the canvas and skips Chart.js when there is no 2d context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const mounted = await setup();
    const element = canvas(mounted);

    expect(Chart.getChart(element as HTMLCanvasElement)).toBeUndefined();
    expect(() => {
      mounted.destroy();
    }).not.toThrow();
  });

  it('creates the chart after render and destroys it with the component', async () => {
    installCanvasContextStub();
    const mounted = await setup();
    const element = canvas(mounted) as HTMLCanvasElement;

    expect(Chart.getChart(element)).toBeDefined();
    expect(() => {
      mounted.destroy();
    }).not.toThrow();
    expect(Chart.getChart(element)).toBeUndefined();
  });

  it('replaces the chart when the data input changes', async () => {
    installCanvasContextStub();
    const mounted = await setup();
    const element = canvas(mounted) as HTMLCanvasElement;
    const first = Chart.getChart(element);

    mounted.componentRef.setInput('data', {
      labels: ['Lun'],
      datasets: [{ data: [1] }],
    });
    mounted.detectChanges();

    const second = Chart.getChart(element);
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
  });
});
