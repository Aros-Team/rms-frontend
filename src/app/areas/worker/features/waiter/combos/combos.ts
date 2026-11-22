import { Component, ChangeDetectionStrategy, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';

import { SpecialSelectionsCache } from '@app/core/services/special-selections/special-selections-cache';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Money } from '@app/shared/pipes/money/money';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import type {
  SpecialSelectionGroupResponse,
} from '@app/shared/models/dto/special-selections/special-selection-group';
import type { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';

/**
 * Waiter "Menú del día".
 *
 * Feature: the combos available right now, with their real group names.
 *
 * Contract:
 *  - the API does not send `categoryName`, so each group is resolved against
 *    the categories already loaded with the products; a generic "Grupo" label
 *    is never rendered (P3-WA-15);
 *  - the list refreshes every minute and offers an explicit retry on failure;
 *  - the empty state explains the availability window instead of a dead end.
 */
@Component({
  selector: 'app-combos-waiter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combos.html',
  styleUrl: './combos.css',
  imports: [Money, RmsButton, RmsSkeleton, RmsStatusPill],
})
export class Combos {
  private readonly cache = inject(SpecialSelectionsCache);
  private readonly masterData = inject(MasterData);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly combos = computed(() => this.cache.availableNow.data() ?? []);
  readonly loading = computed(() => this.cache.availableNow.isLoading());
  readonly error = computed(() => this.cache.availableNow.error() ?? null);

  private readonly categoryNames = signal<Map<number, string>>(new Map());
  private readonly productNames = signal<Map<number, string>>(new Map());

  constructor() {
    this.cache.availableNow.load();
    this.loadReferenceData();

    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cache.availableNow.refresh();
      });
  }

  /** Master data gives both the category names and the product names. */
  private loadReferenceData(): void {
    const apply = (): void => {
      this.categoryNames.set(this.masterData.getCategoryNames());
      this.productNames.set(
        new Map([...this.masterData.getProductsById()].map(([id, product]) => [id, product.name])),
      );
    };

    if (this.masterData.snapshot) {
      apply();
      return;
    }

    this.masterData
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: apply, error: () => undefined });
  }

  groupName(group: SpecialSelectionGroupResponse): string {
    if (group.categoryName) return group.categoryName;
    if (group.categoryId !== null) {
      const name = this.categoryNames().get(group.categoryId);
      if (name) return name;
    }
    return `Selección ${String(group.displayOrder)}`;
  }

  /** Product names inside a group, used for the availability preview. */
  groupProducts(combo: SpecialSelectionResponse, group: SpecialSelectionGroupResponse): string {
    const names = group.productIds
      .map((id) => this.productNames().get(id))
      .filter((name): name is string => Boolean(name));
    return names.join(' · ');
  }

  comboGroups(combo: SpecialSelectionResponse): string {
    return combo.groups.map((group) => this.groupName(group)).join(' · ');
  }

  selectCombo(id: number): void {
    void this.router.navigate(['/worker/combos', id]);
  }

  goToCarta(): void {
    void this.router.navigate(['/worker/waiter'], { queryParams: { tab: 'carta' } });
  }

  refresh(): void {
    this.cache.availableNow.refresh();
  }
}
