import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { MoneyPipe } from '@app/shared/pipes/money';
import { DataCompleteness } from '@app/shared/models/dto/analytics/data-completeness';

const COGS_LABEL: Record<string, string> = {
  FOOD: 'Comidas',
  BEVERAGE: 'Bebidas',
  ALCOHOL: 'Licores',
  OTHER: 'Otros',
};

const LABOR_LABEL: Record<string, string> = {
  FOH: 'Salón',
  BOH: 'Cocina',
};

const COGS_COLOR: Record<string, string> = {
  FOOD: '#F9BB0B',
  BEVERAGE: '#42A5F5',
  ALCOHOL: '#AB47BC',
  OTHER: '#78909C',
};

const LABOR_COLOR: Record<string, string> = {
  FOH: '#26A69A',
  BOH: '#FFA726',
};

@Component({
  selector: 'app-analytics-prime-cost',
  imports: [CommonModule, ChartModule, SkeletonModule, MessageModule, MoneyPipe],
  templateUrl: './prime-cost.html',
  styleUrl: './prime-cost.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimeCost {
  private readonly cache = inject(AnalyticsCache);
  private readonly period = inject(AnalyticsPeriodState);

  constructor() {
    effect(() => {
      this.period.period();
      this.cache.primeCost.load();
    });
  }

  readonly isLoading = computed(() => this.cache.primeCost.isLoading());
  readonly error = computed(() => this.cache.primeCost.error());
  readonly report = computed(() => this.cache.primeCost.data());
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed<DataCompleteness>(
    () => this.report()?.dataCompleteness ?? 'EMPTY',
  );
  readonly hasAnyData = computed(() => this.completeness() !== 'EMPTY');

  readonly latest = computed(() => {
    const series = this.report()?.series ?? [];
    return series.length > 0 ? series[series.length - 1] : null;
  });

  readonly cogsLabel = (key: string): string => COGS_LABEL[key] ?? key;
  readonly laborLabel = (key: string): string => LABOR_LABEL[key] ?? key;

  readonly salesTrendData = computed(() => {
    const series = this.report()?.series ?? [];
    return {
      labels: series.map((p) => p.key),
      datasets: [
        {
          label: 'Ventas netas',
          data: series.map((p) => Number.parseFloat(p.netSales.amount)),
          borderColor: '#F9BB0B',
          backgroundColor: 'rgba(249, 187, 11, 0.15)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Ventas brutas',
          data: series.map((p) => Number.parseFloat(p.grossSales.amount)),
          borderColor: '#78909C',
          borderDash: [4, 4],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
        },
      ],
    };
  });

  readonly marginTrendData = computed(() => {
    const series = this.report()?.series ?? [];
    return {
      labels: series.map((p) => p.key),
      datasets: [
        {
          label: 'Costo operativo %',
          data: series.map((p) => p.primeCostPct),
          borderColor: '#EF5350',
          backgroundColor: 'rgba(239, 83, 80, 0.15)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Margen bruto %',
          data: series.map((p) => p.margins?.grossProfitPct ?? 0),
          borderColor: '#26A69A',
          backgroundColor: 'rgba(38, 166, 154, 0.15)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  readonly cogsStackData = computed(() => {
    const series = this.report()?.series ?? [];
    const categories = ['FOOD', 'BEVERAGE', 'ALCOHOL', 'OTHER'] as const;
    return {
      labels: series.map((p) => p.key),
      datasets: categories.map((cat) => ({
        label: this.cogsLabel(cat),
        data: series.map((p) => {
          const row = p.cogs.byCategory.find((c) => c.category === cat);
          return row ? Number.parseFloat(row.amount.amount) : 0;
        }),
        backgroundColor: COGS_COLOR[cat],
        borderWidth: 0,
        stack: 'cogs',
      })),
    };
  });

  readonly discountTrendData = computed(() => {
    const series = this.report()?.series ?? [];
    return {
      labels: series.map((p) => p.key),
      datasets: [
        {
          label: 'Descuentos',
          data: series.map((p) => Number.parseFloat(p.discounts?.amount ?? '0')),
          backgroundColor: '#FFA726',
        },
        {
          label: 'Consumo del personal',
          data: series.map((p) => Number.parseFloat(p.comped?.amount ?? '0')),
          backgroundColor: '#AB47BC',
        },
      ],
    };
  });

  readonly cogsChartData = computed(() => {
    const c = this.latest()?.cogs.byCategory ?? [];
    return {
      labels: c.map((r) => this.cogsLabel(r.category)),
      datasets: [
        {
          data: c.map((r) => Number.parseFloat(r.amount.amount)),
          backgroundColor: c.map((r) => COGS_COLOR[r.category] ?? '#78909C'),
          borderWidth: 0,
        },
      ],
    };
  });

  readonly laborChartData = computed(() => {
    const l = this.latest()?.labor.byArea ?? [];
    return {
      labels: l.map((r) => this.laborLabel(r.area)),
      datasets: [
        {
          data: l.map((r) => Number.parseFloat(r.amount.amount)),
          backgroundColor: l.map((r) => LABOR_COLOR[r.area] ?? '#78909C'),
          borderWidth: 0,
        },
      ],
    };
  });

  readonly lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v: number | string): string => this.shortMoney(v) } },
    },
  };

  readonly percentStackOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { callback: (v: number | string): string => this.shortMoney(v) } },
    },
  };

  readonly percentLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v: number | string): string => `${String(v)}%` } },
    },
  };

  readonly doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const } },
  };

  cogsRows = computed(() => this.latest()?.cogs.byCategory ?? []);
  laborRows = computed(() => this.latest()?.labor.byArea ?? []);

  fmtPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(2)}%`;
  }

  shortMoney(v: number | string): string {
    const n = typeof v === 'string' ? Number.parseFloat(v) : v;
    if (Number.isNaN(n)) return String(v);
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  }

  reload(): void {
    this.cache.primeCost.refresh();
  }
}
