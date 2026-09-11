/**
 * Tests for the Products page component.
 *
 * Feature: Product listing page with search, filtering, and navigation to detail.
 * Contract: Loads products via HTTP, renders product cards, supports search and navigation.
 * Approach: Mount component via TestBed with router and HTTP, assert rendered product list.
 */
import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { Products } from './products';
import { Product } from '@app/core/services/products/product';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { ProductCache } from './product-cache';
import { ProductOption } from '@app/core/services/product-option/product-option';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { ProductImage } from '@app/core/services/product-image/product-image';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';

import productsHtml from './products.html?raw';

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
    enableProduct: vi.fn().mockReturnValue(of(null)),
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
    setProductListParams: vi.fn(),
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

describe('Products page', () => {
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

    it('openPrepTimeDialog opens the dialog', () => {
      const env = setupComponent();
      env.component.prepTimeDialogOpen.set(false);
      env.component.openPrepTimeDialog();
      expect(env.component.prepTimeDialogOpen()).toBe(true);
    });
  });

  describe('Mostrar inactivos toggle', () => {
    it('setIncludeInactive(true) flips the signal and resets page to 0', () => {
      const env = setupComponent();

      env.component.setIncludeInactive(true);

      expect(env.component.includeInactive()).toBe(true);
      expect(env.cacheStub.setProductListParams).toHaveBeenCalledWith({ page: 0 });
    });

    it('setIncludeInactive(false) flips the signal and resets page to 0', () => {
      const env = setupComponent();

      env.component.setIncludeInactive(true);
      env.component.setIncludeInactive(false);

      expect(env.component.includeInactive()).toBe(false);
      expect(env.cacheStub.setProductListParams).toHaveBeenLastCalledWith({ page: 0 });
    });

    it('with includeInactive=true, products() shows only inactive products from cache', () => {
      const env = setupComponent();
      const fixture: ProductResponse[] = [
        { id: 1, name: 'Activo', basePrice: 5, active: true, categoryId: 1, categoryName: 'C', areaId: 1, areaName: 'A', recipe: [] },
        { id: 2, name: 'Inactivo', basePrice: 5, active: false, categoryId: 1, categoryName: 'C', areaId: 1, areaName: 'A', recipe: [] },
        { id: 3, name: 'Otro inactivo', basePrice: 5, active: false, categoryId: 1, categoryName: 'C', areaId: 1, areaName: 'A', recipe: [] },
      ];
      env.cacheStub.products.data = vi.fn().mockReturnValue({
        content: fixture,
        totalPages: 1,
        totalElements: fixture.length,
        page: 0,
        size: 6,
      });

      env.component.setIncludeInactive(true);

      const products = env.component.products();
      expect(products).toHaveLength(2);
      expect(products?.map((p) => p.id)).toEqual([2, 3]);
    });

    it('with includeInactive=false, products() shows only active products from cache', () => {
      const env = setupComponent();
      const fixture: ProductResponse[] = [
        { id: 1, name: 'Activo', basePrice: 5, active: true, categoryId: 1, categoryName: 'C', areaId: 1, areaName: 'A', recipe: [] },
        { id: 2, name: 'Inactivo', basePrice: 5, active: false, categoryId: 1, categoryName: 'C', areaId: 1, areaName: 'A', recipe: [] },
        { id: 3, name: 'Otro activo', basePrice: 5, active: true, categoryId: 1, categoryName: 'C', areaId: 1, areaName: 'A', recipe: [] },
      ];
      env.cacheStub.products.data = vi.fn().mockReturnValue({
        content: fixture,
        totalPages: 1,
        totalElements: fixture.length,
        page: 0,
        size: 6,
      });

      const products = env.component.products();
      expect(products).toHaveLength(2);
      expect(products?.map((p) => p.id)).toEqual([1, 3]);
    });
  });

  describe('Activar inactivos', () => {
    it('confirmEnableProduct abre un popup de confirmación con acceptLabel "Activar" y al aceptar llama productService.enableProduct', () => {
      const env = setupComponent();
      const confirmationService = TestBed.inject(ConfirmationService);
      const confirmSpy = vi.spyOn(confirmationService, 'confirm');
      const product = buildProductFixture();

      env.component.confirmEnableProduct(new Event('click'), product);

      expect(confirmSpy).toHaveBeenCalledTimes(1);
      const config = confirmSpy.mock.calls[0][0] as { acceptLabel: string; accept: () => void };
      expect(config.acceptLabel).toBe('Activar');

      config.accept();
      expect(env.productStub.enableProduct).toHaveBeenCalledWith(product.id);
    });

    it('enableProduct emite invalidación WebSocket "products/update" y llama refreshProducts en éxito', () => {
      const env = setupComponent();
      const product = buildProductFixture();

      (env.component as unknown as { enableProduct: (id: number) => void }).enableProduct(product.id);

      expect(env.wsStub.emitCacheInvalidation).toHaveBeenCalledWith('products', 'update');
      expect(env.cacheStub.products.refresh).toHaveBeenCalled();
    });

    it('enableProduct muestra toast "No se pudo activar el producto" en error', () => {
      const env = setupComponent();
      const product = buildProductFixture();
      env.productStub.enableProduct.mockReturnValue(throwError(() => ({ status: 500 })));
      const messageService = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');

      (env.component as unknown as { enableProduct: (id: number) => void }).enableProduct(product.id);

      const errorCalls = addSpy.mock.calls.filter(
        ([msg]: [{ severity: string; detail: string }]) =>
          msg.severity === 'error' && msg.detail === 'No se pudo activar el producto'
      );
      expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('showCreationModal does NOT auto-create (create mode)', () => {
    it('does not call createProduct on showCreationModal even when reference data is ready', async () => {
      const env = setupComponent();
      env.cacheStub.referenceData.data = vi.fn().mockReturnValue({
        areas: [{ id: 1, name: 'Cocina' }],
        categories: [{ id: 1, name: 'Comidas' }],
        optionCategories: [],
        variants: [],
        productOptions: [],
      });
      env.productStub.createProduct.mockClear();

      env.component.showCreationModal();
      await flushMicrotasks();

      expect(env.productStub.createProduct).not.toHaveBeenCalled();
      expect(env.component.createdProduct()).toBeNull();
      expect(env.component.modalMode()).toBe('create');
      expect(env.component.modalIsOpen()).toBe(true);
    });

    it('does not call createProduct on showCreationModal when reference data is empty', async () => {
      const env = setupComponent();
      env.productStub.createProduct.mockClear();

      env.component.showCreationModal();
      await flushMicrotasks();

      expect(env.productStub.createProduct).not.toHaveBeenCalled();
      expect(env.component.createdProduct()).toBeNull();
      expect(env.component.modalIsOpen()).toBe(true);
    });
  });

  describe('canUploadImage computed', () => {
    it('is false on a fresh component (no form values)', () => {
      const env = setupComponent();
      expect(env.component.canUploadImage()).toBe(false);
    });

    it('is false when only name is filled (missing categoryId/areaId)', async () => {
      const env = setupComponent();
      env.component.baseForm.patchValue({ name: 'Hamburguesa' });
      await flushMicrotasks();
      expect(env.component.canUploadImage()).toBe(false);
    });

    it('is false when name is shorter than 2 characters even if the other fields are set', async () => {
      const env = setupComponent();
      env.component.baseForm.patchValue({ name: 'H', categoryId: 1, areaId: 1 });
      await flushMicrotasks();
      expect(env.component.canUploadImage()).toBe(false);
    });

    it('is true when name (>=2 chars) + categoryId + areaId are filled', async () => {
      const env = setupComponent();
      env.component.baseForm.patchValue({ name: 'Hamburguesa', categoryId: 1, areaId: 1 });
      await flushMicrotasks();
      expect(env.component.canUploadImage()).toBe(true);
    });

    it('flips back to false when the user clears the name after enabling it', async () => {
      const env = setupComponent();
      env.component.baseForm.patchValue({ name: 'Hamburguesa', categoryId: 1, areaId: 1 });
      await flushMicrotasks();
      expect(env.component.canUploadImage()).toBe(true);

      env.component.baseForm.patchValue({ name: '' });
      await flushMicrotasks();
      expect(env.component.canUploadImage()).toBe(false);
    });
  });

  describe('onWizardImageSelect stages images instead of uploading immediately', () => {
    function makeImageFile(): File {
      return new File([new Uint8Array([0, 1, 2])], 'x.png', { type: 'image/png' });
    }

    function stubDraft(env: ReturnType<typeof setupComponent>, id: number): ProductResponse {
      const draft: ProductResponse = {
        id,
        name: 'Hamburguesa',
        basePrice: 0,
        active: true,
        categoryId: 1,
        categoryName: 'Comidas',
        areaId: 1,
        areaName: 'Cocina',
        recipe: [],
      };
      env.productStub.createProduct.mockReturnValue(of(draft));
      return draft;
    }

    it('creates the product and stages the image when no draft exists yet', async () => {
      const env = setupComponent();
      env.component.showCreationModal();
      await flushMicrotasks();
      env.productStub.createProduct.mockClear();
      env.imageStub.uploadImage.mockClear();

      env.component.baseForm.patchValue({ name: 'Hamburguesa', categoryId: 1, areaId: 1 });
      await flushMicrotasks();

      const draftId = 11;
      stubDraft(env, draftId);

      env.component.onWizardImageSelect({ files: [makeImageFile()] });
      await flushMicrotasks();

      expect(env.productStub.createProduct).toHaveBeenCalledTimes(1);
      const payload = env.productStub.createProduct.mock.calls[0][0] as {
        name: string;
        basePrice: number;
        categoryId: number;
        areaId: number;
        recipe: unknown[];
        optionIds: unknown[];
      };
      expect(payload.name).toBe('Hamburguesa');
      expect(payload.basePrice).toBe(0);
      expect(payload.categoryId).toBe(1);
      expect(payload.areaId).toBe(1);
      expect(payload.recipe).toEqual([]);
      expect(payload.optionIds).toEqual([]);

      // Image should be staged, not uploaded immediately
      expect(env.imageStub.uploadImage).not.toHaveBeenCalled();
      expect(env.component.stagedNewImages().length).toBe(1);

      expect(env.component.createdProduct()?.id).toBe(draftId);
      expect(env.component.baseForm.get('id')?.value).toBe(draftId);
      expect(env.component.isProcessingImage()).toBe(false);
    });

    it('does NOT call createProduct when the form is invalid — shows a warn toast instead', async () => {
      const env = setupComponent();
      env.component.showCreationModal();
      await flushMicrotasks();
      env.productStub.createProduct.mockClear();
      env.imageStub.uploadImage.mockClear();

      const messageService = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');

      env.component.onWizardImageSelect({ files: [makeImageFile()] });
      await flushMicrotasks();

      expect(env.productStub.createProduct).not.toHaveBeenCalled();
      expect(env.imageStub.uploadImage).not.toHaveBeenCalled();
      const warnCalls = addSpy.mock.calls.filter(
        ([msg]: [{ severity: string; summary: string }]) =>
          msg.severity === 'warn' && msg.summary === 'Datos incompletos'
      );
      expect(warnCalls.length).toBeGreaterThanOrEqual(1);
      expect(env.component.createdProduct()).toBeNull();
    });

    it('stages the image (no POST, no upload) when a draft already exists', async () => {
      const env = setupComponent();
      env.component.modalMode.set('create');
      env.component.createdProduct.set({
        id: 77, name: 'Hamburguesa', basePrice: 0, active: true,
        categoryId: 1, categoryName: 'C', areaId: 1, areaName: 'A', recipe: [],
      });
      env.productStub.createProduct.mockClear();
      env.imageStub.uploadImage.mockClear();

      env.component.onWizardImageSelect({ files: [makeImageFile()] });
      await flushMicrotasks();

      expect(env.productStub.createProduct).not.toHaveBeenCalled();
      // Image is staged in memory, not uploaded to server
      expect(env.imageStub.uploadImage).not.toHaveBeenCalled();
      expect(env.component.stagedNewImages().length).toBe(1);
    });

    it('shows an error toast and does not upload when the on-demand POST fails', async () => {
      const env = setupComponent();
      env.component.showCreationModal();
      await flushMicrotasks();
      env.component.baseForm.patchValue({ name: 'Hamburguesa', categoryId: 1, areaId: 1 });
      await flushMicrotasks();
      env.productStub.createProduct.mockReturnValue(throwError(() => new Error('boom')));
      env.imageStub.uploadImage.mockClear();

      const messageService = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');

      env.component.onWizardImageSelect({ files: [makeImageFile()] });
      await flushMicrotasks();

      expect(env.imageStub.uploadImage).not.toHaveBeenCalled();
      const errorCalls = addSpy.mock.calls.filter(
        ([msg]: [{ severity: string; detail: string }]) =>
          msg.severity === 'error' && msg.detail === 'No se pudo crear el producto para subir la imagen'
      );
      expect(errorCalls.length).toBeGreaterThanOrEqual(1);
      expect(env.component.createdProduct()).toBeNull();
      expect(env.component.isProcessingImage()).toBe(false);
    });
  });

  describe('submitStep1 advances without re-creating when draft exists', () => {
    it('does not call createProduct again if a draft was auto-created', async () => {
      const env = setupComponent();
      env.productStub.createProduct.mockClear();

      // Simulate state after auto-create completed.
      env.component.modalMode.set('create');
      env.component.createdProduct.set({
        id: 33, name: 'Nuevo producto', basePrice: 0, active: true,
        categoryId: 1, categoryName: 'C', areaId: 1, areaName: 'A', recipe: [],
      });
      env.component.baseForm.patchValue({
        name: 'Nuevo producto',
        categoryId: 1,
        areaId: 1,
      });

      env.component.submitStep1();
      await flushMicrotasks();

      expect(env.productStub.createProduct).not.toHaveBeenCalled();
      expect(env.component.currentStep()).toBe(2);
    });
  });

  describe('Ver receta button', () => {
    it('template contains routerLink to recipe page with product id', () => {
      expect(productsHtml).toContain('Ver receta');
      expect(productsHtml).toContain("/admin/manage/products', product.id, 'recipe'");
    });
  });
});
