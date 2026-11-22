/**
 * Tests for the analytics workspace shell.
 *
 * Feature: one shell, one period selector and five child sections.
 * Contract: the selector is docked inside the content frame, every route
 * resolves, and the refresh action calls the shared cache rebuild.
 * Approach: TestBed with stub child routes and a cache stub.
 */
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter, type Routes } from '@angular/router';
import { of } from 'rxjs';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';

import { Analytics } from './analytics';
import { AnalyticsNav } from './components/analytics-nav/analytics-nav';
import { PeriodSelector } from './components/period-selector/period-selector';
import analyticsHtmlRaw from './analytics.html?raw';
import navHtmlRaw from './components/analytics-nav/analytics-nav.html?raw';
import selectorHtmlRaw from './components/period-selector/period-selector.html?raw';
import { makeCacheStub, resolveTemplates } from './testing/analytics-testing';

const analyticsHtml = analyticsHtmlRaw as string;
const navHtml = navHtmlRaw as string;
const selectorHtml = selectorHtmlRaw as string;

@Component({ selector: 'app-stub-prime-cost', template: '<div data-testid="prime-cost">Rentabilidad</div>' })
class StubPrimeCost {
  readonly marker = 'prime-cost' as const;
}

@Component({ selector: 'app-stub-menu', template: '<div data-testid="menu">Carta</div>' })
class StubMenu {
  readonly marker = 'menu' as const;
}

@Component({ selector: 'app-stub-operations', template: '<div data-testid="operations">Operación</div>' })
class StubOperations {
  readonly marker = 'operations' as const;
}

@Component({ selector: 'app-stub-cohort', template: '<div data-testid="cohort">Cohortes</div>' })
class StubCohort {
  readonly marker = 'cohort' as const;
}

@Component({ selector: 'app-stub-alerts', template: '<div data-testid="alerts">Alertas</div>' })
class StubAlerts {
  readonly marker = 'alerts' as const;
}

const ROUTES: Routes = [
  {
    path: 'admin/analytics',
    component: Analytics,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'prime-cost' },
      { path: 'prime-cost', component: StubPrimeCost },
      { path: 'menu-engineering', component: StubMenu },
      { path: 'operations', component: StubOperations },
      { path: 'cohort', component: StubCohort },
      { path: 'alerts', component: StubAlerts },
    ],
  },
];

describe('Analytics shell', () => {
  beforeAll(async () => {
    await resolveTemplates({
      'analytics.html': analyticsHtml,
      'analytics-nav.html': navHtml,
      'period-selector.html': selectorHtml,
    });
  });

  async function setup(): Promise<{
    fixture: ComponentFixture<Analytics>;
    cache: ReturnType<typeof makeCacheStub>;
  }> {
    TestBed.resetTestingModule();
    const cache = makeCacheStub();
    await TestBed.configureTestingModule({
      imports: [Analytics],
      providers: [provideRouter(ROUTES), { provide: AnalyticsCache, useValue: cache }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Analytics);
    fixture.detectChanges();
    return { fixture, cache };
  }

  it('renders the shared nav and period selector', async () => {
    const { fixture } = await setup();
    expect(fixture.debugElement.query(By.directive(AnalyticsNav))).not.toBeNull();
    expect(fixture.debugElement.query(By.directive(PeriodSelector))).not.toBeNull();
  });

  it('keeps the period selector docked inside the content frame', async () => {
    const { fixture } = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const frame = root.querySelector('.analytics-shell__frame');
    const selector = root.querySelector('app-period-selector');
    expect(frame).not.toBeNull();
    expect(selector).not.toBeNull();
    expect(frame?.contains(selector as Node)).toBe(true);
  });

  it.each([
    ['/admin/analytics/prime-cost', 'prime-cost'],
    ['/admin/analytics/menu-engineering', 'menu'],
    ['/admin/analytics/operations', 'operations'],
    ['/admin/analytics/cohort', 'cohort'],
    ['/admin/analytics/alerts', 'alerts'],
  ])('resolves %s', async (url, testId) => {
    const { fixture } = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
  });

  it('asks the cache to rebuild on refresh', async () => {
    const { fixture, cache } = await setup();
    const refreshAll = vi.fn(() => of({ refreshed: true }));
    cache.refreshAll = refreshAll;
    fixture.componentInstance.onRefresh();
    expect(refreshAll).toHaveBeenCalledTimes(1);
  });
});
