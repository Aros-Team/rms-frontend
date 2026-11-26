import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import type { ChartData } from 'chart.js';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { downloadCsv, primeCostCsv } from '@app/core/services/analytics/analytics-csv';
import { describeAnalyticsError } from '@app/core/services/analytics/analytics-error';
import { pctOf, subtractMoney, sumMoney } from '@app/core/services/analytics/analytics-money';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { bucketLabel, titleForKey } from '@app/core/services/analytics/analytics-utils';
import type { Money } from '@app/shared/models/dto/analytics/money';
import {
  COGS_CATEGORIES,
  LABOR_AREAS,
  type CogsCategory,
  type LaborArea,
  type PrimeCostPeriod,
} from '@app/shared/models/dto/analytics/prime-cost-report';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsChartFrame } from '@app/shared/ui/chart-frame/chart-frame';
import { rmsChartPalette } from '@app/shared/ui/chart/chart-theme';
import { RmsChart } from '@app/shared/ui/chart/rms-chart';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsStatTile } from '@app/shared/ui/stat-tile/stat-tile';

import { AnalyticsNotice } from '../../components/analytics-notice/analytics-notice';
import {
  formatPct,
  moneyBarOptions,
  moneyLineOptions,
  percentLineOptions,
} from '../../analytics-chart-options';

const COGS_LABEL: Record<CogsCategory, string> = {
  FOOD: 'Comidas',
  BEVERAGE: 'Bebidas',
  ALCOHOL: 'Licores',
  OTHER: 'Otros',
};

const LABOR_LABEL: Record<LaborArea, string> = {
  FOH: 'Salón',
  BOH: 'Cocina',
  OTHER: 'Otros',
};

interface BreakdownRow {
  key: string;
  label: string;
  amount: Money | null;
  pct: number | null;
}

