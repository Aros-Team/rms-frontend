import {
  AfterRenderRef,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  afterNextRender,
} from '@angular/core';

import { RmsButton } from '../button/button';
import { RmsSkeleton } from '../skeleton/skeleton';
import { applyRmsChartDefaults } from '../chart/chart-theme';

/**
 * `app-rms-chart-frame` — the only container a chart may live in.
 *
 * Fixes the doughnut/table collision (F-002): fixed height, `overflow: hidden`,
 * the legend is HTML outside the plot, and a data-table fallback is part of the
 * frame. Loading, empty and error states keep the frame's height, so the page
 * never collapses and no value is invented for an empty period (F-014).
 *
 * Chart.js defaults are applied here (palette, fonts, grid, tooltip, motion)
 * and re-applied when the theme class changes. Features still pass a `summary`
 * and must provide the table when `dataMode` is on.
 *
 *   <app-rms-chart-frame title="Ventas" subtitle="Últimos 6 meses"
 *                        summary="Ventas netas por mes" dataMode="disclosure">
 *     <app-rms-chart type="line" [data]="data" [options]="options" />
 *     <ul rmsChartLegend>…HTML legend…</ul>
 *     <table rmsChartData>…same numbers…</table>
 *   </app-rms-chart-frame>
 */
@Component({
  selector: 'app-rms-chart-frame',
  templateUrl: './chart-frame.html',
  host: { '[class.rms-chart-frame-host--fill]': 'fill' },
  styleUrl: './chart-frame.css',
  imports: [RmsButton, RmsSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsChartFrame implements OnDestroy {
  private static nextId = 0;

  @Input({ required: true }) title!: string;
  @Input() subtitle = '';
  /** Plot height in px: 240 line/bar, 200 doughnut, 320 scatter. */
  @Input() height = 240;
  /** Stretch to the parent's height instead of using `height` px. */
  @Input() fill = false;
  @Input() loading = false;
  @Input() empty = false;
  @Input() error = '';
  @Input() emptyMessage = 'Sin datos para este periodo';
  @Input() emptyActionLabel = '';
  @Input() errorTitle = 'No se pudo cargar el gráfico';
  /** Screen-reader summary of the chart; also names the plot as an image. */
  @Input() summary = '';
  @Input() dataMode: 'none' | 'disclosure' | 'hidden' = 'none';
  @Input() dataLabel = 'Ver datos';

  @Output() retry = new EventEmitter<void>();
  @Output() emptyAction = new EventEmitter<void>();

  readonly titleId = `rms-chart-${String(RmsChartFrame.nextId++)}`;

  private observer?: MutationObserver;
  private renderRef?: AfterRenderRef;

  get heightPx(): string {
    return this.fill ? '100%' : `${String(this.height)}px`;
  }

  get hasState(): boolean {
    return this.loading || this.empty || this.error.length > 0;
  }

  get stateRole(): 'status' | 'alert' {
    return this.error ? 'alert' : 'status';
  }

  constructor() {
    this.renderRef = afterNextRender(() => {
      applyRmsChartDefaults();

      if (typeof MutationObserver === 'undefined') return;
      this.observer = new MutationObserver(() => {
        applyRmsChartDefaults();
      });
      this.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.renderRef?.destroy();
  }
}
