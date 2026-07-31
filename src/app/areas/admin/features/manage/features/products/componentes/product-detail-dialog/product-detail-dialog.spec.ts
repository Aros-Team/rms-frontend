import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError, Subject } from 'rxjs';

import { ProductDetailDialog } from './product-detail-dialog';
import { Product } from '@app/core/services/products/product';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';

import productDetailDialogHtml from './product-detail-dialog.html?raw';

function buildProductFixture(): ProductResponse {
  return {
    id: 7,
    name: 'Lentejas',
    basePrice: 12.5,
    active: true,
    categoryId: 2,
    categoryName: 'Comidas',
    areaId: 1,
    areaName: 'Cocina',
    recipe: [
      { id: 101, supplyVariantId: 301, requiredQuantity: 0.5 },
      { id: 102, supplyVariantId: 302, requiredQuantity: 0.25 },
    ],
  };
}

function setupComponent() {
  const productStub = {
    getOptions: vi.fn().mockReturnValue(of([])),
    getCost: vi.fn().mockReturnValue(of(null)),
  };
  const masterDataStub = {
    getProductOptions: vi.fn().mockReturnValue(of([])),
  };
  const loggerStub = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      ProductDetailDialog,
      { provide: Product, useValue: productStub },
      { provide: MasterData, useValue: masterDataStub },
      { provide: Logging, useValue: loggerStub },
    ],
  });

  return {
    component: TestBed.inject(ProductDetailDialog),
    productStub,
    loggerStub,
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function attachToDialog(component: ProductDetailDialog, fixture: ProductResponse): void {
  component.product = fixture;
  component.visible.set(true);
  component.ngOnChanges();
}

describe('ProductDetailDialog — cost panel', () => {
  const stubCost: ProductCostResponse = {
    productId: 7,
    totalCost: 25.75,
    materialCost: 15.5,
    laborCost: 10.25,
    breakdown: [
      { description: 'Tomate 0.5 kg', amount: 7.5, type: 'MATERIAL' },
      { description: 'Cebolla 0.25 kg', amount: 8, type: 'MATERIAL' },
      { description: 'Mano de obra 12 min', amount: 10.25, type: 'LABOR' },
    ],
  };

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('product-detail-dialog.html')) {
        return Promise.resolve(productDetailDialogHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('sets cost() to the stubbed ProductCostResponse after open and clears costLoading()', async () => {
    const env = setupComponent();
    env.productStub.getCost.mockReturnValue(of(stubCost));

    attachToDialog(env.component, buildProductFixture());
    await flushMicrotasks();

    expect(env.productStub.getCost).toHaveBeenCalledWith(7);
    expect(env.component.cost()).toEqual(stubCost);
    expect(env.component.costLoading()).toBe(false);
    expect(env.component.costError()).toBeNull();
  });

  it('populates costError() with the Spanish message and keeps cost() null when getCost fails', async () => {
    const env = setupComponent();
    env.productStub.getCost.mockReturnValue(throwError(() => new Error('boom')));

    attachToDialog(env.component, buildProductFixture());
    await flushMicrotasks();

    expect(env.component.costError()).toBe('No se pudo calcular el costo de producción');
    expect(env.component.cost()).toBeNull();
    expect(env.component.costLoading()).toBe(false);
  });

  it('resets cost() to null when switching products so previous data does not flash', async () => {
    const env = setupComponent();
    env.productStub.getCost.mockReturnValue(of(stubCost));

    attachToDialog(env.component, buildProductFixture());
    await flushMicrotasks();
    expect(env.component.cost()).toEqual(stubCost);

    const newCost: ProductCostResponse = { ...stubCost, productId: 8, totalCost: 99 };
    const subject = new Subject<ProductCostResponse | null>();
    env.productStub.getCost.mockReturnValue(subject.asObservable());

    env.component.visible.set(false);
    env.component.ngOnChanges();
    expect(env.component.cost()).toBeNull();
    expect(env.component.costError()).toBeNull();

    const productB: ProductResponse = { ...buildProductFixture(), id: 8, name: 'Ajiaco' };
    env.component.product = productB;
    env.component.visible.set(true);
    env.component.ngOnChanges();

    expect(env.component.cost()).toBeNull();

    subject.next(newCost);

    expect(env.component.cost()).toEqual(newCost);
    expect(env.component.costLoading()).toBe(false);
  });

  it('resets cost state when the dialog becomes invisible', () => {
    const env = setupComponent();

    env.component.cost.set(stubCost);
    env.component.costLoading.set(true);
    env.component.costError.set('previous');

    env.component.visible.set(false);
    env.component.ngOnChanges();

    expect(env.component.cost()).toBeNull();
    expect(env.component.costLoading()).toBe(false);
    expect(env.component.costError()).toBeNull();
  });
});