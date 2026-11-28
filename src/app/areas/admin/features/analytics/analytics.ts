import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsNav } from './components/analytics-nav/analytics-nav';
import { PeriodSelector } from './components/period-selector/period-selector';

/**
 * Analytics workspace shell.
 *
 * Keeps the existing section frame and renders one shared period selector for
 * all five modules. Refresh asks the backend to rebuild the rollups/caches and
 * then bumps the period revision, so every mounted section reloads without
 * losing its current data while the request is in flight.
 */
@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AnalyticsNav, PeriodSelector],
})
export class Analytics {
  private readonly cache = inject(AnalyticsCache);
  private readonly destroyRef = inject(DestroyRef);

  readonly periodSelector = viewChild.required(PeriodSelector);
  readonly refreshing = signal(false);

  constructor() {
    afterNextRender(() => {
      this.periodSelector().setVariant('docked');
    });
  }

  onRefresh(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.cache
      .refreshAll()
      .pipe(
        finalize(() => {
          this.refreshing.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: () => {
          // The sections reload through the revision bump; the notice shows failures.
        },
      });
  }
}
