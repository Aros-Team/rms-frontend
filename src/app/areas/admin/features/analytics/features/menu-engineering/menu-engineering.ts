import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ChartData, PointStyle } from 'chart.js';
import { finalize } from 'rxjs';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { downloadCsv, menuEngineeringCsv } from '@app/core/services/analytics/analytics-csv';
import { describeAnalyticsError } from '@app/core/services/analytics/analytics-error';
import { divideMoney, pctOf, sumMoney } from '@app/core/services/analytics/analytics-money';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { bucketLabel } from '@app/core/services/analytics/analytics-utils';
import type { Money } from '@app/shared/models/dto/analytics/money';
import type {
  MenuEngineeringItem,
  MenuQuadrant,
} from '@app/shared/models/dto/analytics/menu-engineering-report';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsChartFrame } from '@app/shared/ui/chart-frame/chart-frame';
import { readRmsToken } from '@app/shared/ui/chart/chart-theme';
import { RmsChart } from '@app/shared/ui/chart/rms-chart';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsSelect, type RmsSelectOption } from '@app/shared/ui/select/select';
import { RmsStatTile } from '@app/shared/ui/stat-tile/stat-tile';

import { AnalyticsNotice } from '../../components/analytics-notice/analytics-notice';
import { bubbleOptions, formatPct } from '../../analytics-chart-options';

interface QuadrantMeta {
  label: string;
  icon: string;
  action: string;
}

interface QuadrantSummary {
  quadrant: MenuQuadrant;
  meta: QuadrantMeta;
  count: number;
  contribution: Money | null;
  topItems: string[];
}

const QUADRANTS: readonly MenuQuadrant[] = ['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'];

const QUADRANT_META: Record<MenuQuadrant, QuadrantMeta> = {
  STAR: {
    label: 'Estrella',
    icon: 'pi pi-star-fill',
    action: 'Venden bien y dejan buena ganancia. Protégelos.',
  },
  PLOWHORSE: {
    label: 'Caballo de batalla',
    icon: 'pi pi-thumbs-up',
    action: 'Venden mucho pero dejan poca ganancia. Ajusta precio o costo.',
  },
  PUZZLE: {
    label: 'Rompecabezas',
    icon: 'pi pi-lightbulb',
    action: 'Dejan ganancia pero no se venden. Promuévelos.',
  },
  DOG: {
    label: 'A revisar',
    icon: 'pi pi-flag',
    action: 'No venden ni dejan ganancia. Candidatos a salir.',
  },
};

/** One chart marker per quadrant so the series never rely on hue alone. */
const QUADRANT_POINT_STYLE: Record<MenuQuadrant, PointStyle> = {
  STAR: 'circle',
  PLOWHORSE: 'rectRot',
  PUZZLE: 'triangle',
  DOG: 'rect',
};

const QUADRANT_ORDER: Record<MenuQuadrant, number> = {
  STAR: 0,
  PLOWHORSE: 1,
  PUZZLE: 2,
  DOG: 3,
};

