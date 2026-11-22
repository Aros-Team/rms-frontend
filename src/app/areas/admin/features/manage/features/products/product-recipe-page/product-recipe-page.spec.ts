/**
 * Tests for the product recipe and costing page.
 *
 * Feature: edit a product recipe, keep the product options intact on save,
 * cost it live, replace option recipes with an explicit confirmation and guard
 * unsaved changes.
 * Contract:
 *  - loads product, cost, cost-breakdown, options, images and labor mode; the
 *    draft starts clean
 *  - material/labor/total/margin recompute from draft rows plus the server
 *    labor cost; a dirty draft is marked stale
 *  - save sends name, price, recipe, optionIds and optionExtras (the API wipes
 *    associations when optionIds are omitted) and never sends `active`
 *  - a ProblemDetail `detail` is shown for a failed save
 *  - 403/404 render a no-permission/not-found state without a retry loop
 *  - a failed cost request keeps the page usable and marks the total partial
 *  - a failed options request blocks saving so associations cannot be wiped
 *  - option recipes require an acknowledgement when the option already has a
 *    cost; saving replaces the recipe and refetches costs
 *  - leaving with unsaved changes opens a confirmation dialog; beforeunload is
 *    cancelled
 *
 * Approach: TestBed with mocked services, real primitives whose external
 * templates are resolved through ?raw imports. Assertions target emitted
 * payloads, signals and contextual DOM.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { ProductRecipePage } from './product-recipe-page';
import { Product } from '@app/core/services/products/product';
import { ProductOption as ProductOptionService } from '@app/core/services/product-option/product-option';
import { ProductImage } from '@app/core/services/product-image/product-image';
import { ProductCache } from '../product-cache';
import { RecipeLaborMode } from './recipe-labor-mode';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { createRecipeRow } from './recipe-rows';

import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import type { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';
import type { ProductCostBreakdownResponse } from '@app/shared/models/dto/products/product-cost-breakdown-response';
import type { ProductOption } from '@app/shared/models/dto/products/product-option';
import type { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import type { Money } from '@app/shared/models/dto/common/money';

import pageHtml from './product-recipe-page.html?raw';
import editorHtml from './recipe-ingredient-editor.html?raw';
import buttonHtml from '@app/shared/ui/button/button.html?raw';
import badgeHtml from '@app/shared/ui/badge/badge.html?raw';
import cardHtml from '@app/shared/ui/card/card.html?raw';
import checkboxHtml from '@app/shared/ui/checkbox/checkbox.html?raw';
import dialogHtml from '@app/shared/ui/dialog/dialog.html?raw';
import emptyStateHtml from '@app/shared/ui/empty-state/empty-state.html?raw';
import fieldHtml from '@app/shared/ui/field/field.html?raw';
import iconButtonHtml from '@app/shared/ui/icon-button/icon-button.html?raw';
import inputHtml from '@app/shared/ui/input/input.html?raw';
import pageHeaderHtml from '@app/shared/ui/page-header/page-header.html?raw';
import selectHtml from '@app/shared/ui/select/select.html?raw';
import skeletonHtml from '@app/shared/ui/skeleton/skeleton.html?raw';
import statTileHtml from '@app/shared/ui/stat-tile/stat-tile.html?raw';

function money(amount: string, currency = 'COP'): Money {
  return { amount, currency };
}

const VARIANTS: SupplyVariantResponse[] = [
  {
    id: 301,
    supplyId: 401,
    supplyName: 'Tomate',
    categoryId: 1,
    categoryName: 'Verduras',
    unitId: 1,
    unitAbbreviation: 'kg',
    quantity: 1,
    stockBodega: 10,
    stockCocina: 4,
    unitCost: money('2000.00'),
  },
  {
    id: 302,
    supplyId: 402,
    supplyName: 'Cebolla',
    categoryId: 1,
    categoryName: 'Verduras',
    unitId: 1,
    unitAbbreviation: 'kg',
    quantity: 1,
    stockBodega: 8,
    stockCocina: 2,
    unitCost: money('4000.00'),
  },
  {
    id: 303,
    supplyId: 403,
    supplyName: 'Queso',
    categoryId: 2,
    categoryName: 'Lácteos',
    unitId: 1,
    unitAbbreviation: 'kg',
    quantity: 1,
    stockBodega: 5,
    stockCocina: 1,
    unitCost: money('9000.00'),
  },
];

function buildProduct(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 7,
    name: 'Lentejas',
    description: 'Lentejas con verduras',
    basePrice: money('28000.00'),
    active: true,
    categoryId: 2,
    categoryName: 'Comidas',
    areaId: 1,
    areaName: 'Cocina',
    estimatedPrepMinutes: 10,
    recipe: [
      { id: 1, supplyVariantId: 301, requiredQuantity: 0.5 },
      { id: 2, supplyVariantId: 302, requiredQuantity: 0.25 },
    ],
    optionGroupIds: [1],
    ...overrides,
  };
}

function buildCost(): ProductCostResponse {
  return {
    productId: 7,
    materialCost: money('2000.00'),
    laborCost: money('800.00'),
    totalCost: money('2800.00'),
    breakdown: [],
  };
}

function buildBreakdown(): ProductCostBreakdownResponse {
  return {
    productId: 7,
    name: 'Lentejas',
    baseCost: money('2000.00'),
    options: [
      {
        optionId: 1,
        name: 'Carne',
        cost: money('5250.00'),
        extraPrice: money('2500.00'),
        categoryId: 1,
        categorySelectionType: 'SINGLE_CHOICE',
      },
      {
        optionId: 2,
        name: 'Pollo',
        cost: money('0.00'),
        extraPrice: money('0.00'),
        categoryId: 1,
        categorySelectionType: 'SINGLE_CHOICE',
      },
    ],
    categories: [],
    projectedOptionCost: money('2625.00'),
    projectedEffectiveCost: money('4625.00'),
  };
}

function buildOptions(): ProductOption[] {
  return [
    {
      id: 1,
      name: 'Carne',
      optionGroupId: 1,
      optionGroupName: 'Proteína',
      cost: money('5250.00'),
      extraPrice: money('2500.00'),
      categorySelectionType: 'SINGLE_CHOICE',
    },
    {
      id: 2,
      name: 'Pollo',
      optionGroupId: 1,
      optionGroupName: 'Proteína',
      cost: money('0.00'),
      extraPrice: money('0.00'),
      categorySelectionType: 'SINGLE_CHOICE',
    },
  ];
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function htmlError(status: number, detail: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { detail }, statusText: 'error' });
}

interface Env {
  productStub: {
    findProduct: ReturnType<typeof vi.fn>;
    updateProduct: ReturnType<typeof vi.fn>;
    getCost: ReturnType<typeof vi.fn>;
    getCostBreakdown: ReturnType<typeof vi.fn>;
    getOptions: ReturnType<typeof vi.fn>;
  };
  optionStub: { updateOption: ReturnType<typeof vi.fn> };
  imageStub: {
    getImages: ReturnType<typeof vi.fn>;
    uploadImage: ReturnType<typeof vi.fn>;
    deleteImage: ReturnType<typeof vi.fn>;
  };
  cacheStub: {
    referenceData: {
      data: ReturnType<typeof vi.fn>;
      isLoading: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      refresh: ReturnType<typeof vi.fn>;
      loadIfStale: ReturnType<typeof vi.fn>;
    };
    invalidateProductList: ReturnType<typeof vi.fn>;
  };
  wsStub: { emitCacheInvalidation: ReturnType<typeof vi.fn> };
  router: { navigate: ReturnType<typeof vi.fn> };
}

function configure(productId = '7'): Env {
  const productStub = {
    findProduct: vi.fn().mockReturnValue(of(buildProduct())),
    updateProduct: vi.fn().mockReturnValue(of({})),
    getCost: vi.fn().mockReturnValue(of(buildCost())),
    getCostBreakdown: vi.fn().mockReturnValue(of(buildBreakdown())),
    getOptions: vi.fn().mockReturnValue(of(buildOptions())),
  };
  const optionStub = { updateOption: vi.fn().mockReturnValue(of(buildOptions()[0])) };
  const imageStub = {
    getImages: vi.fn().mockReturnValue(of([])),
    uploadImage: vi.fn(),
    deleteImage: vi.fn().mockReturnValue(of({})),
  };
  const cacheStub = {
    referenceData: {
      data: vi.fn().mockReturnValue({
        areas: [{ id: 1, name: 'Cocina', type: 'KITCHEN', enabled: true }],
        categories: [{ id: 2, name: 'Comidas', enabled: true }],
        variants: VARIANTS.map((variant) => ({
          ...variant,
          displayName: `${variant.supplyName} — ${String(variant.quantity)} ${variant.unitAbbreviation}`,
        })),
        productOptions: [],
      }),
      isLoading: vi.fn().mockReturnValue(false),
      error: vi.fn().mockReturnValue(undefined),
      refresh: vi.fn(),
      loadIfStale: vi.fn(),
    },
    invalidateProductList: vi.fn(),
  };
  const wsStub = { emitCacheInvalidation: vi.fn() };
  const router = { navigate: vi.fn() };

  const paramMap = new Map<string, string>([['id', productId]]);
  TestBed.configureTestingModule({
    imports: [ProductRecipePage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: Product, useValue: productStub },
      { provide: ProductOptionService, useValue: optionStub },
      { provide: ProductImage, useValue: imageStub },
      { provide: ProductCache, useValue: cacheStub },
      { provide: RecipeLaborMode, useValue: { load: () => of('AUTO') } },
      { provide: WebSocket, useValue: wsStub },
      { provide: Router, useValue: router },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: (key: string) => paramMap.get(key) ?? null,
              has: (key: string) => paramMap.has(key),
              getAll: () => [] as string[],
              keys: [...paramMap.keys()],
            },
          },
        },
      },
    ],
  });

  return { productStub, optionStub, imageStub, cacheStub, wsStub, router };
}

describe('ProductRecipePage', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      const resources: Record<string, string> = {
        'product-recipe-page.html': pageHtml as unknown as string,
        'recipe-ingredient-editor.html': editorHtml as unknown as string,
        'button.html': buttonHtml as unknown as string,
        'badge.html': badgeHtml as unknown as string,
        'card.html': cardHtml as unknown as string,
        'checkbox.html': checkboxHtml as unknown as string,
        'dialog.html': dialogHtml as unknown as string,
        'empty-state.html': emptyStateHtml as unknown as string,
        'field.html': fieldHtml as unknown as string,
        'icon-button.html': iconButtonHtml as unknown as string,
        'input.html': inputHtml as unknown as string,
        'page-header.html': pageHeaderHtml as unknown as string,
        'select.html': selectHtml as unknown as string,
        'skeleton.html': skeletonHtml as unknown as string,
        'stat-tile.html': statTileHtml as unknown as string,
      };
      for (const [name, content] of Object.entries(resources)) {
        if (url.endsWith(name)) return Promise.resolve(content);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  function mount(): ComponentFixture<ProductRecipePage> {
    const fixture = TestBed.createComponent(ProductRecipePage);
    fixture.detectChanges();
    return fixture;
  }

  function root(fixture: ComponentFixture<ProductRecipePage>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('loads product, costs, options, images and labor mode', () => {
    const env = configure();
    const fixture = mount();
    const page = fixture.componentInstance;

    expect(env.productStub.findProduct).toHaveBeenCalledWith(7);
    expect(env.productStub.getCost).toHaveBeenCalledWith(7);
    expect(env.productStub.getCostBreakdown).toHaveBeenCalledWith(7);
    expect(env.productStub.getOptions).toHaveBeenCalledWith(7);
    expect(env.imageStub.getImages).toHaveBeenCalledWith(7);
    expect(env.cacheStub.referenceData.loadIfStale).toHaveBeenCalled();

    expect(page.state()).toBe('ready');
    expect(page.draft().name).toBe('Lentejas');
    expect(page.recipeRows()).toHaveLength(2);
    expect(page.dirty()).toBe(false);
    expect(page.laborMode()).toBe('AUTO');
    expect(root(fixture).querySelector('h1')?.textContent.trim()).toBe('Receta y costeo');
  });

  it('computes material, labor, total and margin from the server cost plus the draft', () => {
    const fixture = mount(configure());
    const page = fixture.componentInstance;

    // 0.5 × 2000 + 0.25 × 4000 = 2000; labor 800; total 2800
    expect(page.materialMicro()).toBe(2_000_000_000n);
    expect(page.laborMicro()).toBe(800_000_000n);
    expect(page.totalMicro()).toBe(2_800_000_000n);
    expect(page.marginLabel()).toBe('90,0 %');
    expect(page.marginPeriod()).toBe('Costo primo 10,0 %');
  });

  it('recomputes the total after a quantity edit and marks the cost stale', () => {
    const fixture = mount(configure());
    const page = fixture.componentInstance;

    page.updateRecipeRows([createRecipeRow(301, '1'), createRecipeRow(302, '0,25')]);
    fixture.detectChanges();

    // 1 × 2000 + 0.25 × 4000 = 3000; + 800 labor = 3800
    expect(page.totalMicro()).toBe(3_800_000_000n);
    expect(page.dirty()).toBe(true);
    expect(page.canSave()).toBe(true);
    expect(root(fixture).textContent).toContain('Costos sin guardar');
    expect(root(fixture).textContent).toContain('Estimado con los cambios sin guardar');
  });

  it('disables the save action until the draft changes', () => {
    const fixture = mount(configure());
    const buttons = Array.from(
      root(fixture).querySelectorAll<HTMLButtonElement>('.recipe-actions button'),
    );

    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[1]?.disabled).toBe(true);

    fixture.componentInstance.updatePrice('29000');
    fixture.detectChanges();

    expect(
      Array.from(root(fixture).querySelectorAll<HTMLButtonElement>('.recipe-actions button'))[1]
        ?.disabled,
    ).toBe(false);
  });

  it('saves the recipe and re-sends the option associations', async () => {
    const env = configure();
    const fixture = mount();
    const page = fixture.componentInstance;

    page.updateName('Lentejas nuevas');
    page.updatePrice('29000');
    page.save();
    await flush();

    expect(env.productStub.updateProduct).toHaveBeenCalledTimes(1);
    const [id, request] = env.productStub.updateProduct.mock.calls[0] as [
      number,
      Record<string, unknown>,
    ];
    expect(id).toBe(7);
    expect(request['name']).toBe('Lentejas nuevas');
    expect(request['basePrice']).toBe(29000);
    expect(request['recipe']).toEqual([
      { supplyVariantId: 301, requiredQuantity: 0.5 },
      { supplyVariantId: 302, requiredQuantity: 0.25 },
    ]);
    expect(request['optionIds']).toEqual([1, 2]);
    expect(request['optionExtras']).toEqual([{ optionId: 1, extraPrice: 2500 }]);
    expect('active' in request).toBe(false);

    expect(page.dirty()).toBe(false);
    expect(page.saveSuccess()).toContain('Cambios guardados');
    expect(env.wsStub.emitCacheInvalidation).toHaveBeenCalledWith('products', 'update', 7);
    await flush();
    expect(env.productStub.getCost).toHaveBeenCalledTimes(2);
  });

  it('shows the server ProblemDetail detail when saving fails', async () => {
    const env = configure();
    env.productStub.updateProduct.mockReturnValue(
      throwError(() => htmlError(400, 'La categoría no existe')),
    );
    const fixture = mount();
    const page = fixture.componentInstance;

    page.updatePrice('29000');
    page.save();
    await flush();
    fixture.detectChanges();

    expect(page.saveError()).toBe('La categoría no existe');
    expect(page.saving()).toBe(false);
    expect(root(fixture).textContent).toContain('La categoría no existe');
    expect(root(fixture).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('renders a no-permission state for a 403 without a retry action', () => {
    const env = configure();
    env.productStub.findProduct.mockReturnValue(
      throwError(() => htmlError(403, 'No autorizado')),
    );
    const fixture = mount();

    expect(fixture.componentInstance.failure()?.forbidden).toBe(true);
    expect(root(fixture).textContent).toContain('Sin permiso para ver esta receta');
    expect(root(fixture).textContent).toContain('No autorizado');
    expect(root(fixture).textContent).not.toContain('Reintentar');
  });

  it('renders a not-found state for a 404', () => {
    const env = configure();
    env.productStub.findProduct.mockReturnValue(
      throwError(() => htmlError(404, 'Producto 7 no encontrado')),
    );
    const fixture = mount();

    expect(fixture.componentInstance.failure()?.notFound).toBe(true);
    expect(root(fixture).textContent).toContain('Producto no encontrado');
    expect(root(fixture).textContent).toContain('Producto 7 no encontrado');
  });

  it('keeps the page usable when only the cost request fails', () => {
    const env = configure();
    env.productStub.getCost.mockReturnValue(throwError(() => htmlError(500, 'boom')));
    const fixture = mount();
    const page = fixture.componentInstance;

    expect(page.state()).toBe('ready');
    expect(page.costError()).toBe('boom');
    expect(page.totalPartial()).toBe(true);
    expect(page.totalMicro()).toBe(2_000_000_000n);
    expect(root(fixture).textContent).toContain('Parcial');
  });

  it('uses a readable fallback when the server sends no problem detail', () => {
    const env = configure();
    env.productStub.getCost.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const fixture = mount();

    expect(fixture.componentInstance.costError()).toBe(
      'Error del servidor. Intenta de nuevo en unos minutos.',
    );
  });

  it('blocks saving when the options could not be loaded', () => {
    const env = configure();
    env.productStub.getOptions.mockReturnValue(throwError(() => htmlError(500, 'boom')));
    const fixture = mount();
    const page = fixture.componentInstance;

    page.updatePrice('29000');

    expect(page.optionsError()).not.toBeNull();
    expect(page.canSave()).toBe(false);
    expect(page.formErrors()).toContain(
      'No se pudieron cargar las opciones del producto. Guardar ahora eliminaría sus asociaciones.',
    );
  });

  it('requires an acknowledgement before replacing a costed option recipe', async () => {
    const env = configure();
    const fixture = mount();
    const page = fixture.componentInstance;

    expect(page.costedCount()).toBe(1);
    expect(page.uncostedCount()).toBe(1);

    page.openOptionEditor(page.optionGroups()[0], page.options()[0]);
    page.updateOptionRows([createRecipeRow(301, '2')]);
    fixture.detectChanges();

    expect(page.optionNeedsAck()).toBe(true);
    expect(page.canSaveOption()).toBe(false);

    page.updateOptionAck(true);
    expect(page.canSaveOption()).toBe(true);

    page.saveOptionRecipe();
    await flush();

    expect(env.optionStub.updateOption).toHaveBeenCalledWith(1, {
      name: 'Carne',
      optionGroupId: 1,
      recipe: [{ supplyVariantId: 301, requiredQuantity: 2 }],
    });
    expect(page.optionEditorOpen()).toBe(false);
    expect(page.saveSuccess()).toContain('Carne');
    await flush();
    expect(env.productStub.getCost).toHaveBeenCalledTimes(2);
    expect(env.productStub.getOptions).toHaveBeenCalledTimes(2);
  });

  it('lets an uncosted option be costed without an acknowledgement', () => {
    const fixture = mount(configure());
    const page = fixture.componentInstance;

    page.openOptionEditor(page.optionGroups()[0], page.options()[1]);
    page.updateOptionRows([createRecipeRow(302, '1')]);

    expect(page.optionNeedsAck()).toBe(false);
    expect(page.canSaveOption()).toBe(true);
  });

  it('shows the replacement warning and current option cost in the dialog', () => {
    const fixture = mount(configure());
    const page = fixture.componentInstance;

    page.openOptionEditor(page.optionGroups()[0], page.options()[0]);
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Guardar reemplaza la receta completa de la opción');
    expect(document.body.textContent).toContain('Costo actual');
  });

  it('confirms before leaving with unsaved changes', () => {
    const env = configure();
    const fixture = mount();
    const page = fixture.componentInstance;

    page.updatePrice('30000');
    page.goBack();

    expect(page.leaveDialogOpen()).toBe(true);
    expect(env.router.navigate).not.toHaveBeenCalled();

    page.leaveWithoutSaving();

    expect(page.leaveDialogOpen()).toBe(false);
    expect(env.router.navigate).toHaveBeenCalledWith(['/admin/manage/products']);
  });

  it('leaves immediately when the draft is clean', () => {
    const env = configure();
    const fixture = mount();

    fixture.componentInstance.goBack();

    expect(fixture.componentInstance.leaveDialogOpen()).toBe(false);
    expect(env.router.navigate).toHaveBeenCalledWith(['/admin/manage/products']);
  });

  it('cancels the native unload only while the draft is dirty', () => {
    const fixture = mount(configure());
    const page = fixture.componentInstance;
    const cleanPreventDefault = vi.fn();
    page.onBeforeUnload({ preventDefault: cleanPreventDefault } as unknown as BeforeUnloadEvent);
    expect(cleanPreventDefault).not.toHaveBeenCalled();

    page.updatePrice('30000');
    const dirtyPreventDefault = vi.fn();
    page.onBeforeUnload({ preventDefault: dirtyPreventDefault } as unknown as BeforeUnloadEvent);

    expect(page.hasUnsavedChanges()).toBe(true);
    expect(dirtyPreventDefault).toHaveBeenCalledTimes(1);
  });

  it('applies the suggested price from the live total', () => {
    const fixture = mount(configure());
    const page = fixture.componentInstance;

    // 2800 × 1.3 = 3640
    page.useSuggestedPrice();

    expect(page.priceValue()).toBe(3640);
    expect(page.dirty()).toBe(true);
  });

  it('warns about ingredients without unit cost and marks the material partial', () => {
    const env = configure();
    env.cacheStub.referenceData.data.mockReturnValue({
      areas: [{ id: 1, name: 'Cocina', type: 'KITCHEN', enabled: true }],
      categories: [{ id: 2, name: 'Comidas', enabled: true }],
      variants: [
        {
          ...VARIANTS[0],
          unitCost: money(''),
          displayName: 'Tomate — 1 kg',
        },
      ],
      productOptions: [],
    });
    env.productStub.findProduct.mockReturnValue(
      of(buildProduct({ recipe: [{ supplyVariantId: 301, requiredQuantity: 1 }] })),
    );
    env.productStub.getCost.mockReturnValue(throwError(() => htmlError(500, 'boom')));
    env.productStub.getCostBreakdown.mockReturnValue(throwError(() => htmlError(500, 'boom')));
    const fixture = mount();
    const page = fixture.componentInstance;

    expect(page.missingCostCount()).toBe(1);
    expect(page.materialMicro()).toBe(0n);
    expect(page.totalPartial()).toBe(true);
    expect(page.warnings()).toContain(
      'Hay insumos sin costo unitario configurado; el costo de material es parcial.',
    );
  });

  it('shows the empty state when the product has no options', () => {
    const env = configure();
    env.productStub.getOptions.mockReturnValue(of([]));
    env.productStub.getCostBreakdown.mockReturnValue(
      of({ ...buildBreakdown(), options: [], projectedOptionCost: money('0'), projectedEffectiveCost: money('2000') }),
    );
    const fixture = mount();

    expect(fixture.componentInstance.optionGroups()).toEqual([]);
    expect(root(fixture).textContent).toContain('Sin opciones asociadas');
  });

  it('blocks saving duplicate ingredients with a clear message', () => {
    const fixture = mount(configure());
    const page = fixture.componentInstance;

    page.updateRecipeRows([createRecipeRow(301, '1'), createRecipeRow(301, '2')]);

    expect(page.canSave()).toBe(false);
    expect(page.formErrors()).toContain('Hay insumos repetidos en la receta.');
  });
});
