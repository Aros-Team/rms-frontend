import { Component, inject, computed, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';

import { ButtonModule } from 'primeng/button';

import { SpecialSelectionsCache } from '@app/core/services/special-selections/special-selections-cache';
import { Money } from '@app/shared/pipes/money/money';

@Component({
  selector: 'app-combos-waiter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combos.html',
  styleUrl: './combos.css',
  imports: [ButtonModule, Money],
})
export class Combos {
  private cache = inject(SpecialSelectionsCache);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  combos = computed(() => this.cache.availableNow.data() ?? []);
  loading = computed(() => this.cache.availableNow.isLoading());

  constructor() {
    this.cache.availableNow.load();

    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cache.availableNow.refresh();
      });
  }

  selectCombo(id: number): void {
    void this.router.navigate(['/worker/waiter/combos', id]);
  }
}
