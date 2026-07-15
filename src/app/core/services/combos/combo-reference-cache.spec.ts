import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ComboReferenceCache } from './combo-reference-cache';
import { Category } from '@app/core/services/category/category';
import { Product } from '@app/core/services/products/product';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';

describe('ComboReferenceCache', () => {
  let cache: ComboReferenceCache;
  let httpMock: HttpTestingController;

  const mockCategories: CategorySimpleResponse[] = [
    { id: 1, name: 'Bebidas', enabled: true },
    { id: 2, name: 'Combos', enabled: true },
    { id: 3, name: 'Postres', enabled: false },
  ];

  const mockProducts: ProductResponse[] = [
    {
      id: 100,
      name: 'Jugo de Naranja',
      basePrice: 5,
      active: true,
      categoryId: 1,
      categoryName: 'Bebidas',
      areaId: 1,
      areaName: 'Cocina',
      recipe: [],
      selectionType: 'STANDARD',
      baseRecipeEnabled: false,
      schedulingRequired: false,
    },
    {
      id: 200,
      name: 'Combo Almuerzo',
      basePrice: 12.5,
      active: true,
      categoryId: 2,
      categoryName: 'Combos',
      areaId: 1,
      areaName: 'Cocina',
      recipe: [],
      selectionType: 'SPECIAL_SELECTION',
      baseRecipeEnabled: false,
      schedulingRequired: true,
    },
    {
      id: 201,
      name: 'Combo Cena',
      basePrice: 15,
      active: true,
      categoryId: 2,
      categoryName: 'Combos',
      areaId: 1,
      areaName: 'Cocina',
      recipe: [],
      selectionType: 'SPECIAL_SELECTION',
      baseRecipeEnabled: false,
      schedulingRequired: false,
    },
    {
      id: 300,
      name: 'Flan',
      basePrice: 4,
      active: false,
      categoryId: 3,
      categoryName: 'Postres',
      areaId: 1,
      areaName: 'Cocina',
      recipe: [],
      selectionType: 'STANDARD',
      baseRecipeEnabled: false,
      schedulingRequired: false,
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ComboReferenceCache,
        Category,
        Product,
      ],
    });

    cache = TestBed.inject(ComboReferenceCache);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify({ ignoreCancelled: true });
    vi.useRealTimers();
  });

  function flushBoth(categories = mockCategories, products = mockProducts): void {
    const catReq = httpMock.expectOne('v1/categories');
    expect(catReq.request.method).toBe('GET');
    catReq.flush(categories);

    const prodReq = httpMock.expectOne(
      (r) => r.url === 'v1/products' && r.params.get('includeSelections') === 'true'
    );
    expect(prodReq.request.method).toBe('GET');
    prodReq.flush(products);
  }

  it('load fetches categories and products with includeSelections in parallel', () => {
    cache.load();

    const catReq = httpMock.expectOne('v1/categories');
    expect(catReq.request.method).toBe('GET');
    catReq.flush(mockCategories);

    const prodReq = httpMock.expectOne(
      (r) => r.url === 'v1/products' && r.params.get('includeSelections') === 'true'
    );
    expect(prodReq.request.method).toBe('GET');
    prodReq.flush(mockProducts);

    expect(cache.categories()).toEqual(mockCategories);
    expect(cache.products()).toEqual(mockProducts);
  });

  it('exposes hasData, isLoading, status, and error signals', () => {
    expect(cache.hasData()).toBe(false);
    expect(cache.isLoading()).toBe(true);
    expect(cache.status()).toBe('loading');
    expect(cache.error()).toBeUndefined();

    cache.load();
    expect(cache.isLoading()).toBe(true);

    flushBoth();
    expect(cache.hasData()).toBe(true);
    expect(cache.isLoading()).toBe(false);
    expect(cache.status()).toBe('fresh');
    expect(cache.error()).toBeUndefined();
  });

  it('surfaces HTTP errors through the error signal', () => {
    cache.load();
    httpMock.expectOne('v1/categories').flush(
      { message: 'boom' },
      { status: 500, statusText: 'Server Error' }
    );

    expect(cache.hasData()).toBe(false);
    expect(cache.status()).toBe('stale');
    expect(cache.error()).toBeInstanceOf(Error);
  });

  it('loadIfStale is a no-op while data is fresh', () => {
    cache.load();
    flushBoth();

    cache.loadIfStale();
    httpMock.expectNone('v1/categories');
    httpMock.expectNone('v1/products');
  });

  it('loadIfStale refetches only after the five-minute TTL expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));

    cache.load();
    flushBoth();

    vi.advanceTimersByTime(5 * 60 * 1000);
    cache.loadIfStale();
    httpMock.expectNone('v1/categories');
    httpMock.expectNone('v1/products');

    vi.advanceTimersByTime(1);
    cache.loadIfStale();

    expect(cache.status()).toBe('stale');
    expect(cache.categories()).toEqual(mockCategories);

    flushBoth();

    expect(cache.status()).toBe('fresh');
  });

  it('refresh preserves stale data until the fresh response replaces it', () => {
    const refreshedCategories: CategorySimpleResponse[] = [
      ...mockCategories,
      { id: 4, name: 'Entradas', enabled: true },
    ];

    cache.load();
    flushBoth();

    cache.refresh();

    expect(cache.status()).toBe('stale');
    expect(cache.hasData()).toBe(true);
    expect(cache.categories()).toEqual(mockCategories);

    flushBoth(refreshedCategories);

    expect(cache.status()).toBe('fresh');
    expect(cache.categories()).toEqual(refreshedCategories);
  });

  it('preserves stale data and propagates errors when refresh fails', () => {
    cache.load();
    flushBoth();

    cache.refresh();

    const catReq = httpMock.expectOne('v1/categories');
    httpMock.expectOne(
      (r) => r.url === 'v1/products' && r.params.get('includeSelections') === 'true'
    );
    catReq.flush(
      { message: 'refresh failed' },
      { status: 503, statusText: 'Service Unavailable' }
    );

    expect(cache.status()).toBe('stale');
    expect(cache.hasData()).toBe(true);
    expect(cache.categories()).toEqual(mockCategories);
    expect(cache.products()).toEqual(mockProducts);
    expect(cache.error()).toBeInstanceOf(Error);
  });

  it('loadIfStale loads when cache is empty', () => {
    cache.loadIfStale();

    httpMock.expectOne('v1/categories').flush(mockCategories);
    httpMock.expectOne(
      (r) => r.url === 'v1/products' && r.params.get('includeSelections') === 'true'
    ).flush(mockProducts);

    expect(cache.hasData()).toBe(true);
  });

  it('invalidate marks data as stale without clearing it', () => {
    cache.load();
    flushBoth();

    expect(cache.status()).toBe('fresh');
    expect(cache.hasData()).toBe(true);

    cache.invalidate();

    expect(cache.status()).toBe('stale');
    expect(cache.hasData()).toBe(true);
  });

  it('reset clears data and resets status to stale', () => {
    cache.load();
    flushBoth();

    cache.reset();

    expect(cache.hasData()).toBe(false);
    expect(cache.categories()).toEqual([]);
    expect(cache.products()).toEqual([]);
    expect(cache.status()).toBe('stale');
  });

  it('handles loaded empty category and product collections', () => {
    cache.load();
    flushBoth([], []);

    expect(cache.hasData()).toBe(true);
    expect(cache.status()).toBe('fresh');
    expect(cache.categories()).toEqual([]);
    expect(cache.products()).toEqual([]);
    expect(cache.categoryById(1)).toBeUndefined();
    expect(cache.categoryName(1)).toBeUndefined();
    expect(cache.productById(100)).toBeUndefined();
    expect(cache.productsByCategory(1)).toEqual([]);
    expect(cache.specialSelectionProducts()).toEqual([]);
    expect(cache.specialSelectionProductsByCategory(1)).toEqual([]);
  });

  it('categoryById resolves a known category and returns undefined for unknown ids', () => {
    cache.load();
    flushBoth();

    expect(cache.categoryById(1)?.name).toBe('Bebidas');
    expect(cache.categoryById(2)?.name).toBe('Combos');
    expect(cache.categoryById(999)).toBeUndefined();
  });

  it('categoryName returns the name or undefined for missing ids', () => {
    cache.load();
    flushBoth();

    expect(cache.categoryName(3)).toBe('Postres');
    expect(cache.categoryName(999)).toBeUndefined();
  });

  it('productById resolves a known product and returns undefined for unknown ids', () => {
    cache.load();
    flushBoth();

    expect(cache.productById(200)?.name).toBe('Combo Almuerzo');
    expect(cache.productById(999)).toBeUndefined();
  });

  it('productsByCategory filters products by categoryId', () => {
    cache.load();
    flushBoth();

    const combos = cache.productsByCategory(2);
    expect(combos.length).toBe(2);
    expect(combos.every((p) => p.categoryId === 2)).toBe(true);

    const bebidas = cache.productsByCategory(1);
    expect(bebidas.length).toBe(1);
    expect(bebidas[0].id).toBe(100);

    expect(cache.productsByCategory(999)).toEqual([]);
  });

  it('specialSelectionProducts returns only products whose selectionType is SPECIAL_SELECTION', () => {
    cache.load();
    flushBoth();

    const specials = cache.specialSelectionProducts();
    expect(specials.length).toBe(2);
    expect(specials.every((p) => p.selectionType === 'SPECIAL_SELECTION')).toBe(true);
    expect(specials.map((p) => p.id).sort()).toEqual([200, 201]);
  });

  it('specialSelectionProductsByCategory combines category and selectionType filters', () => {
    cache.load();
    flushBoth();

    const combosSpecials = cache.specialSelectionProductsByCategory(2);
    expect(combosSpecials.length).toBe(2);
    expect(combosSpecials.every((p) => p.categoryId === 2 && p.selectionType === 'SPECIAL_SELECTION')).toBe(true);

    expect(cache.specialSelectionProductsByCategory(1)).toEqual([]);
    expect(cache.specialSelectionProductsByCategory(3)).toEqual([]);
    expect(cache.specialSelectionProductsByCategory(999)).toEqual([]);
  });

  it('lookup helpers return safe defaults when cache is empty', () => {
    expect(cache.categoryById(1)).toBeUndefined();
    expect(cache.categoryName(1)).toBeUndefined();
    expect(cache.productById(1)).toBeUndefined();
    expect(cache.productsByCategory(1)).toEqual([]);
    expect(cache.specialSelectionProducts()).toEqual([]);
    expect(cache.specialSelectionProductsByCategory(1)).toEqual([]);
  });
});