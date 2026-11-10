/**
 * Tests for the Analytics area routing and child component resolution.
 *
 * Feature: Analytics area with lazy-loaded child routes.
 * Contract: Router navigates to analytics sub-routes and renders correct components.
 * Approach: Bootstrap TestBed with analytics routes, navigate, assert component rendered.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Router, provideRouter, type Routes } from '@angular/router';
import { beforeAll, describe, expect, it } from 'vitest';

import { Analytics } from './analytics';
import { AnalyticsNav } from './components/analytics-nav/analytics-nav';
import { PeriodSelector } from './components/period-selector/period-selector';
import analyticsHtml from './analytics.html?raw';

@Component({
  selector: 'app-stub-analytics-prime-cost',
  template: '<div data-testid="placeholder-prime-cost">Costo primo y márgenes</div>',
})
class StubPrimeCost {
  readonly marker = 'prime-cost' as const;
}

@Component({
  selector: 'app-stub-analytics-menu-engineering',
  template: '<div data-testid="placeholder-menu-engineering">Carta</div>',
})
class StubMenuEngineering {
  readonly marker = 'menu-engineering' as const;
}

@Component({
  selector: 'app-stub-analytics-operations',
  template: '<div data-testid="placeholder-operations">Operaciones</div>',
})
class StubOperations {
  readonly marker = 'operations' as const;
}

@Component({
  selector: 'app-stub-analytics-cohort',
  template: '<div data-testid="placeholder-cohort">Cohorte</div>',
})
class StubCohort {
  readonly marker = 'cohort' as const;
}

@Component({
  selector: 'app-stub-analytics-alerts',
  template: '<div data-testid="placeholder-alerts">Alertas</div>',
})
class StubAlerts {
  readonly marker = 'alerts' as const;
}

const ANALYTICS_ROUTES: Routes = [
  {
    path: 'admin/analytics',
    loadComponent: () => Promise.resolve(Analytics),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'prime-cost' },
      { path: 'prime-cost', component: StubPrimeCost },
      { path: 'menu-engineering', component: StubMenuEngineering },
      { path: 'operations', component: StubOperations },
      { path: 'cohort', component: StubCohort },
      { path: 'alerts', component: StubAlerts },
    ],
  },
];

describe('Analytics shell', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('analytics.html')) {
        return Promise.resolve(analyticsHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(): Promise<ComponentFixture<Analytics>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Analytics],
      providers: [provideRouter(ANALYTICS_ROUTES)],
    }).compileComponents();
    const fixture = TestBed.createComponent(Analytics);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the shared analytics-nav', async () => {
    const fixture = await setup();
    const nav = fixture.debugElement.query(By.directive(AnalyticsNav));
    expect(nav.componentInstance).toBeInstanceOf(AnalyticsNav);
  });

  it('renders the shared period-selector', async () => {
    const fixture = await setup();
    const selector = fixture.debugElement.query(By.directive(PeriodSelector));
    expect(selector.componentInstance).toBeInstanceOf(PeriodSelector);
  });

  it('docks the period-selector inside the content section', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const section = root.querySelector('section');
    const selectorEl = root.querySelector('app-period-selector');
    expect(section).not.toBeNull();
    expect(selectorEl).not.toBeNull();
    expect(section?.contains(selectorEl as Node)).toBe(true);
    expect(section?.querySelector('router-outlet')?.parentElement?.contains(selectorEl as Node)).toBe(
      false,
    );
  });

  it('renders a router-outlet for child routes', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/prime-cost');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const outlet = root.querySelector('router-outlet');
    const placeholder = root.querySelector('[data-testid="placeholder-prime-cost"]');
    expect(outlet).not.toBeNull();
    expect(placeholder).not.toBeNull();
    // The activated child route renders inside the outlet's host container.
    expect(outlet?.parentElement?.contains(placeholder as Node)).toBe(true);
  });

  it('lands on the prime-cost placeholder when visiting /admin/analytics', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const placeholder = root.querySelector('[data-testid="placeholder-prime-cost"]');
    expect(placeholder?.textContent.trim()).toBe('Costo primo y márgenes');
  });

  it('renders the menu-engineering placeholder when visiting /admin/analytics/menu-engineering', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/menu-engineering');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const placeholder = root.querySelector('[data-testid="placeholder-menu-engineering"]');
    expect(placeholder?.textContent.trim()).toBe('Carta');
  });

  it('renders the operations placeholder when visiting /admin/analytics/operations', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/operations');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const placeholder = root.querySelector('[data-testid="placeholder-operations"]');
    expect(placeholder?.textContent.trim()).toBe('Operaciones');
  });

  it('renders the cohort placeholder when visiting /admin/analytics/cohort', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/cohort');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const placeholder = root.querySelector('[data-testid="placeholder-cohort"]');
    expect(placeholder?.textContent.trim()).toBe('Cohorte');
  });

  it('renders the alerts placeholder when visiting /admin/analytics/alerts', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/alerts');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const placeholder = root.querySelector('[data-testid="placeholder-alerts"]');
    expect(placeholder?.textContent.trim()).toBe('Alertas');
  });
});