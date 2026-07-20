import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, Component } from '@angular/core';
import { Router, provideRouter, type Routes } from '@angular/router';
import { beforeAll, describe, expect, it } from 'vitest';

import { Analytics } from './analytics';
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
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-analytics-nav')).toBeTruthy();
  });

  it('renders the shared period-selector', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-period-selector')).toBeTruthy();
  });

  it('renders a router-outlet for child routes', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('router-outlet')).toBeTruthy();
  });

  it('shows the section title "Estadísticas" and its description', async () => {
    const fixture = await setup();
    const root = fixture.nativeElement as HTMLElement;
    const heading = root.querySelector('h1');
    expect((heading?.textContent ?? '').trim()).toBe('Estadísticas');
    expect(root.textContent).toContain('Visualiza las estadísticas de tu restaurante');
  });

  it('lands on the prime-cost placeholder when visiting /admin/analytics', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="placeholder-prime-cost"]')).toBeTruthy();
    expect(root.textContent).toContain('Costo primo y márgenes');
  });

  it('renders the menu-engineering placeholder when visiting /admin/analytics/menu-engineering', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/menu-engineering');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="placeholder-menu-engineering"]')).toBeTruthy();
  });

  it('renders the operations placeholder when visiting /admin/analytics/operations', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/operations');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="placeholder-operations"]')).toBeTruthy();
  });

  it('renders the cohort placeholder when visiting /admin/analytics/cohort', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/cohort');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="placeholder-cohort"]')).toBeTruthy();
  });

  it('renders the alerts placeholder when visiting /admin/analytics/alerts', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin/analytics/alerts');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="placeholder-alerts"]')).toBeTruthy();
  });
});