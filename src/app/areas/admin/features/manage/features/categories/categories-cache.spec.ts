import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CategoriesCache } from './categories-cache';
import { Category } from '@app/core/services/category/category';
import { OptionCategory } from '@app/core/services/option-category/option-category';
import { Supply } from '@app/core/services/supplies/supply';
import { SupplyCategoryResponse } from '@app/shared/models/dto/supplies/supply-category-response';

describe('CategoriesCache', () => {
  let cache: CategoriesCache;
  let httpMock: HttpTestingController;

  const mockSupplyCategories: SupplyCategoryResponse[] = [
    { id: 1, name: 'Proteínas' },
    { id: 2, name: 'Lácteos' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        CategoriesCache,
        Category,
        OptionCategory,
        Supply,
      ],
    });

    cache = TestBed.inject(CategoriesCache);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify({ ignoreCancelled: true });
    vi.useRealTimers();
  });

  it('load fetches supply categories from v1/supplies/categories and exposes the data', () => {
    cache.supplyCategories.load();

    const req = httpMock.expectOne('v1/supplies/categories');
    expect(req.request.method).toBe('GET');
    req.flush(mockSupplyCategories);

    expect(cache.supplyCategories.hasData()).toBe(true);
    expect(cache.supplyCategories.isLoading()).toBe(false);
    expect(cache.supplyCategories.status()).toBe('fresh');
    expect(cache.supplyCategories.error()).toBeUndefined();
    expect(cache.supplyCategories.data()).toEqual(mockSupplyCategories);
  });

  it('invalidateAll marks supplyCategories stale without clearing its data', () => {
    cache.supplyCategories.load();
    httpMock.expectOne('v1/supplies/categories').flush(mockSupplyCategories);

    expect(cache.supplyCategories.status()).toBe('fresh');
    expect(cache.supplyCategories.hasData()).toBe(true);

    cache.invalidateAll();

    expect(cache.supplyCategories.status()).toBe('stale');
    expect(cache.supplyCategories.hasData()).toBe(true);
    expect(cache.supplyCategories.data()).toEqual(mockSupplyCategories);

    expect(cache.productCategories.status()).toBe('stale');
    expect(cache.optionCategories.status()).toBe('stale');
    expect(cache.allCategories.status()).toBe('stale');
  });
});
