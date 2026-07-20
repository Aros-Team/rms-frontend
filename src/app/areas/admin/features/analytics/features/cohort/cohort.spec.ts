import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AnalyticsCache } from '@app/core/services/analytics/analytics-cache';
import { CohortReport } from '@app/shared/models/dto/analytics/cohort-report';
import { Money } from '@app/shared/models/dto/analytics/money';

import { Cohort } from './cohort';
import cohortHtml from './cohort.html?raw';

function money(amount: string): Money {
  return { amount, currency: 'COP' };
}

function makeReport(overrides: Partial<CohortReport> = {}): CohortReport {
  return {
    period: { bucket: 'monthly', from: '2026-02', to: '2026-07', keys: ['2026-02', '2026-07'] },
    newClients: 1820,
    recurringClients: 943,
    totalOrders: 2763,
    recurringRatePct: 34.13,
    averageTicketPerOrder: money('45232.00'),
    averageTicketPerCover: money('22616.00'),
    fingerprintStrategy: 'PHONE_OR_TABLE',
    dataCompleteness: 'FULL',
    ...overrides,
  };
}

interface CohortStub {
  data: () => CohortReport | null;
  isLoading: () => boolean;
  error: () => Error | null;
  refresh: () => void;
  loadIfStale: () => void;
  invalidate: () => void;
}

function makeCacheStub(cohortOverrides: Partial<CohortStub> = {}) {
  const cohort: CohortStub = {
    data: (): CohortReport | null => null,
    isLoading: (): boolean => false,
    error: (): Error | null => null,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    refresh: (): void => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    loadIfStale: (): void => {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    invalidate: (): void => {},
    ...cohortOverrides,
  };
  return {
    cohort,
    primeCost: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    menuEngineering: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    operations: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
    alerts: { data: (): null => null, isLoading: (): boolean => false, error: (): null => null },
  };
}

function installCanvasContextStub(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  if (proto.__cohortStubbed) return;

  const stubContext = {
    canvas: { width: 0, height: 0 },
    fillRect: () => undefined,
    clearRect: () => undefined,
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' }),
    putImageData: () => undefined,
    createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: 'srgb' }),
    setTransform: () => undefined,
    drawImage: () => undefined,
    save: () => undefined,
    fillText: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    stroke: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    rotate: () => undefined,
    arc: () => undefined,
    fill: () => undefined,
    measureText: () => ({ width: 0 }),
    transform: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
  };

  HTMLCanvasElement.prototype.getContext = function (): unknown {
    return stubContext;
  } as typeof HTMLCanvasElement.prototype.getContext;
  proto.__cohortStubbed = true;
}

describe('Cohort', () => {
  beforeAll(async () => {
    installCanvasContextStub();
    await resolveComponentResources((url: string) => {
      if (url.endsWith('cohort.html')) {
        return Promise.resolve(cohortHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(cohortOverrides: Partial<CohortStub> = {}): Promise<ComponentFixture<Cohort>> {
    TestBed.resetTestingModule();
    const stub = makeCacheStub(cohortOverrides);
    await TestBed.configureTestingModule({
      imports: [Cohort],
      providers: [{ provide: AnalyticsCache, useValue: stub }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Cohort);
    fixture.detectChanges();
    return fixture;
  }

  function getRoot(fixture: ComponentFixture<Cohort>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders skeleton state when isLoading=true and report=null', async () => {
    const fixture = await setup({ data: () => null, isLoading: () => true, error: () => null });
    const skeletons = getRoot(fixture).querySelectorAll('p-skeleton');
    expect(skeletons.length).toBe(5);
  });

  it('renders 4 KPI cards with formatted counts and rate', async () => {
    const fixture = await setup({ data: () => makeReport(), isLoading: () => false, error: () => null });
    const text = getRoot(fixture).textContent;
    expect(text).toContain('Clientes nuevos');
    expect(text).toContain('Clientes recurrentes');
    expect(text).toContain('Total pedidos');
    expect(text).toContain('Tasa de recurrencia');
    expect(text).toContain('34.13');
    expect(text).toContain('1.820');
  });

  it('renders ticket medio cards (per order / per cover)', async () => {
    const fixture = await setup({ data: () => makeReport(), isLoading: () => false, error: () => null });
    const text = getRoot(fixture).textContent;
    expect(text).toContain('Por pedido');
    expect(text).toContain('Por cubierto');
  });

  it('renders fingerprint strategy banner with Spanish label', async () => {
    const fixture = await setup({ data: () => makeReport(), isLoading: () => false, error: () => null });
    const text = getRoot(fixture).textContent;
    expect(text).toContain('Estrategia de huella');
    expect(text).toContain('Teléfono o mesa');
  });

  it('maps all three fingerprint strategies to Spanish labels', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    expect(component.fingerprintLabel('PHONE')).toBe('Teléfono');
    expect(component.fingerprintLabel('PHONE_OR_TABLE')).toBe('Teléfono o mesa');
    expect(component.fingerprintLabel('TABLE_ONLY')).toBe('Sólo mesa');
  });

  it('renders doughnut chart', async () => {
    const fixture = await setup({ data: () => makeReport(), isLoading: () => false, error: () => null });
    expect(getRoot(fixture).querySelector('p-chart')).toBeTruthy();
  });

  it('shows PARTIAL banner with notes when completeness=PARTIAL and notes present', async () => {
    const fixture = await setup({
      data: () => makeReport({ dataCompleteness: 'PARTIAL', notes: ['Phones captured on 62% of orders'] }),
      isLoading: () => false,
      error: () => null,
    });
    const text = getRoot(fixture).textContent;
    expect(text).toContain('Datos parciales');
    expect(text).toContain('Phones captured on 62%');
  });

  it('shows EMPTY banner when completeness=EMPTY', async () => {
    const fixture = await setup({
      data: () => makeReport({ dataCompleteness: 'EMPTY', notes: [] }),
      isLoading: () => false,
      error: () => null,
    });
    const text = getRoot(fixture).textContent;
    expect(text).toContain('Sin datos en el periodo');
  });

  it('shows error message via p-message when error() is set', async () => {
    const fixture = await setup({ data: () => null, isLoading: () => false, error: () => new Error('Network down') });
    expect(getRoot(fixture).querySelector('p-message')).toBeTruthy();
  });

  it('invokes cache.cohort.refresh on reload click', async () => {
    const refresh = vi.fn();
    const fixture = await setup({
      data: () => makeReport(),
      isLoading: () => false,
      error: () => null,
      refresh,
    });
    const btn = Array.from(getRoot(fixture).querySelectorAll('button')).find(
      (b: HTMLButtonElement) => b.textContent.includes('Actualizar'),
    );
    expect(btn).toBeTruthy();
    btn?.click();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
