import { Component, ChangeDetectionStrategy, afterNextRender, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { AnalyticsNav } from './components/analytics-nav/analytics-nav';
import { PeriodSelector } from './components/period-selector/period-selector';

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AnalyticsNav, PeriodSelector],
})
export class Analytics {
  private readonly cache = inject(AnalyticsCache);
  private readonly router = inject(Router);

  readonly periodSelector = viewChild.required(PeriodSelector);

  constructor() {
    afterNextRender(() => {
      this.periodSelector().setVariant('docked');
    });
  }

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  onRefresh(): void {
    const url = this.currentUrl();
    if (url.includes('/menu-engineering')) {
      this.cache.menuEngineering.refresh();
    } else if (url.includes('/operations')) {
      this.cache.operations.refresh();
    } else if (url.includes('/cohort')) {
      this.cache.cohort.refresh();
    } else if (url.includes('/alerts')) {
      this.cache.alerts.refresh();
    } else {
      this.cache.primeCost.refresh();
    }
  }
}