@Component({
  selector: 'app-analytics-menu-engineering',
  imports: [
    FormsModule,
    MoneyPipe,
    RmsButton,
    RmsChart,
    RmsChartFrame,
    RmsEmptyState,
    RmsPageHeader,
    RmsSelect,
    RmsStatTile,
    AnalyticsNotice,
  ],
  templateUrl: './menu-engineering.html',
  styleUrls: ['../../analytics-shared.css', './menu-engineering.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuEngineering {
  private readonly cache = inject(AnalyticsCache);
  private readonly period = inject(AnalyticsPeriodState);

  readonly isLoading = computed(() => this.cache.menuEngineering.isLoading());
  readonly error = computed(() => this.cache.menuEngineering.error());
  readonly report = computed(() => this.cache.menuEngineering.data());
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed(() => this.report()?.dataCompleteness ?? 'EMPTY');
  readonly errorInfo = computed(() => {
    const error = this.error();
    return error === undefined ? null : describeAnalyticsError(error);
  });

  readonly rangeLabel = this.period.label;
  readonly subtitle = computed(
    () => `Qué productos dejan plata y cuáles revisar · agrupado por ${bucketLabel(this.period.bucket()).toLowerCase()}`,
  );

  readonly categoryId = signal<number | undefined>(undefined);
  readonly selectedQuadrant = signal<MenuQuadrant | null>(null);
  readonly refreshing = signal(false);

  readonly categoryOptions = computed<RmsSelectOption[]>(() => {
    const seen = new Map<number, string>();
    for (const item of this.report()?.items ?? []) {
      if (item.categoryId === null) continue;
      if (!seen.has(item.categoryId)) {
        seen.set(item.categoryId, item.categoryName ?? `Categoría ${String(item.categoryId)}`);
      }
    }
    return Array.from(seen, ([id, name]) => ({ label: name, value: id })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  });

  readonly allItems = computed(() => this.report()?.items ?? []);

  readonly filteredItems = computed(() => {
    const category = this.categoryId();
    const quadrant = this.selectedQuadrant();
    return this.allItems()
      .filter((item) => category === undefined || item.categoryId === category)
      .filter((item) => quadrant === null || item.quadrant === quadrant)
      .sort((a, b) => {
        const order = QUADRANT_ORDER[a.quadrant] - QUADRANT_ORDER[b.quadrant];
        if (order !== 0) return order;
        return moneyNumber(b.totalContribution) - moneyNumber(a.totalContribution);
      });
  });

  readonly isEmpty = computed(
    () =>
      !this.isLoading() &&
      this.error() === undefined &&
      (this.allItems().length === 0 || this.completeness() === 'EMPTY'),
  );
  readonly busy = computed(() => this.isLoading() && this.report() === null);

  readonly stats = computed(() => {
    const items = this.filteredItems();
    const median = this.report()?.median;
    return {
      count: items.length,
      contribution: sumMoney(items.map((item) => item.totalContribution)),
      medianVolume: median?.volume ?? null,
      medianMargin: median?.margin ?? null,
    };
  });

  readonly summaries = computed<QuadrantSummary[]>(() => {
    const items = this.allItems();
    return QUADRANTS.map((quadrant) => {
      const rows = items
        .filter((item) => item.quadrant === quadrant)
        .sort((a, b) => moneyNumber(b.totalContribution) - moneyNumber(a.totalContribution));
      const names: string[] = [];
      for (const row of rows) {
        if (names.length >= 3) break;
        if (!names.includes(row.productName)) names.push(row.productName);
      }
      return {
        quadrant,
        meta: QUADRANT_META[quadrant],
        count: rows.length,
        contribution: sumMoney(rows.map((row) => row.totalContribution)),
        topItems: names,
      };
    });
  });

  readonly refreshedLabel = computed(() => {
    const raw = this.report()?.cacheStatus.lastRefreshedAt;
    if (raw === undefined || raw.length === 0) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  });

  readonly chartOptions = bubbleOptions();

  readonly quadrantColors = computed<Record<MenuQuadrant, string>>(() => ({
    STAR: readRmsToken('--rms-quadrant-star-fg', '#0f766e'),
    PLOWHORSE: readRmsToken('--rms-quadrant-plowhorse-fg', '#475569'),
    PUZZLE: readRmsToken('--rms-quadrant-puzzle-fg', '#4338ca'),
    DOG: readRmsToken('--rms-quadrant-dog-fg', '#9f1239'),
  }));

  readonly chartData = computed<ChartData<'bubble'>>(() => {
    const items = this.filteredItems();
    const colors = this.quadrantColors();
    const maxUnits = Math.max(1, ...items.map((item) => item.unitsSold));
    return {
      datasets: QUADRANTS.map((quadrant) => ({
        label: QUADRANT_META[quadrant].label,
        data: items
          .filter((item) => item.quadrant === quadrant)
          .map((item) => ({
            x: moneyNumber(item.grossProfitPerUnit),
            y: item.unitsSold,
            r: Math.max(4, Math.round((item.unitsSold / maxUnits) * 18)),
            name: item.productName,
          })),
        backgroundColor: `${colors[quadrant]}99`,
        borderColor: colors[quadrant],
        pointStyle: QUADRANT_POINT_STYLE[quadrant],
      })),
    };
  });

  readonly chartSummary = computed(() => {
    const items = this.filteredItems();
    const stars = items.filter((item) => item.quadrant === 'STAR').length;
    const dogs = items.filter((item) => item.quadrant === 'DOG').length;
    return `${String(items.length)} productos: ${String(stars)} estrella y ${String(dogs)} a revisar`;
  });

  readonly tableRows = computed(() =>
    this.filteredItems().map((item) => ({
      item,
      sellPrice: sellPricePerUnit(item),
      marginPct: marginPercent(item),
    })),
  );

  constructor() {
    effect(() => {
      this.period.period();
      this.period.revision();
      this.cache.menuEngineering.load();
    });
  }

  reload(): void {
    this.cache.menuEngineering.refresh();
  }

  refresh(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.cache
      .refreshAll()
      .pipe(
        finalize(() => {
          this.refreshing.set(false);
        }),
      )
      .subscribe({
        error: () => {
          // The shell-wide notice covers the failure; keep the current report.
        },
      });
  }

  onCategoryChange(value: string | number | null): void {
    this.categoryId.set(typeof value === 'number' ? value : undefined);
  }

  toggleQuadrant(quadrant: MenuQuadrant): void {
    this.selectedQuadrant.update((current) => (current === quadrant ? null : quadrant));
  }

  clearQuadrant(): void {
    this.selectedQuadrant.set(null);
  }

  isSelected(quadrant: MenuQuadrant): boolean {
    return this.selectedQuadrant() === quadrant;
  }

  quadrantMeta(quadrant: MenuQuadrant): QuadrantMeta {
    return QUADRANT_META[quadrant];
  }

  exportCsv(): void {
    const report = this.report();
    if (report === null) return;
    downloadCsv(`menu-${report.period.from}-${report.period.to}.csv`, menuEngineeringCsv(report));
  }

  buildCsv(): string {
    const report = this.report();
    return report === null ? '' : menuEngineeringCsv(report);
  }

  readonly formatPct = formatPct;
}

function moneyNumber(value: Money | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number.parseFloat(value.amount);
}

function sellPricePerUnit(item: MenuEngineeringItem): Money | null {
  return divideMoney(item.revenue, item.unitsSold);
}

function marginPercent(item: MenuEngineeringItem): number | null {
  return pctOf(item.grossProfitPerUnit, sellPricePerUnit(item));
}
