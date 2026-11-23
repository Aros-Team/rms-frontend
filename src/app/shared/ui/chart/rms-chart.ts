import {
  AfterRenderRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { Chart, type ChartConfiguration, type ChartData, type ChartOptions } from 'chart.js';

import { applyRmsChartDefaults } from './chart-theme';

/** The four chart types the product renders. */
export type RmsChartType = 'bar' | 'line' | 'doughnut' | 'bubble';

/** The theme signal both palettes and this component key off. */
function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * `app-rms-chart` — the only Chart.js canvas the product needs.
 *
 * PrimeNG's `ChartModule` imports `chart.js/auto`, which registers every
 * controller, element, scale and plugin; that made the lazy chart chunk 214 kB.
 * This component imports `chart.js` core, so `chart-theme.ts`'s selective
 * registration is the only thing in the bundle (bar, line, doughnut, bubble).
 *
 * Anatomy: a full-height relative wrapper with one labelled `<canvas>`.
 * The parent (`app-rms-chart-frame`) owns the plot height, the summary stays in
 * the frame and the data table is projected there; this component adds no
 * duplicate description.
 *
 * Lifecycle: Chart.js measures the canvas when the chart is constructed, so the
 * first chart is created in `afterNextRender` (not `ngOnInit`). Later input
 * changes destroy the previous instance and create a new one. A
 * `MutationObserver` on `document.documentElement`'s `class` does the same when
 * the dark theme is toggled, because the palette is read from CSS tokens when
 * the chart is built; the previous theme value is compared first so unrelated
 * class churn does not rebuild. `ngOnDestroy` disconnects it and releases the
 * chart.
 *
 * Accessibility: the canvas is `role="img"` with `ariaLabel` as its name.
 */
@Component({
  selector: 'app-rms-chart',
  templateUrl: './rms-chart.html',
  styleUrl: './rms-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsChart implements OnDestroy {
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private instance?: Chart;
  private renderRef?: AfterRenderRef;
  private observer?: MutationObserver;
  private lastDark: boolean | null = null;

  private currentType: RmsChartType = 'bar';
  private currentData: ChartData | null = null;
  private currentOptions?: ChartOptions;

  @Input({ required: true })
  set type(value: RmsChartType) {
    this.currentType = value;
    this.recreate();
  }

  @Input({ required: true })
  set data(value: ChartData) {
    this.currentData = value;
    this.recreate();
  }

  @Input()
  set options(value: ChartOptions | undefined) {
    this.currentOptions = value;
    this.recreate();
  }

  /** Screen-reader name for the plot; the frame's summary is not repeated. */
  @Input() ariaLabel = '';

  constructor() {
    this.renderRef = afterNextRender(() => {
      this.recreate();
    });

    this.observeTheme();
    inject(DestroyRef).onDestroy(() => {
      this.disconnectThemeObserver();
    });
  }

  ngOnDestroy(): void {
    this.renderRef?.destroy();
    this.disconnectThemeObserver();
    this.destroyChart();
  }

  /**
   * Rebuilds on a real light/dark switch. The palette is captured when the
   * chart is constructed, so re-applying Chart.js defaults is not enough; the
   * instance has to be created again to read the new tokens. Comparing
   * `lastDark` keeps unrelated class mutations from rebuilding every time.
   */
  private observeTheme(): void {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;

    this.lastDark = isDarkTheme();
    this.observer = new MutationObserver(() => {
      const dark = isDarkTheme();
      if (dark === this.lastDark) return;
      this.lastDark = dark;
      this.recreate();
    });
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private disconnectThemeObserver(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  /**
   * Builds a fresh chart from the current inputs. Before the view is ready the
   * canvas is `undefined` and this is a no-op; `afterNextRender` retries once
   * the canvas has layout. Under SSR or a canvas stub without a 2d context the
   * labelled canvas still renders and Chart.js is skipped.
   */
  private recreate(): void {
    this.destroyChart();
    if (typeof document === 'undefined') return;

    const canvas = this.canvas?.nativeElement;
    if (canvas === undefined || this.currentData === null) return;

    const context = canvas.getContext('2d');
    if (context === null) return;

    applyRmsChartDefaults();
    const config: ChartConfiguration = {
      type: this.currentType,
      data: this.currentData,
      options: this.currentOptions,
    };
    this.instance = new Chart(context, config);
  }

  private destroyChart(): void {
    this.instance?.destroy();
    this.instance = undefined;
  }
}
