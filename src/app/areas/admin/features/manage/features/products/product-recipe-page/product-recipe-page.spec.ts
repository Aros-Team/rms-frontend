/**
 * Tests for the ProductRecipePage component.
 *
 * Feature: Product recipe editing page — loads a product by route param,
 *   displays/editable form, manages recipe items, saves updates, shows toast feedback.
 * Contract:
 *   - On init with valid route param: calls findProduct, getProductOptionGroups,
 *     getCost, getCostBreakdown, getImages (via forkJoin after product load).
 *   - On init without route param: navigates to /admin/manage/products.
 *   - save() calls updateProduct with the correct ProductUpdateRequest payload.
 *   - save() shows success toast on success, error toast on failure.
 *   - addRecipeItem / removeRecipeItem mutate the recipeItems signal correctly.
 *   - goBack() navigates to /admin/manage/products.
 *
 * Approach: TestBed with all injected services mocked via useValue stubs.
 *   Verify service calls with exact arguments, assert signal values directly.
 */
import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { ProductRecipePage } from './product-recipe-page';
import { Product } from '@app/core/services/products/product';
import { OptionGroup } from '@app/core/services/option-group/option-group';
import { ProductImage } from '@app/core/services/product-image/product-image';
import { ProductCache } from '../product-cache';
import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';
import { ProductCostBreakdownResponse } from '@app/shared/models/dto/products/product-cost-breakdown-response';
import { ProductImageResponse } from '@app/shared/models/dto/products/product-image-response';
import { OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';

import productRecipeHtml from './product-recipe-page.html?raw';

function buildProductFixture(): ProductResponse {
  return {
    id: 7,
    name: 'Lentejas',
    description: 'Lentejas con verduras',
    basePrice: 12.5,
    active: true,
    categoryId: 2,
    categoryName: 'Comidas',
    areaId: 1,
    areaName: 'Cocina',
    estimatedPrepMinutes: 15,
    recipe: [
      { id: 101, supplyVariantId: 301, requiredQuantity: 0.5 },
      { id: 102, supplyVariantId: 302, requiredQuantity: 0.25 },
    ],
  };
}

function buildCostFixture(): ProductCostResponse {
  return {
    productId: 7,
    totalCost: 25.75,
    materialCost: 15.5,
    laborCost: 10.25,
    breakdown: [
      { description: 'Tomate 0.5 kg', amount: 7.5, type: 'MATERIAL' },
      { description: 'Cebolla 0.25 kg', amount: 8, type: 'MATERIAL' },
    ],
  };
}

function buildCostBreakdownFixture(): ProductCostBreakdownResponse {
  return {
    productId: 7,
    name: 'Hamburguesa',
    baseCost: { amount: 15500, currency: 'COP' },
    options: [],
    categories: [],
    projectedOptionCost: { amount: 0, currency: 'COP' },
    projectedEffectiveCost: { amount: 15500, currency: 'COP' },
  };
}

function buildOptionGroupsFixture(): OptionGroupResponse[] {
  return [
    { id: 1, name: 'Tamaño', selectionType: 'SINGLE_CHOICE', description: '', productIds: [7] },
  ];
}

function buildImageFixture(): ProductImageResponse {
  return {
    id: 50,
    mobileUrl: 'http://img/m.jpg',
    tabletUrl: 'http://img/t.jpg',
    desktopUrl: 'http://img/d.jpg',
    originalName: 'photo.jpg',
    size: 1024,
    createdAt: '2025-01-01T00:00:00Z',
  };
}

function buildCacheStub() {
  return {
    referenceData: {
      data: vi.fn().mockReturnValue({
        areas: [{ id: 1, name: 'Cocina' }],
        categories: [{ id: 2, name: 'Comidas' }],
        variants: [],
        productOptions: [],
      }),
      refresh: vi.fn(),
      loadIfStale: vi.fn(),
      isLoading: vi.fn().mockReturnValue(false),
    },
    products: {
      data: vi.fn().mockReturnValue({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 0 }),
      refresh: vi.fn(),
      loadIfStale: vi.fn(),
      invalidate: vi.fn(),
      isLoading: vi.fn().mockReturnValue(false),
    },
    setProductListParams: vi.fn(),
  };
}

function buildProductStub() {
  return {
    findProduct: vi.fn().mockReturnValue(of(buildProductFixture())),
    updateProduct: vi.fn().mockReturnValue(of({})),
    getCost: vi.fn().mockReturnValue(of(buildCostFixture())),
    getCostBreakdown: vi.fn().mockReturnValue(of(buildCostBreakdownFixture())),
  };
}

function configureTestBed(routeParamId: string | null = '7', extraProviders: unknown[] = []) {
  const paramMap = new Map<string, string>();
  if (routeParamId !== null) {
    paramMap.set('id', routeParamId);
  }
  const snapshotParamMap = {
    get: (key: string) => paramMap.get(key) ?? null,
    has: (key: string) => paramMap.has(key),
    getAll: () => [] as string[],
    keys: [...paramMap.keys()],
  };

  const productStub = buildProductStub();
  const optionGroupStub = {
    getProductOptionGroups: vi.fn().mockReturnValue(of(buildOptionGroupsFixture())),
    createOptionGroup: vi.fn().mockReturnValue(of({ id: 1, name: 'Nuevo', selectionType: 'SINGLE', description: '', productIds: [7] })),
  };
  const imageStub = {
    getImages: vi.fn().mockReturnValue(of([buildImageFixture()])),
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
  };
  const cacheStub = buildCacheStub();
  const wsStub = {
    emitCacheInvalidation: vi.fn(),
    cacheInvalidation$: of(null),
  };
  const loggerStub = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      MessageService,
      { provide: Product, useValue: productStub },
      { provide: OptionGroup, useValue: optionGroupStub },
      { provide: ProductImage, useValue: imageStub },
      { provide: ProductCache, useValue: cacheStub },
      { provide: Logging, useValue: loggerStub },
      { provide: WebSocket, useValue: wsStub },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: snapshotParamMap,
          },
        },
      },
      ...extraProviders,
    ],
  });

  return {
    productStub,
    optionGroupStub,
    imageStub,
    cacheStub,
    wsStub,
    loggerStub,
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('ProductRecipePage', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('product-recipe-page.html')) {
        return Promise.resolve(productRecipeHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates the component successfully', () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    expect(fixture.componentInstance).toBeDefined();
  });

  it('loads product on init via findProduct with the route param id', async () => {
    const env = configureTestBed('7');
    TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    expect(env.productStub.findProduct).toHaveBeenCalledWith(7);
  });

  it('loads option groups on init after product loads', async () => {
    const env = configureTestBed('7');
    TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    expect(env.optionGroupStub.getProductOptionGroups).toHaveBeenCalledWith(7);
  });

  it('loads cost on init after product loads', async () => {
    const env = configureTestBed('7');
    TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    expect(env.productStub.getCost).toHaveBeenCalledWith(7);
  });

  it('loads cost breakdown on init after product loads', async () => {
    const env = configureTestBed('7');
    TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    expect(env.productStub.getCostBreakdown).toHaveBeenCalledWith(7);
  });

  it('loads images on init after product loads', async () => {
    const env = configureTestBed('7');
    TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    expect(env.imageStub.getImages).toHaveBeenCalledWith(7);
  });

  it('navigates to products list when no route param is provided', async () => {
    const routerNavigate = vi.fn();

    const snapshotParamMap = {
      get: () => null,
      has: () => false,
      getAll: () => [] as string[],
      keys: [] as string[],
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        { provide: Product, useValue: {} },
        { provide: OptionGroup, useValue: {} },
        { provide: ProductImage, useValue: {} },
        { provide: ProductCache, useValue: buildCacheStub() },
        { provide: Logging, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: WebSocket, useValue: { emitCacheInvalidation: vi.fn(), cacheInvalidation$: of(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: snapshotParamMap } } },
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });

    TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    expect(routerNavigate).toHaveBeenCalledWith(['/admin/manage/products']);
  });

  it('displays product data after load — formData populated with name', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const comp = fixture.componentInstance;
    expect(comp.formData().name).toBe('Lentejas');
  });

  it('displays product data after load — recipe items populated', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const comp = fixture.componentInstance;
    expect(comp.recipeItems()).toHaveLength(2);
    expect(comp.recipeItems()[0].supplyVariantId).toBe(301);
    expect(comp.recipeItems()[0].requiredQuantity).toBe(0.5);
  });

  it('displays product data after load — product signal set', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const comp = fixture.componentInstance;
    expect(comp.product()?.id).toBe(7);
    expect(comp.product()?.name).toBe('Lentejas');
  });

  it('displays product data after load — cost signal set', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const comp = fixture.componentInstance;
    expect(comp.cost()?.totalCost).toBe(25.75);
  });

  it('displays product data after load — images signal set', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const comp = fixture.componentInstance;
    expect(comp.images()).toHaveLength(1);
    expect(comp.images()[0].id).toBe(50);
  });

  it('displays product data after load — option groups signal set', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const comp = fixture.componentInstance;
    expect(comp.optionGroups()).toHaveLength(1);
    expect(comp.optionGroups()[0].name).toBe('Tamaño');
  });

  it('save() calls updateProduct with correct payload', async () => {
    const env = configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    fixture.componentInstance.save();
    await flushMicrotasks();

    expect(env.productStub.updateProduct).toHaveBeenCalledTimes(1);
    const callArgs = env.productStub.updateProduct.mock.calls[0] as [number, Record<string, unknown>];
    expect(callArgs[0]).toBe(7);
    expect(callArgs[1].name).toBe('Lentejas');
    expect(callArgs[1].basePrice).toBe(12.5);
    expect(callArgs[1].recipe).toEqual([
      { supplyVariantId: 301, requiredQuantity: 0.5 },
      { supplyVariantId: 302, requiredQuantity: 0.25 },
    ]);
  });

  it('save() shows success toast on success', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    // MessageService is provided at component level, so get it from the component's injector
    const messageService = fixture.componentRef.injector.get(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');

    fixture.componentInstance.save();
    await flushMicrotasks();
    await flushMicrotasks();

    const successCalls = addSpy.mock.calls.filter(
      ([msg]: [{ severity: string; summary: string }]) =>
        msg.severity === 'success' && msg.summary === 'Guardado'
    );
    expect(successCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('save() shows error toast on failure', async () => {
    const env = configureTestBed('7');
    env.productStub.updateProduct.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'Server error' } })));
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const messageService = fixture.componentRef.injector.get(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');

    fixture.componentInstance.save();
    await flushMicrotasks();
    await flushMicrotasks();

    const errorCalls = addSpy.mock.calls.filter(
      ([msg]: [{ severity: string; summary: string }]) =>
        msg.severity === 'error' && msg.summary === 'Error'
    );
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('addRecipeItem appends a new item to recipeItems', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const comp = fixture.componentInstance;
    const initialLength = comp.recipeItems().length;

    comp.addRecipeItem({ supplyVariantId: 500, requiredQuantity: 1.5 });

    expect(comp.recipeItems()).toHaveLength(initialLength + 1);
    const last = comp.recipeItems()[comp.recipeItems().length - 1];
    expect(last.supplyVariantId).toBe(500);
    expect(last.requiredQuantity).toBe(1.5);
  });

  it('removeRecipeItem removes the item at the given index', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    const comp = fixture.componentInstance;
    const initialLength = comp.recipeItems().length;

    comp.removeRecipeItem(0);

    expect(comp.recipeItems()).toHaveLength(initialLength - 1);
    expect(comp.recipeItems()[0].supplyVariantId).toBe(302);
  });

  it('goBack navigates to /admin/manage/products', async () => {
    const routerNavigate = vi.fn();

    const paramMap = new Map<string, string>([['id', '7']]);
    const snapshotParamMap = {
      get: (key: string) => paramMap.get(key) ?? null,
      has: (key: string) => paramMap.has(key),
      getAll: () => [] as string[],
      keys: [...paramMap.keys()],
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        { provide: Product, useValue: buildProductStub() },
        { provide: OptionGroup, useValue: { getProductOptionGroups: vi.fn().mockReturnValue(of([])), createOptionGroup: vi.fn() } },
        { provide: ProductImage, useValue: { getImages: vi.fn().mockReturnValue(of([])), uploadImage: vi.fn(), deleteImage: vi.fn() } },
        { provide: ProductCache, useValue: buildCacheStub() },
        { provide: Logging, useValue: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } },
        { provide: WebSocket, useValue: { emitCacheInvalidation: vi.fn(), cacheInvalidation$: of(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: snapshotParamMap } } },
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });

    const fixture = TestBed.createComponent(ProductRecipePage);
    await flushMicrotasks();

    fixture.componentInstance.goBack();

    expect(routerNavigate).toHaveBeenCalledWith(['/admin/manage/products']);
  });

  it('loading signal starts true and becomes false after product load', async () => {
    configureTestBed('7');
    const fixture = TestBed.createComponent(ProductRecipePage);

    expect(fixture.componentInstance.loading()).toBe(true);

    await flushMicrotasks();

    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
