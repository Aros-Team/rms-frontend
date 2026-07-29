import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { Money } from '@app/shared/pipes/money/money';
import { DataCompleteness } from '@app/shared/models/dto/analytics/data-completeness';
import { Money as MoneyModel } from '@app/shared/models/dto/analytics/money';
import {
  MenuEngineeringItem,
  MenuQuadrant,
} from '@app/shared/models/dto/analytics/menu-engineering-report';

interface QuadrantMeta {
  readonly label: string;
  readonly icon: string;
  readonly action: string;
  readonly borderClass: string;
  readonly bgClass: string;
  readonly ringClass: string;
}

const QUADRANT_ORDER: Record<MenuQuadrant, number> = {
  STAR: 0,
  PLOWHORSE: 1,
  PUZZLE: 2,
  DOG: 3,
};

const QUADRANT_META: Record<MenuQuadrant, QuadrantMeta> = {
  STAR: {
    label: 'Excelente',
    icon: 'pi pi-star-fill',
    action: 'Venden bien y dejan buena ganancia. Protégelos: evita cambiarlos.',
    borderClass: 'border-green-300 dark:border-green-700',
    bgClass: 'bg-green-50 dark:bg-green-900/20',
    ringClass: 'ring-2 ring-green-500',
  },
  PLOWHORSE: {
    label: 'Populares',
    icon: 'pi pi-thumbs-up',
    action: 'Venden mucho pero dejan poca ganancia. Súbele el precio o reduce el costo.',
    borderClass: 'border-amber-300 dark:border-amber-700',
    bgClass: 'bg-amber-50 dark:bg-amber-900/20',
    ringClass: 'ring-2 ring-amber-500',
  },
  PUZZLE: {
    label: 'Oportunidad',
    icon: 'pi pi-lightbulb',
    action: 'Dejan ganancia pero no se venden. Púlsalos en el menú o promuévelos.',
    borderClass: 'border-blue-300 dark:border-blue-700',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    ringClass: 'ring-2 ring-blue-500',
  },
  DOG: {
    label: 'A revisar',
    icon: 'pi pi-flag',
    action: 'No venden ni dejan ganancia. Candidatos a salir de la carta.',
    borderClass: 'border-red-300 dark:border-red-700',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    ringClass: 'ring-2 ring-red-500',
  },
};

interface QuadrantSummary {
  quadrant: MenuQuadrant;
  meta: QuadrantMeta;
  count: number;
  totalContribution: number;
  topItems: string[];
}

interface MenuEngineeringCategoryOption {
  id: number;
  name: string;
}

interface MenuEngineeringStats {
  count: number;
  totalContribution: number;
  medianVolume: number | null;
  medianMargin: number | null;
}

