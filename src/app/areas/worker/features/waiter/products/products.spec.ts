/**
 * Tests for the waiter "carta" (product grid) screen.
 *
 * Feature: renders the product catalogue by category with each product's price.
 * Contract:
 *  - a product whose `basePrice` arrives as `Money`
 *    (`{ amount: "12000.00", currency: "COP" }`) renders the formatted COP
 *    string, never `NaN` / `$ NaN` / `[object Object]`;
 *  - a legacy numeric price renders the same formatted string;
 *  - a search query filters the grid, so a non-matching product's price is not
 *    rendered at all.
 *
 * Approach: mount `Products` with a stubbed `MasterData` (load() → of(payload),
 * getProductsByCategory() → controlled record), then assert the exact text of
 * the `data-testid="product-price"` nodes, normalizing the non-breaking space
 * ICU inserts.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { of } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { MasterData, type MasterDataPayload } from '@app/core/services/master-data/master-data';
import { OrderDock } from '@app/core/services/order-dock/order-dock';
import { Logging } from '@app/core/services/logging/logging';
import { ProductImage } from '@app/core/services/product-image/product-image';
import type { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { Products } from './products';
import productsHtml from './products.html?raw';

function makeProduct(
  id: number,
  name: string,
  categoryName: string,
  basePrice: ProductListResponse['basePrice'],
): ProductListResponse {
  return {
    id,
    name,
    description: '',
    basePrice,
    active: true,
    categoryId: 1,
    categoryName,
    areaId: 1,
  };
}

/** `Intl` separates the COP symbol from the amount with U+00A0. */
function normalize(text: string): string {
  return text.replace(/\u00a0|\u202f/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('Products', () => {
  let fixture: ComponentFixture<Products>;
  let byCategory: Record<string, ProductListResponse[]>;

  const payload: MasterDataPayload = { products: [], productOptions: [], tables: [] };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('products.html')) {
        return Promise.resolve(productsHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    byCategory = {
      Bebidas: [
        makeProduct(1, 'Café americano', 'Bebidas', { amount: '12000.00', currency: 'COP' }),
        makeProduct(2, 'Jugo natural', 'Bebidas', { amount: '8500.00', currency: 'COP' }),
      ],
    };

    TestBed.resetTestingModule();
  });

  afterEach(() => {
    fixture.destroy();
  });

  function mount(): void {
    TestBed.configureTestingModule({
      imports: [Products],
      providers: [
        {
          provide: MasterData,
          useValue: {
            load: () => of(payload),
            getProductsByCategory: () => byCategory,
            getProductOptions: () => of([]),
          },
        },
        { provide: OrderDock, useValue: { addItemToDiner: vi.fn() } },
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
        { provide: ProductImage, useValue: { getImages: () => of([]) } },
      ],
    });
    fixture = TestBed.createComponent(Products);
    fixture.detectChanges();
  }

  function priceTexts(): string[] {
    const nodes = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '[data-testid="product-price"]',
    );
    return Array.from(nodes).map((node) => normalize(node.textContent));
  }

  it('renders a Money basePrice as the formatted COP string, never NaN', () => {
    mount();

    const [first] = priceTexts();
    expect(first).toBe('$ 12.000');
    expect(first).not.toMatch(/NaN|object/);
  });

  it('renders a legacy numeric basePrice the same way', () => {
    mount();

    expect(priceTexts()).toEqual(['$ 12.000', '$ 8.500']);
  });

  it('drops the price nodes of products filtered out by the search query', () => {
    mount();

    fixture.componentInstance.searchQuery.set('jugo');
    fixture.detectChanges();

    expect(priceTexts()).toEqual(['$ 8.500']);
  });
});
