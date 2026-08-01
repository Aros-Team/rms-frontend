import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { InventoryCache } from './inventory-cache';
import { Supply } from '@app/core/services/supplies/supply';
import { Inventory } from '@app/core/services/inventory/inventory';
import { Supplier } from '@app/core/services/suppliers/supplier';
import { Purchase } from '@app/core/services/purchases/purchase';

describe('InventoryCache', () => {
  let cache: InventoryCache;
  let httpMock: HttpTestingController;
  let supplyStub: {
    getSupplyVariantsPaginated: ReturnType<typeof vi.fn>;
    getSupplyVariants: ReturnType<typeof vi.fn>;
    getCategories: ReturnType<typeof vi.fn>;
    getUnits: ReturnType<typeof vi.fn>;
    getSupplies: ReturnType<typeof vi.fn>;
  };
  let supplierStub: { getSuppliers: ReturnType<typeof vi.fn> };
  let purchaseStub: { getPurchases: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    supplyStub = {
      getSupplyVariantsPaginated: vi.fn().mockReturnValue(of({
        content: [],
        totalElements: 0,
        totalPages: 0,
        page: 0,
        size: 20,
      })),
      getSupplyVariants: vi.fn().mockReturnValue(of([])),
      getCategories: vi.fn().mockReturnValue(of([])),
      getUnits: vi.fn().mockReturnValue(of([])),
      getSupplies: vi.fn().mockReturnValue(of([])),
    };
    const inventoryStub = { transferToKitchen: vi.fn().mockReturnValue(of({})) };
    supplierStub = { getSuppliers: vi.fn().mockReturnValue(of([])) };
    purchaseStub = { getPurchases: vi.fn().mockReturnValue(of([])) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        InventoryCache,
        { provide: Supply, useValue: supplyStub },
        { provide: Inventory, useValue: inventoryStub },
        { provide: Supplier, useValue: supplierStub },
        { provide: Purchase, useValue: purchaseStub },
      ],
    });

    cache = TestBed.inject(InventoryCache);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('setSuppliesListParams({ search: "foo" }) calls Supply.getSupplyVariantsPaginated with search: "foo"', () => {
    cache.setSuppliesListParams({ search: 'foo' });

    expect(supplyStub.getSupplyVariantsPaginated).toHaveBeenCalledWith(0, 20, 'foo');
    expect(cache.suppliesPage.hasData()).toBe(true);
    httpMock.expectNone('v1/supplies/variants');
  });

  it('setSuppliesListParams({ page: 2, size: 10, search: "bar" }) propagates all args', () => {
    cache.setSuppliesListParams({ page: 2, size: 10, search: 'bar' });

    expect(supplyStub.getSupplyVariantsPaginated).toHaveBeenCalledWith(2, 10, 'bar');
    expect(cache.suppliesPage.hasData()).toBe(true);
    httpMock.expectNone('v1/supplies/variants');
  });

  it('setSuppliesListParams({ page: 1 }) calls without search', () => {
    cache.setSuppliesListParams({ page: 1 });

    expect(supplyStub.getSupplyVariantsPaginated).toHaveBeenCalledWith(1, 20, undefined);
    expect(cache.suppliesPage.hasData()).toBe(true);
    httpMock.expectNone('v1/supplies/variants');
  });

  it('setSuppliersListParams({ search: "foo" }) calls Supplier.getSuppliers with search: "foo"', () => {
    cache.setSuppliersListParams({ search: 'foo' });

    expect(supplierStub.getSuppliers).toHaveBeenCalledWith('foo');
    expect(cache.suppliers.hasData()).toBe(true);
  });

  it('setSuppliersListParams({ search: "" }) calls Supplier.getSuppliers without search', () => {
    cache.setSuppliersListParams({ search: '' });

    expect(supplierStub.getSuppliers).toHaveBeenCalledWith('');
    expect(cache.suppliers.hasData()).toBe(true);
  });

  it('setPurchasesListParams({ search: "foo" }) calls Purchase.getPurchases with search: "foo"', () => {
    cache.setPurchasesListParams({ search: 'foo' });

    expect(purchaseStub.getPurchases).toHaveBeenCalledWith('foo');
    expect(cache.purchases.hasData()).toBe(true);
  });

  it('setPurchasesListParams({ search: "" }) calls Purchase.getPurchases without search', () => {
    cache.setPurchasesListParams({ search: '' });

    expect(purchaseStub.getPurchases).toHaveBeenCalledWith('');
    expect(cache.purchases.hasData()).toBe(true);
  });
});
