import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { ChartModule } from 'primeng/chart';

import { RmsChartFrame } from '@shared/ui/chart-frame/chart-frame';
import { readRmsToken } from '@shared/ui/chart/chart-theme';

export interface HourlySalesBar {
  hour: number;
  label: string;
  delivered: number;
  revenue: number;
  isCurrent: boolean;
}

/**
 * Sales by hour for the current day.
 *
 * The dashboard used to paint an unlabelled, partially clipped bar strip
 * behind the KPI numbers; it read as a rendering bug. This chart makes the
 * same data legible: hour ticks, an integer order axis, a tooltip with the
 * count and a table fallback. This chart answers "how many orders per hour",
 * not "how much money": revenue already lives in the KPI header.
 */
@Component({
  selector: 'app-dashboard-hourly-chart',
  templateUrl: './hourly-sales-chart.html',
  styleUrl: './hourly-sales-chart.css',
  imports: [ChartModule, RmsChartFrame],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HourlySalesChart {
  @Input({ required: true })
  set bars(value: readonly HourlySalesBar[]) {
    this.rows = [...value];
    this.data = this.buildData(this.rows);
    this.summary = this.buildSummary(this.rows);
  }

  @Input() loading = false;
  @Input() error = '';
  @Output() readonly retry = new EventEmitter<void>();

  rows: HourlySalesBar[] = [];
  data: ChartData<'bar'> = { labels: [], datasets: [] };
  summary = '';
  readonly options: ChartOptions<'bar'> = this.buildOptions();

  get totalOrders(): number {
    return this.rows.reduce((sum, row) => sum + row.delivered, 0);
  }

  get isEmpty(): boolean {
    return !this.loading && this.rows.every((row) => row.delivered === 0);
  }

  private buildOptions(): ChartOptions<'bar'> {
    const axis = readRmsToken('--rms-chart-axis', '#64748b');
    const grid = readRmsToken('--rms-chart-grid', '#e2e8f0');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: TooltipItem<'bar'>[]) => `Hora ${items[0]?.label ?? ''}`,
            label: (ctx: TooltipItem<'bar'>) => {
              const orders = this.rows[ctx.dataIndex].delivered;
              return ` ${String(orders)} ${orders === 1 ? 'pedido entregado' : 'pedidos entregados'}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: true, color: axis },
          ticks: {
            autoSkip: true,
            maxTicksLimit: 9,
            maxRotation: 0,
            color: axis,
            font: { size: 11 },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: grid },
          ticks: {
            maxTicksLimit: 4,
            precision: 0,
            color: axis,
          },
        },
      },
    };
  }

  private buildData(rows: readonly HourlySalesBar[]): ChartData<'bar'> {
    const normal = readRmsToken('--rms-chart-1', '#1d4ed8');
    const current = readRmsToken('--rms-info-solid', '#0369a1');
    return {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          data: rows.map((row) => row.delivered),
          backgroundColor: rows.map((row) => (row.isCurrent ? current : normal)),
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    };
  }

  private buildSummary(rows: readonly HourlySalesBar[]): string {
    const parts = rows
      .filter((row) => row.revenue > 0 || row.delivered > 0)
      .map((row) => `${row.label}: ${String(row.delivered)} ${row.delivered === 1 ? 'pedido' : 'pedidos'}`);
    return parts.length > 0 ? `Ventas por hora de hoy. ${parts.join('; ')}.` : '';
  }

}
