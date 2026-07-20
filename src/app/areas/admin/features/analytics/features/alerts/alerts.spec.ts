import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { of, throwError } from 'rxjs';

import { Analytics } from '@app/core/services/analytics/analytics';
import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { Alert, AlertsPage } from '@app/shared/models/dto/analytics/alert';

import { Alerts } from './alerts';
import alertsHtml from './alerts.html?raw';

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 1,
    severity: 'RED',
    type: 'FOOD_COST_DEVIATION',
    message: 'Food cost is 4.2pp above 12-month MA',
    metric: 'food_cost_pct',
    baseline: { amount: '28.50' },
    current:  { amount: '32.70' },
    deviationPct: 14.74,
    period: '2026-07',
    detectedAt: '2026-07-17T02:00:00Z',
    status: 'OPEN',
    ...overrides,
  };
}

function makePage(items: Alert[], total = items.length): AlertsPage {
  return {
    items,
    page: { limit: 50, offset: 0, total },
  };
}

function makeApiStub(opts: {
  page?: AlertsPage;
  error?: Error;
} = {}) {
  return {
    listAlerts: vi.fn((filters: { status?: string; severity?: string; limit: number; offset: number }) => {
      void filters;
      if (opts.error) return throwError(() => opts.error);
      return of(opts.page ?? makePage([], 0));
    }),
    markAlertRead: vi.fn(() => of(undefined)),
  };
}

function makeCacheStub() {
  return {
    alerts: {
      data: (): null => null,
      isLoading: (): boolean => false,
      error: (): null => null,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      refresh: (): void => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      invalidate: (): void => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      loadIfStale: (): void => {},
    },
    primeCost: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    menuEngineering: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    operations: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    cohort: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
  };
}

describe('Alerts', () => {
  let api: ReturnType<typeof makeApiStub>;
  let cache: ReturnType<typeof makeCacheStub>;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('alerts.html')) return Promise.resolve(alertsHtml as unknown as string);
      return Promise.resolve('');
    });
  });

  async function setup(opts: Parameters<typeof makeApiStub>[0] = {}): Promise<ComponentFixture<Alerts>> {
    TestBed.resetTestingModule();
    api = makeApiStub(opts);
    cache = makeCacheStub();
    await TestBed.configureTestingModule({
      imports: [Alerts],
      providers: [
        { provide: Analytics, useValue: api },
        { provide: AnalyticsCache, useValue: cache },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Alerts);
    fixture.detectChanges();
    return fixture;
  }

  function getRoot(fixture: ComponentFixture<Alerts>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('initial fetch invokes api.listAlerts with default filters', async () => {
    await setup({ page: makePage([], 0) });
    expect(api.listAlerts).toHaveBeenCalled();
    const firstCall = api.listAlerts.mock.calls[0]?.[0] as { limit: number; offset: number };
    expect(firstCall.limit).toBe(50);
    expect(firstCall.offset).toBe(0);
  });

  it('renders summary cards counting OPEN/RED/YELLOW/INFO', async () => {
    const items = [
      makeAlert({ id: 1, status: 'OPEN', severity: 'RED' }),
      makeAlert({ id: 2, status: 'OPEN', severity: 'RED' }),
      makeAlert({ id: 3, status: 'READ', severity: 'YELLOW' }),
      makeAlert({ id: 4, status: 'OPEN', severity: 'INFO' }),
    ];
    const fixture = await setup({ page: makePage(items) });
    const text = getRoot(fixture).textContent;
    expect(text).toContain('Abiertas');
    expect(text).toContain('Rojas');
    expect(text).toContain('Amarillas');
    expect(text).toContain('Info');
  });

  it('renders empty state when items list is empty', async () => {
    const fixture = await setup({ page: makePage([], 0) });
    const text = getRoot(fixture).textContent;
    expect(text).toContain('No hay alertas');
  });

  it('renders the alert rows in the table', async () => {
    const items = [
      makeAlert({ id: 1, message: 'Mensaje crítico A' }),
      makeAlert({ id: 2, severity: 'YELLOW', message: 'Mensaje B', status: 'OPEN' }),
    ];
    const fixture = await setup({ page: makePage(items) });
    const text = getRoot(fixture).textContent;
    expect(text).toContain('Mensaje crítico A');
    expect(text).toContain('Mensaje B');
  });

  it('passes filter params to api.listAlerts', async () => {
    await setup({ page: makePage([makeAlert()], 1) });
    const call = api.listAlerts.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(call).toBeDefined();
    expect(call?.['limit']).toBe(50);
    expect(call?.['offset']).toBe(0);
  });

  it('shows error message via p-message when api errors', async () => {
    const fixture = await setup({ error: new Error('Network down') });
    const msg = getRoot(fixture).querySelector('p-message');
    expect(msg).toBeTruthy();
  });

  it('invokes api.markAlertRead with the right id on click', async () => {
    const items = [makeAlert({ id: 17 })];
    const fixture = await setup({ page: makePage(items) });
    const btn = Array.from(getRoot(fixture).querySelectorAll('button')).find((b: HTMLButtonElement) =>
      b.textContent?.includes('Marcar leída'));
    expect(btn).toBeTruthy();
    btn?.click();
    expect(api.markAlertRead).toHaveBeenCalledWith(17);
  });

  it('maps severities to PrimeNG colors', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.severityColor('RED')).toBe('danger');
    expect(component.severityColor('YELLOW')).toBe('warn');
    expect(component.severityColor('INFO')).toBe('info');
  });

  it('maps statuses to Spanish labels', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.statusLabel('OPEN')).toBe('Abierta');
    expect(component.statusLabel('READ')).toBe('Leída');
    expect(component.statusLabel('DISMISSED')).toBe('Descartada');
  });

  it('formats deviation percentage with sign', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.deviationFmt(14.74)).toBe('+14.74%');
    expect(component.deviationFmt(-3.5)).toBe('-3.50%');
    expect(component.deviationFmt(0)).toBe('+0.00%');
  });
});
