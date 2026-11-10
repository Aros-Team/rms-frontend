/**
 * Tests for the waiter "combos" list screen.
 *
 * Feature: lists the combos available right now and renders each base price.
 * Contract:
 *  - a combo whose `basePrice` arrives as `Money` (`{ amount: "15000.00",
 *    currency: "COP" }`, the wire shape) renders the formatted COP string —
 *    never `NaN`, `$ NaN`, `[object Object]` or a concatenated string;
 *  - a legacy numeric `basePrice` renders the same formatted string;
 *  - an empty list renders the empty state and no price node at all.
 *
 * Approach: mount `Combos` with a stubbed `SpecialSelectionsCache` holding a
 * controlled signal list, then assert the exact text of the price nodes
 * (`data-testid="combo-price"`), normalizing the non-breaking space ICU inserts.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, signal } from '@angular/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpecialSelectionsCache } from '@app/core/services/special-selections/special-selections-cache';
import type { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { Combos } from './combos';
import combosHtml from './combos.html?raw';

function makeCombo(
  id: number,
  name: string,
  basePrice: SpecialSelectionResponse['basePrice'],
): SpecialSelectionResponse {
  return {
    id,
    name,
    description: '',
    basePrice,
    active: true,
    preparationAreaId: 1,
    groups: [],
    additions: [],
    questions: [],
    schedule: [],
  };
}

/** `Intl` separates the COP symbol from the amount with U+00A0. */
function normalize(text: string): string {
  return text.replace(/\u00a0|\u202f/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('Combos', () => {
  let fixture: ComponentFixture<Combos>;
  let combos: ReturnType<typeof signal<SpecialSelectionResponse[]>>;
  let loading: ReturnType<typeof signal<boolean>>;
  let cacheStub: {
    availableNow: {
      data: typeof combos;
      isLoading: typeof loading;
      load: ReturnType<typeof vi.fn>;
      refresh: ReturnType<typeof vi.fn>;
    };
  };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('combos.html')) {
        return Promise.resolve(combosHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    combos = signal<SpecialSelectionResponse[]>([]);
    loading = signal(false);
    cacheStub = {
      availableNow: {
        data: combos,
        isLoading: loading,
        load: vi.fn(),
        refresh: vi.fn(),
      },
    };

    TestBed.resetTestingModule();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function mount(): void {
    TestBed.configureTestingModule({
      imports: [Combos],
      providers: [{ provide: SpecialSelectionsCache, useValue: cacheStub }],
    });
    fixture = TestBed.createComponent(Combos);
    fixture.detectChanges();
  }

  function priceTexts(): string[] {
    const nodes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '[data-testid="combo-price"]',
    );
    return Array.from(nodes).map((node) => normalize(node.textContent));
  }

  it('renders a Money basePrice as the formatted COP string, never NaN', () => {
    combos.set([makeCombo(1, 'Combo Familiar', { amount: '15000.00', currency: 'COP' })]);
    mount();

    const [price] = priceTexts();
    expect(price).toBe('$ 15.000');
    expect(price).not.toMatch(/NaN|object/);
  });

  it('renders a legacy numeric basePrice the same way', () => {
    combos.set([makeCombo(1, 'Combo Personal', 12500)]);
    mount();

    expect(priceTexts()).toEqual(['$ 12.500']);
  });

  it('renders one price per combo, in list order', () => {
    combos.set([
      makeCombo(1, 'Combo A', { amount: '9900.50', currency: 'COP' }),
      makeCombo(2, 'Combo B', { amount: '23000.00', currency: 'COP' }),
    ]);
    mount();

    expect(priceTexts()).toEqual(['$ 9.901', '$ 23.000']);
  });

  it('shows the empty state and no price node when there are no combos', () => {
    combos.set([]);
    mount();

    expect(priceTexts()).toEqual([]);
    const empty = (fixture.nativeElement as HTMLElement).querySelector('h2');
    expect(normalize(empty?.textContent ?? '')).toBe('No hay combos disponibles');
    expect(cacheStub.availableNow.load).toHaveBeenCalledTimes(1);
  });
});
