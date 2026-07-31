import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError, Subject } from 'rxjs';

import { Products } from './products';
import { Product } from '@app/core/services/products/product';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { ProductCache } from './product-cache';
import { ProductOption } from '@app/core/services/product-option/product-option';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { ProductImage } from '@app/core/services/product-image/product-image';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';

import productsHtml from './products.html?raw';
import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';

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
    findProduct: vi.fn(),
    updateProduct: vi.fn(),
    createProduct: vi.fn(),
    createProductOption: vi.fn(),
    getOptions: vi.fn(),
    getProducts: vi.fn(),
    filterByCategories: vi.fn(),
    disableProduct: vi.fn(),
    deleteProduct: vi.fn(),
    getCost: vi.fn().mockReturnValue(of(null)),
  };
  const masterDataStub = {
    getProductOptions: vi.fn().mockReturnValue(of([])),
  };
  const cacheStub = {
    referenceData: {
      data: vi.fn().mockReturnValue({
        areas: [],
        categories: [],
        optionCategories: [],
        variants: [],
        productOptions: [],
      }),
      refresh: vi.fn(),
      loadIfStale: vi.fn(),
    },
    products: {
      data: vi.fn().mockReturnValue({ content: [], totalPages: 0, totalElements: 0, page: 0, size: 0 }),
      refresh: vi.fn(),
      loadIfStale: vi.fn(),
      invalidate: vi.fn(),
    },
  };
  const imageStub = {
    getImages: vi.fn().mockReturnValue(of([])),
    uploadImage: vi.fn(),
    deleteImage: vi.fn(),
  };
  const wsStub = {
    emitCacheInvalidation: vi.fn(),
    cacheInvalidation$: of(null),
  };
  const loggerStub = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
  const productOptionStub = { getOptions: vi.fn().mockReturnValue(of([])) };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      Products,
      MessageService,
      ConfirmationService,
      { provide: Product, useValue: productStub },
      { provide: MasterData, useValue: masterDataStub },
      { provide: Logging, useValue: loggerStub },
      { provide: ProductCache, useValue: cacheStub },
      { provide: ProductOption, useValue: productOptionStub },
      { provide: WebSocket, useValue: wsStub },
      { provide: ProductImage, useValue: imageStub },
    ],
  });

  return {
    component: TestBed.inject(Products),
    productStub,
    masterDataStub,
    cacheStub,
    imageStub,
    wsStub,
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Products wizard — existing recipe rows', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('products.html')) {
        return Promise.resolve(productsHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('showModificationModal', () => {
    it('populates existingRecipe as a FormArray with one FormGroup per recipe item', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      const items = env.component.existingRecipe.value as { supplyVariantId: number; requiredQuantity: number }[];
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ supplyVariantId: 301, requiredQuantity: 0.5 });
      expect(items[1]).toEqual({ supplyVariantId: 302, requiredQuantity: 0.25 });

      const firstGroup = env.component.existingRecipe.at(0);
      expect(firstGroup.get('supplyVariantId')?.value).toBe(301);
      expect(firstGroup.get('requiredQuantity')?.value).toBe(0.5);

      const secondGroup = env.component.existingRecipe.at(1);
      expect(secondGroup.get('supplyVariantId')?.value).toBe(302);
      expect(secondGroup.get('requiredQuantity')?.value).toBe(0.25);
    });

    it('clears existingRecipe before populating when called more than once', async () => {
      const env = setupComponent();
      const first = { ...buildProductFixture(), recipe: [{ supplyVariantId: 1, requiredQuantity: 1 }] };
      const second = { ...buildProductFixture(), recipe: [{ supplyVariantId: 2, requiredQuantity: 2 }, { supplyVariantId: 3, requiredQuantity: 3 }] };
      env.productStub.findProduct.mockReturnValueOnce(of(first));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.productStub.findProduct.mockReturnValueOnce(of(second));
      env.component.showModificationModal(8);
      await flushMicrotasks();

      const items = env.component.existingRecipe.value as { supplyVariantId: number; requiredQuantity: number }[];
      expect(items).toHaveLength(2);
      expect(items[0].supplyVariantId).toBe(2);
      expect(items[1].supplyVariantId).toBe(3);
    });
  });

  describe('editing a row', () => {
    it('updates the underlying FormControl when setValue is called on requiredQuantity', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.component.existingRecipe.at(0).get('requiredQuantity')?.setValue(0.5);
      expect(env.component.existingRecipe.at(0).get('requiredQuantity')?.value).toBe(0.5);

      env.component.existingRecipe.at(1).get('supplyVariantId')?.setValue(999);
      expect(env.component.existingRecipe.at(1).get('supplyVariantId')?.value).toBe(999);
    });

    it('validates requiredQuantity with min(0.001)', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      const ctrl = env.component.existingRecipe.at(0).get('requiredQuantity');
      ctrl?.setValue(0);
      expect(ctrl?.valid).toBe(false);
      ctrl?.setValue(0.5);
      expect(ctrl?.valid).toBe(true);
    });
  });

  describe('removing a row', () => {
    it('shifts indices so the row that was at i+1 is now at i', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      expect(env.component.existingRecipe.length).toBe(2);
      env.component.removeExistingRecipeItem(0);
      expect(env.component.existingRecipe.length).toBe(1);
      const remaining = env.component.existingRecipe.value as { supplyVariantId: number; requiredQuantity: number }[];
      expect(remaining[0].supplyVariantId).toBe(302);
    });

    it('keeps the category map consistent after removing a row', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.component.setExistingRecipeCategory(1, 42);
      expect(env.component.getExistingRecipeCategory(1)).toBe(42);

      env.component.removeExistingRecipeItem(0);
      expect(env.component.getExistingRecipeCategory(0)).toBe(42);

      const filtered = env.component.filteredVariantsForExistingRecipe(0);
      expect(filtered).toEqual([]);
    });

    it('removes the category from the map when the row it belonged to is removed', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.component.setExistingRecipeCategory(0, 77);
      expect(env.component.getExistingRecipeCategory(0)).toBe(77);

      env.component.removeExistingRecipeItem(0);
      expect(env.component.getExistingRecipeCategory(0)).toBe(null);
    });
  });

  describe('submitStep3 dedup', () => {
    it('merges existingRecipe and baseRecipe by supplyVariantId, baseRecipe wins on conflict', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.component.existingRecipe.at(0).get('requiredQuantity')?.setValue(0.5);
      env.component.existingRecipe.at(1).get('requiredQuantity')?.setValue(0.25);

      env.component.addBaseRecipeItem();
      env.component.baseRecipe.at(0).get('supplyVariantId')?.setValue(301);
      env.component.baseRecipe.at(0).get('requiredQuantity')?.setValue(9);

      env.component.addBaseRecipeItem();
      env.component.baseRecipe.at(1).get('supplyVariantId')?.setValue(500);
      env.component.baseRecipe.at(1).get('requiredQuantity')?.setValue(0.1);

      env.productStub.updateProduct.mockReturnValue(of({}));
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      const fakeOptions = { id: 7, name: 'Lentejas', optionCategoryId: 1, optionCategoryName: 'Default' };
      env.masterDataStub.getProductOptions = vi.fn().mockReturnValue(of([fakeOptions]));

      const productOptionStub = TestBed.inject(ProductOption) as unknown as { getOptions: ReturnType<typeof vi.fn> };
      productOptionStub.getOptions = vi.fn().mockReturnValue(of([]));

      env.component.submitStep3();
      await flushMicrotasks();

      expect(env.productStub.updateProduct).toHaveBeenCalledTimes(1);
      const payload = env.productStub.updateProduct.mock.calls[0][1] as {
        recipe: { supplyVariantId: number; requiredQuantity: number }[];
      };
      const items = payload.recipe;
      const ids = items.map((i) => i.supplyVariantId).sort((a, b) => a - b);
      expect(ids).toEqual([301, 302, 500]);

      const variant301 = items.find((i) => i.supplyVariantId === 301);
      expect(variant301?.requiredQuantity).toBe(9);
    });
  });

  describe('baseForm extended fields (description, estimatedPrepMinutes)', () => {
    it('includes description and estimatedPrepMinutes controls with default values', () => {
      const env = setupComponent();
      expect(env.component.baseForm.get('description')).not.toBeNull();
      expect(env.component.baseForm.get('estimatedPrepMinutes')).not.toBeNull();
      expect(env.component.baseForm.get('description')?.value).toBe('');
      expect(env.component.baseForm.get('estimatedPrepMinutes')?.value).toBeNull();
    });

    it('patches description and estimatedPrepMinutes from ProductResponse on showModificationModal', async () => {
      const env = setupComponent();
      const fixtureWithExtras: ProductResponse = {
        ...buildProductFixture(),
        description: 'Lentejas con verduras',
        estimatedPrepMinutes: 12,
      };
      env.productStub.findProduct.mockReturnValue(of(fixtureWithExtras));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      expect(env.component.baseForm.get('description')?.value).toBe('Lentejas con verduras');
      expect(env.component.baseForm.get('estimatedPrepMinutes')?.value).toBe(12);
    });

    it('falls back to empty string and null when ProductResponse omits the fields', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      expect(env.component.baseForm.get('description')?.value).toBe('');
      expect(env.component.baseForm.get('estimatedPrepMinutes')?.value).toBeNull();
    });

    it('sends description and estimatedPrepMinutes in the updateProduct payload', async () => {
      const env = setupComponent();
      const fixtureWithExtras: ProductResponse = {
        ...buildProductFixture(),
        description: 'Lentejas con verduras',
        estimatedPrepMinutes: 12,
      };
      env.productStub.findProduct.mockReturnValue(of(fixtureWithExtras));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.productStub.updateProduct.mockReturnValue(of({}));
      env.productStub.findProduct.mockReturnValue(of(fixtureWithExtras));
      const fakeOptions = { id: 7, name: 'Lentejas', optionCategoryId: 1, optionCategoryName: 'Default' };
      env.masterDataStub.getProductOptions = vi.fn().mockReturnValue(of([fakeOptions]));
      const productOptionStub = TestBed.inject(ProductOption) as unknown as { getOptions: ReturnType<typeof vi.fn> };
      productOptionStub.getOptions = vi.fn().mockReturnValue(of([]));

      env.component.submitStep3();
      await flushMicrotasks();

      expect(env.productStub.updateProduct).toHaveBeenCalledTimes(1);
      const payload = env.productStub.updateProduct.mock.calls[0][1] as {
        description: string;
        estimatedPrepMinutes: number;
      };
      expect(payload.description).toBe('Lentejas con verduras');
      expect(payload.estimatedPrepMinutes).toBe(12);
    });

    it('omits description and estimatedPrepMinutes from the payload when blank', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.productStub.updateProduct.mockReturnValue(of({}));
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      const fakeOptions = { id: 7, name: 'Lentejas', optionCategoryId: 1, optionCategoryName: 'Default' };
      env.masterDataStub.getProductOptions = vi.fn().mockReturnValue(of([fakeOptions]));
      const productOptionStub = TestBed.inject(ProductOption) as unknown as { getOptions: ReturnType<typeof vi.fn> };
      productOptionStub.getOptions = vi.fn().mockReturnValue(of([]));

      env.component.submitStep3();
      await flushMicrotasks();

      const payload = env.productStub.updateProduct.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.description).toBeUndefined();
      expect(payload.estimatedPrepMinutes).toBeUndefined();
    });
  });

  describe('prep time estimation dialog', () => {
    it('applyPrepTime stores the estimate and patches estimatedPrepMinutes with the rounded average', () => {
      const env = setupComponent();
      env.component.applyPrepTime({
        calmMinutes: 4,
        peakMinutes: 9,
        interruptionMinutes: 7,
        estimatedPrepMinutes: 7,
      });

      expect(env.component.prepTimeEstimate()).toEqual({
        calmMinutes: 4,
        peakMinutes: 9,
        interruptionMinutes: 7,
        estimatedPrepMinutes: 7,
      });
      expect(env.component.baseForm.get('estimatedPrepMinutes')?.value).toBe(7);
    });

    it('prepTimeInitialEstimate derives from the patched form value when no estimate stored', async () => {
      const env = setupComponent();
      const fixtureWithExtras: ProductResponse = { ...buildProductFixture(), estimatedPrepMinutes: 12 };
      env.productStub.findProduct.mockReturnValue(of(fixtureWithExtras));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      expect(env.component.prepTimeEstimate()).toBeNull();
      expect(env.component.prepTimeInitialEstimate()).toEqual({
        calmMinutes: 12,
        peakMinutes: 12,
        interruptionMinutes: 12,
        estimatedPrepMinutes: 12,
      });
    });

    it('openPrepTimeDialog opens the dialog', () => {
      const env = setupComponent();
      env.component.prepTimeDialogOpen.set(false);
      env.component.openPrepTimeDialog();
      expect(env.component.prepTimeDialogOpen()).toBe(true);
    });
  });

  describe('cost panel', () => {
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

    function prepareSuccessfulSubmit(env: ReturnType<typeof setupComponent>, fixture: ProductResponse): void {
      env.productStub.updateProduct.mockReturnValue(of({}));
      env.productStub.findProduct.mockReturnValue(of(fixture));
      const fakeOptions = { id: 7, name: 'Lentejas', optionCategoryId: 1, optionCategoryName: 'Default' };
      env.masterDataStub.getProductOptions = vi.fn().mockReturnValue(of([fakeOptions]));
      const productOptionStub = TestBed.inject(ProductOption) as unknown as { getOptions: ReturnType<typeof vi.fn> };
      productOptionStub.getOptions = vi.fn().mockReturnValue(of([]));
    }

    it('sets cost() to the stubbed ProductCostResponse after submitStep3 succeeds and clears costLoading()', async () => {
      const env = setupComponent();
      const fixtureWithExtras: ProductResponse = { ...buildProductFixture(), description: '', estimatedPrepMinutes: 12 };
      env.productStub.getCost.mockReturnValue(of(stubCost));
      env.productStub.findProduct.mockReturnValue(of(fixtureWithExtras));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      prepareSuccessfulSubmit(env, fixtureWithExtras);

      env.component.submitStep3();
      await flushMicrotasks();

      const callsWithSeven = env.productStub.getCost.mock.calls.filter((c: unknown[]) => c[0] === 7);
      expect(callsWithSeven.length).toBeGreaterThanOrEqual(1);
      expect(env.component.cost()).toEqual(stubCost);
      expect(env.component.costLoading()).toBe(false);
      expect(env.component.costError()).toBeNull();
    });

    it('populates costError() with the Spanish message and keeps cost() null when getCost fails', async () => {
      const env = setupComponent();
      const fixtureWithExtras: ProductResponse = { ...buildProductFixture(), description: '', estimatedPrepMinutes: 12 };
      env.productStub.getCost.mockReturnValue(throwError(() => new Error('boom')));
      env.productStub.findProduct.mockReturnValue(of(fixtureWithExtras));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      prepareSuccessfulSubmit(env, fixtureWithExtras);

      env.component.submitStep3();
      await flushMicrotasks();

      expect(env.component.costError()).toBe('No se pudo calcular el costo de producción');
      expect(env.component.cost()).toBeNull();
      expect(env.component.costLoading()).toBe(false);
    });

    it('calls loadProductCost exactly once with the loaded product id on showModificationModal', async () => {
      const env = setupComponent();
      env.productStub.getCost.mockReturnValue(of(stubCost));
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      const calls = env.productStub.getCost.mock.calls.filter((c: unknown[]) => c[0] === 7);
      expect(calls).toHaveLength(1);
    });

    it('clears the cost state when called with an invalid productId', () => {
      const env = setupComponent();
      env.component.cost.set(stubCost);
      env.component.costLoading.set(true);
      env.component.costError.set('previous');

      env.component.loadProductCost(0);

      expect(env.component.cost()).toBeNull();
    });

    it('does not call getCost when productId is 0', () => {
      const env = setupComponent();
      env.component.cost.set(stubCost);
      env.component.costLoading.set(true);
      env.component.costError.set('previous');

      env.component.loadProductCost(0);

      expect(env.productStub.getCost).not.toHaveBeenCalled();
      expect(env.component.cost()).toBeNull();
    });

    it('sets cost() to the response and costLoading() to false when getCost returns a value', async () => {
      const env = setupComponent();
      env.productStub.getCost.mockReturnValue(of(stubCost));

      env.component.loadProductCost(7);
      await flushMicrotasks();

      expect(env.component.cost()).toEqual(stubCost);
      expect(env.component.costLoading()).toBe(false);
      expect(env.component.costError()).toBeNull();
    });

    it('keeps cost() at its previous value and ends with costLoading() false when getCost returns null', async () => {
      const env = setupComponent();
      const previousCost: ProductCostResponse = { ...stubCost, productId: 99, totalCost: 999 };
      env.component.cost.set(previousCost);
      env.productStub.getCost.mockReturnValue(of(null));

      env.component.loadProductCost(7);
      await flushMicrotasks();

      expect(env.component.cost()).toEqual(previousCost);
      expect(env.component.costLoading()).toBe(false);
    });

    it('resets cost() to null at the start of a second showModificationModal call so previous data does not flash', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.productStub.getCost.mockReturnValue(of(stubCost));

      env.component.showModificationModal(7);
      await flushMicrotasks();
      expect(env.component.cost()).toEqual(stubCost);

      const newCost: ProductCostResponse = { ...stubCost, productId: 8, totalCost: 99 };
      const subject = new Subject<ProductCostResponse | null>();
      env.productStub.getCost.mockReturnValue(subject.asObservable());
      env.productStub.findProduct.mockReturnValue(of({ ...buildProductFixture(), id: 8 }));

      env.component.showModificationModal(8);

      expect(env.component.cost()).toBeNull();
      expect(env.component.costError()).toBeNull();

      subject.next(newCost);

      expect(env.component.cost()).toEqual(newCost);
      expect(env.component.costLoading()).toBe(false);
    });
  });

  describe('submitStep3 payload shape', () => {
    it('omits id, selectionType, baseRecipeEnabled, and schedulingRequired from the updateProduct payload', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.productStub.updateProduct.mockReturnValue(of({}));
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      const fakeOptions = { id: 7, name: 'Lentejas', optionCategoryId: 1, optionCategoryName: 'Default' };
      env.masterDataStub.getProductOptions = vi.fn().mockReturnValue(of([fakeOptions]));
      const productOptionStub = TestBed.inject(ProductOption) as unknown as { getOptions: ReturnType<typeof vi.fn> };
      productOptionStub.getOptions = vi.fn().mockReturnValue(of([]));

      env.component.submitStep3();
      await flushMicrotasks();

      expect(env.productStub.updateProduct).toHaveBeenCalledTimes(1);
      const payload = env.productStub.updateProduct.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('id');
      expect(payload).not.toHaveProperty('selectionType');
      expect(payload).not.toHaveProperty('baseRecipeEnabled');
      expect(payload).not.toHaveProperty('schedulingRequired');
    });
  });

  describe('submitStep3 error handling', () => {
    it('shows error toast and does not advance the wizard when updateProduct fails', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValue(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      const messageService = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');

      const findProductCallsBefore = env.productStub.findProduct.mock.calls.length;
      env.productStub.updateProduct.mockReturnValue(throwError(() => new Error('save failed')));

      env.component.submitStep3();
      await flushMicrotasks();

      const errorCalls = addSpy.mock.calls.filter(
        ([msg]: [{ severity: string; detail: string }]) =>
          msg.severity === 'error' && msg.detail === 'No se pudo guardar el producto con sus opciones'
      );
      expect(errorCalls.length).toBeGreaterThanOrEqual(1);
      expect(env.component.currentStep()).not.toBe(4);
      expect(env.component.isSubmitting()).toBe(false);
      expect(env.productStub.findProduct.mock.calls.length).toBe(findProductCallsBefore);
    });

    it('shows warn toast and advances the wizard to step 4 when findProduct fails after a successful updateProduct', async () => {
      const env = setupComponent();
      env.productStub.findProduct.mockReturnValueOnce(of(buildProductFixture()));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      const messageService = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');

      env.productStub.updateProduct.mockReturnValue(of({}));
      env.productStub.findProduct.mockReset();
      env.productStub.findProduct.mockReturnValue(throwError(() => new Error('refetch failed')));

      env.component.submitStep3();
      await flushMicrotasks();

      const warnCalls = addSpy.mock.calls.filter(
        ([msg]: [{ severity: string; summary: string }]) =>
          msg.severity === 'warn' && msg.summary === 'Guardado con observaciones'
      );
      expect(warnCalls.length).toBeGreaterThanOrEqual(1);
      expect(env.component.currentStep()).toBe(4);
      expect(env.component.isSubmitting()).toBe(false);
      expect(env.productStub.updateProduct).toHaveBeenCalledTimes(1);
    });
  });

  describe('wizard navigation — back buttons', () => {
    it('goToStep1 moves currentStep from 2 back to 1', () => {
      const env = setupComponent();
      env.component.currentStep.set(2);
      env.component.goToStep1();
      expect(env.component.currentStep()).toBe(1);
    });

    it('goToStep2 moves currentStep from 3 back to 2', () => {
      const env = setupComponent();
      env.component.currentStep.set(3);
      env.component.goToStep2();
      expect(env.component.currentStep()).toBe(2);
    });
  });

  describe('existingRecipeCategoryMap population on showModificationModal', () => {
    it('maps each loaded recipe row to its variant categoryId', async () => {
      const env = setupComponent();
      const fixture: ProductResponse = {
        ...buildProductFixture(),
        recipe: [{ id: 501, supplyVariantId: 5, requiredQuantity: 1 }],
      };
      env.cacheStub.referenceData.data = vi.fn().mockReturnValue({
        areas: [],
        categories: [],
        optionCategories: [],
        variants: [
          {
            id: 5,
            supplyId: 1,
            supplyName: 'Tomate',
            categoryId: 2,
            categoryName: 'Verduras',
            unitId: 1,
            unitAbbreviation: 'kg',
            quantity: 0,
            stockBodega: 0,
            stockCocina: 0,
            unitCost: 0,
          },
        ],
        productOptions: [],
      });
      env.productStub.findProduct.mockReturnValue(of(fixture));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      expect(env.component.getExistingRecipeCategory(0)).toBe(2);
    });

    it('falls back to null when the recipe variant is not present in supplyVariantOptions', async () => {
      const env = setupComponent();
      const fixture: ProductResponse = {
        ...buildProductFixture(),
        recipe: [{ id: 501, supplyVariantId: 999, requiredQuantity: 1 }],
      };
      env.productStub.findProduct.mockReturnValue(of(fixture));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      expect(env.component.getExistingRecipeCategory(0)).toBeNull();
    });
  });

  describe('step 4 description rendering', () => {
    it('updates createdProduct() to include the description after a successful submitStep3', async () => {
      const env = setupComponent();
      const fixtureWithExtras: ProductResponse = {
        ...buildProductFixture(),
        description: 'Lentejas con verduras y especias',
        estimatedPrepMinutes: 12,
      };
      env.productStub.findProduct.mockReturnValue(of(fixtureWithExtras));
      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.productStub.updateProduct.mockReturnValue(of({}));
      env.productStub.findProduct.mockReturnValue(of(fixtureWithExtras));
      const fakeOptions = { id: 7, name: 'Lentejas', optionCategoryId: 1, optionCategoryName: 'Default' };
      env.masterDataStub.getProductOptions = vi.fn().mockReturnValue(of([fakeOptions]));
      const productOptionStub = TestBed.inject(ProductOption) as unknown as { getOptions: ReturnType<typeof vi.fn> };
      productOptionStub.getOptions = vi.fn().mockReturnValue(of([]));

      env.component.submitStep3();
      await flushMicrotasks();

      expect(env.component.createdProduct()?.description).toBe('Lentejas con verduras y especias');
    });
  });

  describe('recipeCost live signal', () => {
    function makeVariant(id: number, unitCost: number): SupplyVariantResponse {
      return {
        id,
        supplyId: 1,
        supplyName: `v${String(id)}`,
        categoryId: 1,
        categoryName: 'cat',
        unitId: 1,
        unitAbbreviation: 'kg',
        quantity: 0,
        stockBodega: 0,
        stockCocina: 0,
        unitCost,
      };
    }

    function setVariants(env: ReturnType<typeof setupComponent>, variants: SupplyVariantResponse[]) {
      env.cacheStub.referenceData.data = vi.fn().mockReturnValue({
        areas: [],
        categories: [],
        optionCategories: [],
        variants,
        productOptions: [],
      });
    }

    it('returns 0 when the recipe FormArrays are empty', () => {
      const env = setupComponent();
      setVariants(env, [makeVariant(1, 1000)]);
      expect(env.component.recipeCost()).toBe(0);
    });

    it('computes unitCost × requiredQuantity when a new baseRecipe row is added', () => {
      const env = setupComponent();
      setVariants(env, [makeVariant(1, 1000)]);

      env.component.addBaseRecipeItem();
      env.component.baseRecipe.at(0).get('supplyVariantId')?.setValue(1);
      env.component.baseRecipe.at(0).get('requiredQuantity')?.setValue(2);

      expect(env.component.recipeCost()).toBe(2000);
    });

    it('reacts to existingRecipe row changes without touching server cost()', async () => {
      const env = setupComponent();
      setVariants(env, [makeVariant(999, 500)]);
      const fixture: ProductResponse = {
        ...buildProductFixture(),
        recipe: [{ id: 901, supplyVariantId: 999, requiredQuantity: 1 }],
      };
      env.productStub.findProduct.mockReturnValue(of(fixture));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      expect(env.component.recipeCost()).toBe(500);
      const initialServerCost = env.component.cost();

      env.component.existingRecipe.at(0).get('requiredQuantity')?.setValue(3);

      expect(env.component.recipeCost()).toBe(1500);
      expect(env.component.cost()).toBe(initialServerCost);
    });

    it('does NOT double-count when the same supplyVariantId appears in both existingRecipe and baseRecipe (last write wins)', async () => {
      const env = setupComponent();
      setVariants(env, [makeVariant(7, 100)]);
      const fixture: ProductResponse = {
        ...buildProductFixture(),
        recipe: [{ id: 902, supplyVariantId: 7, requiredQuantity: 1 }],
      };
      env.productStub.findProduct.mockReturnValue(of(fixture));

      env.component.showModificationModal(7);
      await flushMicrotasks();

      env.component.addBaseRecipeItem();
      env.component.baseRecipe.at(0).get('supplyVariantId')?.setValue(7);
      env.component.baseRecipe.at(0).get('requiredQuantity')?.setValue(2);

      expect(env.component.baseRecipe.length).toBe(1);
      const total = (1 + 2) * 100;
      expect(total).toBe(300);
      expect(env.component.recipeCost()).toBe(200);
    });
  });
});
