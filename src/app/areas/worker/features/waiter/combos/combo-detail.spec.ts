/**
 * Tests for the waiter "combo detail" screen.
 *
 * Feature: shows a combo's base price and its additions, each with its extra
 * price embedded in the chip label.
 * Contract:
 *  - a `Money` basePrice (`{ amount: "15000.00", currency: "COP" }`) renders the
 *    formatted COP string, never `NaN` / `$ NaN`;
 *  - the addition chip label is `"<name> (+<formatted extra price>)"`, built in
 *    the component so no money value is concatenated with `+` in the template;
 *  - a legacy numeric extraPrice follows the same formatting.
 *
 * Approach: mount `ComboDetail` with a stubbed `SpecialSelectionsCache`
 * (detail(id) → ResourceCache-like stub) and a stub `ActivatedRoute` whose
 * `paramMap` emits `{ id }`, then assert the exact rendered price and chip
 * labels, normalizing the non-breaking space ICU inserts.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, signal } from '@angular/core';
import { convertToParamMap } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpecialSelectionsCache } from '@app/core/services/special-selections/special-selections-cache';
import { OrderDock } from '@app/core/services/order-dock/order-dock';
import { MasterData } from '@app/core/services/master-data/master-data';
import type { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { ComboDetail } from './combo-detail';
import comboDetailHtml from './combo-detail.html?raw';

function makeCombo(
  basePrice: SpecialSelectionResponse['basePrice'],
  additions: SpecialSelectionResponse['additions'],
): SpecialSelectionResponse {
  return {
    productId: 7,
    name: 'Combo Familiar',
    description: 'Para dos personas',
    basePrice,
    active: true,
    preparationAreaId: 1,
    groups: [],
    additions,
    questions: [],
    schedule: [],
  };
}

/** `Intl` separates the COP symbol from the amount with U+00A0. */
function normalize(text: string): string {
  return text.replace(/\u00a0|\u202f/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('ComboDetail', () => {
  let fixture: ComponentFixture<ComboDetail>;
  let combo: ReturnType<typeof signal<SpecialSelectionResponse | null>>;
  let loading: ReturnType<typeof signal<boolean>>;
  let cacheError: ReturnType<typeof signal<Error | undefined>>;
  let categoryNames: Map<number, string>;
  let productsById: Map<number, { name: string }>;
  let cacheStub: {
    publicDetail: () => {
      data: typeof combo;
      isLoading: typeof loading;
      error: typeof cacheError;
      load: ReturnType<typeof vi.fn>;
    };
  };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('combo-detail.html')) {
        return Promise.resolve(comboDetailHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    combo = signal<SpecialSelectionResponse | null>(null);
    loading = signal(false);
    cacheError = signal<Error | undefined>(undefined);
    categoryNames = new Map([[1, 'Hamburguesas']]);
    productsById = new Map([
      [1, { name: 'Hamburguesa clásica' }],
      [6, { name: 'Hamburguesa doble' }],
    ]);
    cacheStub = {
      publicDetail: () => ({
        data: combo,
        isLoading: loading,
        error: cacheError,
        load: vi.fn(),
      }),
    };

    TestBed.resetTestingModule();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function mount(): void {
    TestBed.configureTestingModule({
      imports: [ComboDetail],
      providers: [
        { provide: SpecialSelectionsCache, useValue: cacheStub },
        { provide: OrderDock, useValue: { addItemToDiner: vi.fn() } },
        {
          provide: MasterData,
          useValue: {
            snapshot: null,
            load: () => of({ products: [], productOptions: [], tables: [] }),
            getCategoryNames: () => categoryNames,
            getProductsById: () => productsById,
          },
        },
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '7' })) },
        },
      ],
    });
    fixture = TestBed.createComponent(ComboDetail);
    fixture.detectChanges();
  }

  it('renders a Money basePrice as the formatted COP string, never NaN', () => {
    combo.set(makeCombo({ amount: '15000.00', currency: 'COP' }, []));
    mount();

    const node = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[data-testid="combo-base-price"]',
    );
    const text = normalize(node?.textContent ?? '');
    expect(text).toBe('$ 15.000');
    expect(text).not.toMatch(/NaN|object/);
  });

  it('builds addition labels with the formatted extra price', () => {
    combo.set(
      makeCombo({ amount: '15000.00', currency: 'COP' }, [
        {
          id: 1,
          name: 'Queso extra',
          optionId: 3,
          extraPrice: { amount: '2500.00', currency: 'COP' },
          displayOrder: 1,
          optionName: 'Queso',
        },
        {
          id: 2,
          name: 'Tocino',
          optionId: 4,
          extraPrice: 1000,
          displayOrder: 2,
          optionName: 'Tocino',
        },
      ]),
    );
    mount();

    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.option__name'),
    ).map((node) => normalize(node.textContent));

    expect(labels).toEqual(['Queso extra (+$ 2.500)', 'Tocino (+$ 1.000)']);
    expect(labels.join(' ')).not.toMatch(/NaN/);
  });

  it('renders the real category and product names for a combo group', () => {
    combo.set({
      ...makeCombo({ amount: '34900.00', currency: 'COP' }, []),
      groups: [
        {
          id: 4,
          categoryId: 1,
          displayOrder: 1,
          required: true,
          minSelections: 1,
          maxSelections: 1,
          productIds: [1, 6],
        },
      ],
    });
    mount();

    const text = normalize((fixture.nativeElement as HTMLElement).textContent);
    expect(text).toContain('Hamburguesas');
    expect(text).toContain('Hamburguesa clásica');
    expect(text).toContain('Hamburguesa doble');
    expect(text).not.toContain('Grupo');
    expect(text).not.toContain('Producto #');
  });
});