@Component({
  selector: 'app-analytics-menu-engineering',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ChartModule,
    SkeletonModule,
    MessageModule,
    SelectModule,
    TableModule,
    Money,
  ],
  templateUrl: './menu-engineering.html',
  styleUrl: './menu-engineering.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuEngineering {
  private readonly cache = inject(AnalyticsCache);

  readonly isLoading = computed(() => this.cache.menuEngineering.isLoading());
  readonly error = computed(() => this.cache.menuEngineering.error());
  readonly report = computed(() => this.cache.menuEngineering.data());
  readonly notes = computed(() => this.report()?.notes ?? []);
  readonly completeness = computed<DataCompleteness>(
    () => this.report()?.dataCompleteness ?? 'EMPTY',
  );
  readonly median = computed(() => this.report()?.median ?? null);
  readonly cacheStatus = computed(() => this.report()?.cacheStatus ?? null);
  readonly categoryId = signal<number | undefined>(undefined);
  readonly selectedQuadrant = signal<MenuQuadrant | null>(null);

  readonly items = computed<MenuEngineeringItem[]>(() => {
    const all = this.report()?.items ?? [];
    const cat = this.categoryId();
    const q = this.selectedQuadrant();
    return all.filter((i) => {
      if (cat !== undefined && i.categoryId !== cat) return false;
      if (q !== null && i.quadrant !== q) return false;
      return true;
    }).sort((a, b) => {
      const qa = QUADRANT_ORDER[a.quadrant];
      const qb = QUADRANT_ORDER[b.quadrant];
      if (qa !== qb) return qa - qb;
      return a.productName.localeCompare(b.productName);
    });
  });

  readonly quadrantSummary = computed<readonly QuadrantSummary[]>(() => {
    const items = this.report()?.items ?? [];
    const counts: Record<MenuQuadrant, MenuEngineeringItem[]> = {
      STAR: [], PLOWHORSE: [], PUZZLE: [], DOG: [],
    };
    for (const item of items) counts[item.quadrant].push(item);
    const sortedByContribution = (a: MenuEngineeringItem, b: MenuEngineeringItem): number =>
      Number.parseFloat(b.totalContribution.amount) - Number.parseFloat(a.totalContribution.amount);
    return (['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'] as const).map((q) => {
      const list = [...counts[q]].sort(sortedByContribution);
      const totalContribution = list.reduce(
        (acc, it) => acc + Number.parseFloat(it.totalContribution.amount),
        0,
      );
      // Dedupe by name so two distinct products with the same name don't
      // both surface in the top-items list of the same quadrant.
      const seenNames = new Set<string>();
      const topItems: string[] = [];
      for (const item of list) {
        if (topItems.length >= 3) break;
        const key = item.productName.trim().toLocaleLowerCase('es-CO');
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        topItems.push(item.productName);
      }
      return {
        quadrant: q,
        meta: QUADRANT_META[q],
        count: list.length,
        totalContribution,
        topItems,
      };
    });
  });

  readonly groupedItems = computed<{ quadrant: MenuQuadrant; meta: QuadrantMeta; items: MenuEngineeringItem[] }[]>(() => {
    const items = this.items();
    const groups: Record<MenuQuadrant, MenuEngineeringItem[]> = {
      STAR: [], PLOWHORSE: [], PUZZLE: [], DOG: [],
    };
    for (const item of items) groups[item.quadrant].push(item);
    return (['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'] as const)
      .map((q) => ({ quadrant: q, meta: QUADRANT_META[q], items: groups[q] }))
      .filter((g) => g.items.length > 0);
  });

  readonly categories = computed<MenuEngineeringCategoryOption[]>(() => {
    const seen = new Map<number, string>();
    for (const item of this.report()?.items ?? []) {
      if (item.categoryId === null) continue;
      if (!seen.has(item.categoryId)) {
        seen.set(item.categoryId, item.categoryName ?? `Categoría ${String(item.categoryId)}`);
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  });

  readonly stats = computed<MenuEngineeringStats>(() => {
    const items = this.items();
    const totalContribution = items.reduce(
      (acc, it) => acc + Number.parseFloat(it.totalContribution.amount),
      0,
    );
    const m = this.median();
    return {
      count: items.length,
      totalContribution,
      medianVolume: m ? m.volume : null,
      medianMargin: m ? Number.parseFloat(m.margin.amount) : null,
    };
  });

  readonly quadrantChartData = computed(() => {
    const items = this.items();
    const maxUnits = Math.max(1, ...items.map((i) => i.unitsSold));
    const groups: Record<MenuQuadrant, { x: number; y: number; r: number; name: string }[]> = {
      STAR: [], PLOWHORSE: [], PUZZLE: [], DOG: [],
    };
    for (const it of items) {
      groups[it.quadrant].push({
        x: Number.parseFloat(it.grossProfitPerUnit.amount),
        y: Math.max(0, it.unitsSold),
        r: Math.max(4, Math.round((it.unitsSold / maxUnits) * 18)),
        name: it.productName,
      });
    }
    const palette: Record<MenuQuadrant, string> = {
      STAR: '#22c55e', PLOWHORSE: '#f59e0b', PUZZLE: '#3b82f6', DOG: '#ef4444',
    };
    return {
      datasets: (['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'] as const).map((q) => ({
        label: QUADRANT_META[q].label,
        data: groups[q],
        backgroundColor: palette[q] + 'cc',
        borderColor: palette[q],
      })),
    };
  });

  private readonly yTitle = 'Unidades vendidas';

  readonly quadrantChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: { display: true, text: 'Margen por unidad (COP)' },
      },
      y: {
        type: 'linear' as const,
        beginAtZero: true,
        title: { display: true, text: 'Unidades vendidas' },
      },
    },
  };

  readonly selectedQuadrantMeta = computed<QuadrantMeta | null>(() => {
    const q = this.selectedQuadrant();
    return q ? QUADRANT_META[q] : null;
  });

  constructor() {
    effect(() => {
      this.period.period();
      this.cache.menuEngineering.load();
    });
  }

  private readonly period = inject(AnalyticsPeriodState);

  quadrantMeta(q: MenuQuadrant): QuadrantMeta {
    return QUADRANT_META[q];
  }

  quadrantLabel(q: MenuQuadrant): string {
    return QUADRANT_META[q].label;
  }

  quadrantIcon(q: MenuQuadrant): string {
    return QUADRANT_META[q].icon;
  }

  quadrantBorderClass(q: MenuQuadrant): string {
    return QUADRANT_META[q].borderClass;
  }

  quadrantBorderLeftClass(q: MenuQuadrant): string {
    const map: Record<MenuQuadrant, string> = {
      STAR: 'border-l-4 border-green-500',
      PLOWHORSE: 'border-l-4 border-amber-500',
      PUZZLE: 'border-l-4 border-blue-500',
      DOG: 'border-l-4 border-red-500',
    };
    return map[q];
  }

  quadrantBgClass(q: MenuQuadrant): string {
    return QUADRANT_META[q].bgClass;
  }

  quadrantAction(q: MenuQuadrant): string {
    return QUADRANT_META[q].action;
  }

  quadrantSeverity(q: MenuQuadrant): 'success' | 'warn' | 'info' | 'danger' {
    const map = { STAR: 'success', PLOWHORSE: 'warn', PUZZLE: 'info', DOG: 'danger' } as const;
    return map[q];
  }

  /**
   * Numeric accessor for Money.amount, used by the custom sort comparator below.
   * PrimeNG's default sort uses localeCompare on string paths which sorts
   * "1000.00" before "999.00"; this helper makes the sort numeric.
   */
  moneyAmount(item: MenuEngineeringItem, key: 'revenue' | 'grossProfitPerUnit' | 'totalContribution'): number {
    return Number.parseFloat(item[key].amount);
  }

  /** Selling price per unit = total revenue / units sold. Returns null if no units sold. */
  sellPricePerUnit(item: MenuEngineeringItem): MoneyModel | null {
    if (item.unitsSold <= 0) return null;
    const price = Number.parseFloat(item.revenue.amount) / item.unitsSold;
    return { amount: price.toFixed(2), currency: item.revenue.currency };
  }

  /** Margin % = (gross profit per unit / sell price per unit) * 100. Returns null if no units sold. */
  marginPercent(item: MenuEngineeringItem): number | null {
    if (item.unitsSold <= 0) return null;
    const price = Number.parseFloat(item.revenue.amount) / item.unitsSold;
    if (price <= 0) return null;
    const gpPerUnit = Number.parseFloat(item.grossProfitPerUnit.amount);
    return (gpPerUnit / price) * 100;
  }

  fmtPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return `${value.toFixed(1)}%`;
  }

  /** Money wrapper for the total contribution stat card (Money pipe input). */
  totalContributionMoney(): MoneyModel {
    const items = this.items();
    const currency = items[0]?.totalContribution.currency ?? 'COP';
    return { amount: this.stats().totalContribution.toFixed(2), currency };
  }

  /** Money wrapper for the median margin stat card (Money pipe input). */
  medianMarginMoney(): MoneyModel | null {
    const m = this.median();
    return m ? m.margin : null;
  }

  onCategoryChange(value: number | null | undefined): void {
    this.categoryId.set(value ?? undefined);
  }

  clearCategory(): void {
    this.categoryId.set(undefined);
  }

  onQuadrantClick(q: MenuQuadrant): void {
    this.selectedQuadrant.update((current) => (current === q ? null : q));
  }

  clearQuadrantFilter(): void {
    this.selectedQuadrant.set(null);
  }

  isQuadrantSelected(q: MenuQuadrant): boolean {
    return this.selectedQuadrant() === q;
  }

  onSort(event: { data?: MenuEngineeringItem[]; field?: string; order?: number }): void {
    const data = event.data;
    if (!data || !event.field) return;
    const order = event.order ?? 1;
    const field = event.field;
    const compare = (a: MenuEngineeringItem, b: MenuEngineeringItem): number => {
      switch (field) {
        case 'productName':
          return a.productName.localeCompare(b.productName);
        case 'unitsSold':
          return a.unitsSold - b.unitsSold;
        case 'recipeCost':
          return Number.parseFloat(a.recipeCost.amount) - Number.parseFloat(b.recipeCost.amount);
        case 'sellPricePerUnit': {
          const pa = this.sellPricePerUnit(a)?.amount ?? '0';
          const pb = this.sellPricePerUnit(b)?.amount ?? '0';
          return Number.parseFloat(pa) - Number.parseFloat(pb);
        }
        case 'marginPercent': {
          const ma = this.marginPercent(a) ?? 0;
          const mb = this.marginPercent(b) ?? 0;
          return ma - mb;
        }
        case 'revenue':
          return this.moneyAmount(a, 'revenue') - this.moneyAmount(b, 'revenue');
        case 'grossProfitPerUnit':
          return this.moneyAmount(a, 'grossProfitPerUnit') - this.moneyAmount(b, 'grossProfitPerUnit');
        case 'totalContribution':
          return this.moneyAmount(a, 'totalContribution') - this.moneyAmount(b, 'totalContribution');
        default:
          return 0;
      }
    };
    data.sort((x, y) => order * compare(x, y));
  }

  reload(): void { this.cache.menuEngineering.refresh(); }
}
