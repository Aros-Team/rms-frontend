import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { ChartModule } from 'primeng/chart';

import { Money } from '@shared/pipes/money/money';
import { RmsChartFrame } from '@shared/ui/chart-frame/chart-frame';
import { readRmsToken } from '@shared/ui/chart/chart-theme';

export interface HourlySalesBar {
  hour: number;
  label: string;
  delivered: number;
  revenue: number;
  isCurrent: boolean;
}

const moneyPipe = new Money();

/**
 * Sales by hour for the current day.
 *
 * The dashboard used to paint an unlabelled, partially clipped bar strip
 * behind the KPI numbers; it read as a rendering bug. This chart makes the
 * same data legible: hour ticks, a revenue axis, a tooltip with orders and a
 * table fallback. Delivered orders are the only ones counted as sales.
 */
@Component({
  selector: 'app-dashboard-hourly-chart',
  templateUrl: './hourly-sales-chart.html',
  imports: [ChartModule, Money, RmsChartFrame],
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

  get totalRevenue(): number {
    return this.rows.reduce((sum, row) => sum + row.revenue, 0);
  }

  get isEmpty(): boolean {
    return !this.loading && this.rows.every((row) => row.revenue === 0 && row.delivered === 0);
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
              const row = this.rows[ctx.dataIndex];
              const orders = row.delivered;
              return [
                ` ${moneyPipe.transform(ctx.parsed.y ?? 0)}`,
                ` ${String(orders)} ${orders === 1 ? 'pedido entregado' : 'pedidos entregados'}`,
              ];
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
            color: axis,
            callback: (value) => this.compact(value as number),
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
          data: rows.map((row) => row.revenue),
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
      .map((row) => `${row.label}: ${moneyPipe.transform(row.revenue)} en ${String(row.delivered)} pedidos`);
    return parts.length > 0 ? `Ventas por hora de hoy. ${parts.join('; ')}.` : '';
  }

  private compact(value: number): string {
    if (value >= 1_000_000) return `${String(Math.round(value / 100_000) / 10)}M`;
    if (value >= 1_000) return `${String(Math.round(value / 100) / 10)}k`;
    return String(value);
  }
}
