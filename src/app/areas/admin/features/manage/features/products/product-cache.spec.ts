import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';

import { ProductCache } from './product-cache';
import { Product } from '@app/core/services/products/product';
import { Area } from '@app/core/services/areas/area';
import { Category } from '@app/core/services/category/category';
import { Supply } from '@app/core/services/supplies/supply';
import { ProductOption } from '@app/core/services/product-option/product-option';
import { WebSocket } from '@app/core/services/websocket/websocket';

describe('ProductCache', () => {
  let cache: ProductCache;
  let httpMock: HttpTestingController;
  let productStub: { getProductsPaginated: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    productStub = {
      getProductsPaginated: vi.fn().mockReturnValue(of({
        content: [],
        totalElements: 0,
        totalPages: 0,
        page: 0,
        size: 6,
      })),
    };
    const areaStub = { getAreas: vi.fn().mockReturnValue(of([])) };
    const categoryStub = { getCategories: vi.fn().mockReturnValue(of([])) };
    const supplyStub = { getSupplyVariants: vi.fn().mockReturnValue(of([])) };
    const productOptionStub = { getOptions: vi.fn().mockReturnValue(of([])) };
    const wsStub = { cacheInvalidation$: new Subject() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ProductCache,
        { provide: Product, useValue: productStub },
        { provide: Area, useValue: areaStub },
        { provide: Category, useValue: categoryStub },
        { provide: Supply, useValue: supplyStub },
        { provide: ProductOption, useValue: productOptionStub },
        { provide: WebSocket, useValue: wsStub },
      ],
    });

    cache = TestBed.inject(ProductCache);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('setProductListParams({ includeInactive: true }) calls Product.getProductsPaginated with includeInactive=true', () => {
    cache.setProductListParams({ includeInactive: true });

    expect(productStub.getProductsPaginated).toHaveBeenCalledWith(0, 6, true, undefined, undefined);
    expect(cache.products.hasData()).toBe(true);
    httpMock.expectNone('v1/products');
  });

  it('setProductListParams({ includeInactive: false }) calls Product.getProductsPaginated with includeInactive=false', () => {
    cache.setProductListParams({ includeInactive: false });

    expect(productStub.getProductsPaginated).toHaveBeenCalledWith(0, 6, false, undefined, undefined);
    expect(cache.products.hasData()).toBe(true);
    httpMock.expectNone('v1/products');
  });

  it('setProductListParams({ page: 2, size: 10, includeInactive: true }) propagates all three args', () => {
    cache.setProductListParams({ page: 2, size: 10, includeInactive: true });

    expect(productStub.getProductsPaginated).toHaveBeenCalledWith(2, 10, true, undefined, undefined);
    expect(cache.products.hasData()).toBe(true);
    httpMock.expectNone('v1/products');
  });

  it('setProductListParams({ search: "foo" }) calls Product.getProductsPaginated with search: "foo"', () => {
    cache.setProductListParams({ search: 'foo' });

    expect(productStub.getProductsPaginated).toHaveBeenCalledWith(0, 6, false, undefined, 'foo');
    expect(cache.products.hasData()).toBe(true);
    httpMock.expectNone('v1/products');
  });
});