@Component({
  selector: 'app-analytics-prime-cost',
  imports: [
    MoneyPipe,
    RmsButton,
    RmsChart,
    RmsChartFrame,
    RmsEmptyState,
    RmsPageHeader,
    RmsStatTile,
    AnalyticsNotice,
  ],
  templateUrl: './prime-cost.html',
  styleUrls: ['../../analytics-shared.css', './prime-cost.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimeCost {
  private readonly cache = inject(AnalyticsCache);
  private readonly period = inject(AnalyticsPeriodState);

  readonly isLoading = computed(() => this.cache.primeCost.isLoading());
  readonly error = computed(() => this.cache.primeCost.error());
  readonly report = computed(() => this.cache.primeCost.data());
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed(() => this.report()?.dataCompleteness ?? 'EMPTY');
  readonly errorInfo = computed(() => {
    const error = this.error();
    return error === undefined ? null : describeAnalyticsError(error);
  });

  readonly rangeLabel = this.period.label;
  readonly subtitle = computed(
    () => `Ventas, costos y márgenes · agrupado por ${bucketLabel(this.period.bucket()).toLowerCase()}`,
  );

  readonly series = computed(() => this.report()?.series ?? []);
  readonly isEmpty = computed(
    () =>
      !this.isLoading() &&
      this.error() === undefined &&
      (this.series().length === 0 || this.completeness() === 'EMPTY'),
  );
  readonly busy = computed(() => this.isLoading() && this.report() === null);

  readonly totals = computed(() => {
    const series = this.series();
    const netSales = sumMoney(series.map((point) => point.netSales));
    const grossSales = sumMoney(series.map((point) => point.grossSales));
    const cogs = sumMoney(series.map((point) => point.cogs.total));
    const labor = sumMoney(series.map((point) => point.labor.total));
    const primeCost = sumMoney([cogs, labor]);
    const grossProfit = subtractMoney(netSales, cogs);
    const netProfit = subtractMoney(netSales, primeCost);
    return {
      netSales,
      grossSales,
      cogs,
      labor,
      primeCost,
      primeCostPct: pctOf(primeCost, netSales),
      grossProfitPct: pctOf(grossProfit, netSales),
      netProfitPct: pctOf(netProfit, netSales),
    };
  });

  readonly cogsRows = computed<BreakdownRow[]>(() => {
    const series = this.series();
    const values = COGS_CATEGORIES.map((category) => ({
      category,
      amount: sumMoney(
        series.map(
          (point) => point.cogs.byCategory.find((line) => line.category === category)?.amount ?? null,
        ),
      ),
    }));
    const total = sumMoney(values.map((row) => row.amount));
    return values
      .filter((row) => row.amount !== null)
      .map((row) => ({
        key: row.category,
        label: COGS_LABEL[row.category],
        amount: row.amount,
        pct: pctOf(row.amount, total),
      }));
  });

  readonly laborRows = computed<BreakdownRow[]>(() => {
    const series = this.series();
    const values = LABOR_AREAS.map((area) => ({
      area,
      amount: sumMoney(
        series.map(
          (point) => point.labor.byArea.find((line) => line.area === area)?.amount ?? null,
        ),
      ),
    }));
    const total = sumMoney(values.map((row) => row.amount));
    return values
      .filter((row) => row.amount !== null)
      .map((row) => ({
        key: row.area,
        label: LABOR_LABEL[row.area],
        amount: row.amount,
        pct: pctOf(row.amount, total),
      }));
  });

  readonly tableRows = computed(() =>
    this.series().map((point) => ({
      ...point,
      label: titleForKey(this.period.bucket(), point.key),
    })),
  );

  readonly salesOptions = moneyLineOptions('Ventas');
  readonly marginOptions = percentLineOptions('% de ventas');
  readonly cogsOptions = moneyBarOptions('Costo', true);

  readonly salesData = computed<ChartData<'line'>>(() => {
    const palette = rmsChartPalette();
    const rows = this.tableRows();
    return {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: 'Ventas netas',
          data: rows.map((row) => moneyValue(row.netSales)),
          borderColor: palette[0],
          backgroundColor: `${palette[0]}22`,
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Ventas brutas',
          data: rows.map((row) => moneyValue(row.grossSales)),
          borderColor: palette[6],
          borderDash: [4, 4],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    };
  });

  readonly marginData = computed<ChartData<'line'>>(() => {
    const palette = rmsChartPalette();
    const rows = this.tableRows();
    return {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: 'Costo primo',
          data: rows.map((row) => row.primeCostPct),
          borderColor: palette[3],
          backgroundColor: `${palette[3]}22`,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Margen bruto',
          data: rows.map((row) => row.margins?.grossProfitPct ?? null),
          borderColor: palette[1],
          backgroundColor: `${palette[1]}22`,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
        },
        {
          label: 'Margen neto',
          data: rows.map((row) => row.margins?.netProfitPct ?? null),
          borderColor: palette[4],
          borderDash: [4, 4],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 2,
        },
      ],
    };
  });

  readonly salesColors = computed(() => {
    const palette = rmsChartPalette();
    return { net: palette[0], gross: palette[6] };
  });

  readonly marginColors = computed(() => {
    const palette = rmsChartPalette();
    return { prime: palette[3], gross: palette[1], net: palette[4] };
  });

  readonly cogsColors = computed(() => {
    const palette = rmsChartPalette();
    return {
      FOOD: palette[4],
      BEVERAGE: palette[0],
      ALCOHOL: palette[3],
      OTHER: palette[6],
    };
  });

  readonly cogsData = computed<ChartData<'bar'>>(() => {
    const rows = this.tableRows();
    const colors = this.cogsColors();
    return {
      labels: rows.map((row) => row.label),
      datasets: COGS_CATEGORIES.map((category) => ({
        label: COGS_LABEL[category],
        data: rows.map((row) => {
          const line = row.cogs.byCategory.find((candidate) => candidate.category === category);
          return line === undefined ? 0 : moneyValue(line.amount);
        }),
        backgroundColor: colors[category],
        borderWidth: 0,
        stack: 'cogs',
      })),
    };
  });

  constructor() {
    effect(() => {
      this.period.period();
      this.period.revision();
      this.cache.primeCost.load();
    });
  }

  reload(): void {
    this.cache.primeCost.refresh();
  }

  buildCsv(): string {
    const report = this.report();
    return report === null ? '' : primeCostCsv(report);
  }

  exportCsv(): void {
    const report = this.report();
    if (report === null) return;
    downloadCsv(`costo-primo-${report.period.from}-${report.period.to}.csv`, primeCostCsv(report));
  }

  readonly formatPct = formatPct;
  readonly categories = COGS_CATEGORIES;

  categoryAmount(row: PrimeCostPeriod, category: CogsCategory): Money | null {
    return row.cogs.byCategory.find((line) => line.category === category)?.amount ?? null;
  }

  cogsColor(key: string): string {
    const colors = this.cogsColors();
    return key in colors ? colors[key as CogsCategory] : colors.OTHER;
  }
}

function moneyValue(value: Money | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const amount = Number.parseFloat(value.amount);
  return Number.isFinite(amount) ? amount : 0;
}
