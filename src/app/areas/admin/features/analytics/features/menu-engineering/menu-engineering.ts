import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { MoneyPipe } from '@app/shared/pipes/money';
import { DataCompleteness } from '@app/shared/models/dto/analytics/data-completeness';
import { Money } from '@app/shared/models/dto/analytics/money';
import {
  MenuEngineeringItem,
  MenuQuadrant,
} from '@app/shared/models/dto/analytics/menu-engineering-report';

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
    TagModule,
    MoneyPipe,
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

  readonly items = computed<MenuEngineeringItem[]>(() => {
    const all = this.report()?.items ?? [];
    const cat = this.categoryId();
    if (cat === undefined) return all;
    return all.filter((i) => i.categoryId === cat);
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
        y: it.unitsSold,
        r: Math.max(4, Math.round((it.unitsSold / maxUnits) * 18)),
        name: it.productName,
      });
    }
    const palette: Record<MenuQuadrant, string> = {
      STAR: '#22c55e', PLOWHORSE: '#f59e0b', PUZZLE: '#3b82f6', DOG: '#ef4444',
    };
    return {
      datasets: (['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'] as const).map((q) => ({
        label: q,
        data: groups[q],
        backgroundColor: palette[q] + 'cc',
        borderColor: palette[q],
      })),
    };
  });

  readonly quadrantChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
    },
    scales: {
      x: { title: { display: true, text: 'Margen por unidad (COP)' } },
      y: { title: { display: true, text: 'Unidades vendidas' }, beginAtZero: true },
    },
  };

  constructor() {
    this.cache.menuEngineering.loadIfStale();
  }

  quadrantLabel(q: MenuQuadrant): string {
    return { STAR: 'Estrella', PLOWHORSE: 'Caballo', PUZZLE: 'Rompecabezas', DOG: 'Perro' }[q];
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

  /** Money wrapper for the total contribution stat card (Money pipe input). */
  totalContributionMoney(): Money {
    const items = this.items();
    const currency = items[0]?.totalContribution.currency ?? 'COP';
    return { amount: this.stats().totalContribution.toFixed(2), currency };
  }

  /** Money wrapper for the median margin stat card (Money pipe input). */
  medianMarginMoney(): Money | null {
    const m = this.median();
    return m ? m.margin : null;
  }

  onCategoryChange(value: number | null | undefined): void {
    this.categoryId.set(value ?? undefined);
  }

  clearCategory(): void {
    this.categoryId.set(undefined);
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
        case 'categoryName':
          return (a.categoryName ?? '').localeCompare(b.categoryName ?? '');
        case 'unitsSold':
          return a.unitsSold - b.unitsSold;
        case 'revenue':
          return this.moneyAmount(a, 'revenue') - this.moneyAmount(b, 'revenue');
        case 'grossProfitPerUnit':
          return this.moneyAmount(a, 'grossProfitPerUnit') - this.moneyAmount(b, 'grossProfitPerUnit');
        case 'totalContribution':
          return this.moneyAmount(a, 'totalContribution') - this.moneyAmount(b, 'totalContribution');
        case 'quadrant':
          return a.quadrant.localeCompare(b.quadrant);
        default:
          return 0;
      }
    };
    data.sort((x, y) => order * compare(x, y));
  }

  reload(): void { this.cache.menuEngineering.refresh(); }
}