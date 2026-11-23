import {
  AfterRenderRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  afterNextRender,
} from '@angular/core';
import { Chart, type ChartConfiguration, type ChartData, type ChartOptions } from 'chart.js';

import { applyRmsChartDefaults } from './chart-theme';

/** The four chart types the product renders. */
export type RmsChartType = 'bar' | 'line' | 'doughnut' | 'bubble';

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
 * changes destroy the previous instance and create a new one, which also picks
 * up a theme change. `ngOnDestroy` releases it.
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
  }

  ngOnDestroy(): void {
    this.renderRef?.destroy();
    this.destroyChart();
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
