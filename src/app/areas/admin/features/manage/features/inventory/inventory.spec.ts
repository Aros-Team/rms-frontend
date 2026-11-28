/**
 * Tests for the admin inventory screen's money rendering.
 *
 * Feature: The supplies table renders each variant's `unitCost` — a `MoneyDto`
 * (`{ amount: "15000.00", currency: "COP" }`) on the wire — through the `money`
 * pipe, and flags zero-cost variants with a "Sin costo" tag plus a global
 * warning banner.
 *
 * Contract:
 *  - a `MoneyDto` cost renders as the exact COP string ("$ 12.500"), never
 *    "NaN" nor "$ NaN";
 *  - a missing/unusable cost renders the em dash placeholder;
 *  - `hasZeroUnitCost()` is true when at least one of several variants has a
 *    zero amount, false when every variant carries a positive cost;
 *  - zero-cost variants get the "Sin costo" tag, priced ones do not.
 *
 * Approach: mount the component with its real template (child widgets resolved
 * to empty strings), provide stub services plus a signal-backed `InventoryCache`,
 * feed controlled `MoneyDto` fixtures, and assert the exact rendered text of the
 * cost cell picked by `data-testid`.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { signal, type Signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { Auth } from '@app/core/services/auth/auth';
import { Inventory as InventoryApi } from '@app/core/services/inventory/inventory';
import { Logging } from '@app/core/services/logging/logging';
import { Purchase } from '@app/core/services/purchases/purchase';
import { Supplier } from '@app/core/services/suppliers/supplier';
import { Supply } from '@app/core/services/supplies/supply';
import { WebSocket } from '@app/core/services/websocket/websocket';
import type { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import type { Money } from '@app/shared/models/dto/common/money';
import type { PaginatedSuppliesResponse } from '@app/core/services/supplies/supply';
import { InventoryCache } from './inventory-cache';
import { Inventory } from './inventory';
import inventoryHtml from './inventory.html?raw';

/** jsdom has no IntersectionObserver; the `appLazyLoad` directive needs one. */
class FakeIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: number[] = [];
  // eslint-disable-next-line typescript/no-empty-function
  observe(): void {}
  // eslint-disable-next-line typescript/no-empty-function
  unobserve(): void {}
  // eslint-disable-next-line typescript/no-empty-function
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function makeVariant(
  id: number,
  unitCost: Money,
  name = `Insumo ${String(id)}`,
): SupplyVariantResponse {
  return {
    id,
    supplyId: id * 10,
    supplyName: name,
    categoryId: 1,
    categoryName: 'Carnes',
    unitId: 1,
    unitAbbreviation: 'kg',
    quantity: 1,
    stockBodega: 4,
    stockCocina: 0,
    unitCost,
  };
}

function pageOf(content: SupplyVariantResponse[]): PaginatedSuppliesResponse {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    page: 0,
    size: 20,
  };
}

function resourceStub<T>(data: T | null) {
  const dataSignal: Signal<T | null> = signal<T | null>(data);
  return {
    data: dataSignal,
    isLoading: signal(false),
    hasData: () => data !== null,
    refresh: vi.fn(),
    load: vi.fn(),
    loadIfStale: vi.fn(),
    reset: vi.fn(),
    invalidate: vi.fn(),
  };
}

function cacheStub(content: SupplyVariantResponse[]): {
  suppliesPage: ReturnType<typeof resourceStub<PaginatedSuppliesResponse>>;
  supplies: ReturnType<typeof resourceStub<SupplyVariantResponse[]>>;
  purchases: ReturnType<typeof resourceStub<never[]>>;
  suppliers: ReturnType<typeof resourceStub<never[]>>;
  referenceData: ReturnType<typeof resourceStub<never>>;
  setSuppliesListParams: ReturnType<typeof vi.fn>;
  setSuppliersListParams: ReturnType<typeof vi.fn>;
  setPurchasesListParams: ReturnType<typeof vi.fn>;
} {
  return {
    suppliesPage: resourceStub<PaginatedSuppliesResponse>(pageOf(content)),
    supplies: resourceStub<SupplyVariantResponse[]>(content),
    purchases: resourceStub<never[]>([]),
    suppliers: resourceStub<never[]>([]),
    referenceData: resourceStub<never>(null),
    setSuppliesListParams: vi.fn(),
    setSuppliersListParams: vi.fn(),
    setPurchasesListParams: vi.fn(),
  };
}

describe('Inventory — unit cost rendering', () => {
  let fixture: ComponentFixture<Inventory>;

  /** The component host is always an HTMLElement once the fixture exists. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('inventory.html')) {
        return Promise.resolve(inventoryHtml as unknown as string);
      }
      // Child widgets (PrimeNG table/tag/message, search input, skeleton) are
      // irrelevant to these assertions; render them as empty elements.
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  function setup(content: SupplyVariantResponse[]): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Inventory],
      providers: [
        { provide: InventoryCache, useValue: cacheStub(content) },
        { provide: Auth, useValue: { getToken: () => null, getData: () => ({ id: 1 }) } },
        { provide: InventoryApi, useValue: { transferToKitchen: vi.fn().mockReturnValue(of({})) } },
        { provide: Purchase, useValue: { getPurchases: vi.fn().mockReturnValue(of([])) } },
        { provide: Supplier, useValue: { getSuppliers: vi.fn().mockReturnValue(of([])) } },
        { provide: Supply, useValue: { getSupplyVariants: vi.fn().mockReturnValue(of(content)) } },
        { provide: Logging, useValue: { warn: vi.fn(), error: vi.fn() } },
        {
          provide: WebSocket,
          useValue: { connect: vi.fn(), subscribeToTopic: vi.fn().mockReturnValue(of({})) },
        },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(Inventory);
    fixture.detectChanges();
  }

  it('renders a MoneyDto unit cost as the exact COP string', () => {
    setup([makeVariant(1, { amount: '12500.00', currency: 'COP' })]);

    const cost = host().querySelector('[data-testid="supply-unit-cost"]');

    expect(cost?.textContent.trim()).toMatch(/^\$\s?12\.500$/);
  });

  it('renders the em dash when a variant has no usable unit cost', () => {
    setup([makeVariant(1, null as unknown as Money)]);

    const cost = host().querySelector('[data-testid="supply-unit-cost"]');

    expect(cost?.textContent.trim()).toBe('—');
  });

  it('flags zero cost across several priced variants', () => {
    setup([
      makeVariant(1, { amount: '12500.00', currency: 'COP' }),
      makeVariant(2, { amount: '0.00', currency: 'COP' }),
      makeVariant(3, { amount: '9800.50', currency: 'COP' }),
    ]);

    const component = fixture.componentInstance;

    expect(component.hasZeroUnitCost()).toBe(true);
  });

  it('does not flag zero cost when every variant is priced', () => {
    setup([
      makeVariant(1, { amount: '12500.00', currency: 'COP' }),
      makeVariant(2, { amount: '9800.50', currency: 'COP' }),
    ]);

    const component = fixture.componentInstance;

    expect(component.hasZeroUnitCost()).toBe(false);
  });

  it('renders the "Sin costo" tag only for the zero-cost variant', () => {
    setup([
      makeVariant(1, { amount: '12500.00', currency: 'COP' }),
      makeVariant(2, { amount: '0.00', currency: 'COP' }),
    ]);

    const rows = Array.from(host().querySelectorAll('tbody tr'));
    const tagsPerRow = rows.map((row) => row.querySelector('app-rms-badge') !== null);

    expect(tagsPerRow).toEqual([false, true]);
  });
});
