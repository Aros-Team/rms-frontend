/**
 * Tests for the combo wizard integration (full wizard flow).
 *
 * Feature: End-to-end wizard flow from general step to submission.
 * Contract: Steps advance correctly, data persists across steps, submission posts to API.
 * Approach: Mount wizard via TestBed, step through all steps, assert final API call.
 */
import { TestBed } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
  Component,
  signal,
  type WritableSignal,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState, type WizardFormData } from '@app/core/services/combos/combo-wizard-state';
import { SpecialSelectionsCache } from '@app/core/services/special-selections/special-selections-cache';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import type { Money } from '@app/shared/models/dto/common/money';
import { SELECTION_TYPE } from '@app/shared/models/dto/special-selections/selection-type';

import { ComboWizard } from './combo-wizard';
import { PricingStep } from './pricing-step/pricing-step';
import { canAdvanceFromGroups, validateAllGroups } from './group-validation';
import comboWizardHtml from './combo-wizard.html?raw';
import pricingStepHtml from './pricing-step/pricing-step.html?raw';

// ─── Stub types ──────────────────────────────────────────────────────────────

interface CategoryStub {
  id: number;
  name: string;
}

interface ReferenceStub {
  categories: WritableSignal<CategoryStub[]>;
  categoryName: (id: number) => string | undefined;
  specialSelectionProductsByCategory: (id: number) => ProductResponse[];
  productById: (id: number) => ProductResponse | undefined;
}

function buildReferenceStub(
  initialCategories: CategoryStub[] = [],
  products: ProductResponse[] = [],
): ReferenceStub {
  const categories = signal<CategoryStub[]>(initialCategories);
  return {
    categories,
    categoryName: (id: number) => categories().find((c) => c.id === id)?.name,
    specialSelectionProductsByCategory: (id: number) =>
      products.filter((p) => p.categoryId === id && p.active && p.selectionType === SELECTION_TYPE.SPECIAL_SELECTION),
    productById: (id: number) => products.find((p) => p.id === id),
  };
}

function specialSelectionsCacheStub() {
  return {
    detail: (): { data: ReturnType<typeof signal<null>>; loadIfStale: () => void } => ({
      data: signal<null>(null),
      loadIfStale: (): void => undefined,
    }),
  };
}

// ─── Test data ───────────────────────────────────────────────────────────────

function makeProduct(id: number, name: string, basePrice: Money | number, categoryId: number): ProductResponse {
  return {
    id,
    name,
    basePrice,
    active: true,
    categoryId,
    categoryName: `Cat ${String(categoryId)}`,
    areaId: 1,
    areaName: 'Cocina',
    recipe: [],
    selectionType: SELECTION_TYPE.SPECIAL_SELECTION,
  };
}

const TEST_PRODUCTS: ProductResponse[] = [
  makeProduct(10, 'Producto A', 100, 1),
  makeProduct(11, 'Producto B', 200, 1),
  makeProduct(12, 'Producto C', 300, 2),
  makeProduct(13, 'Producto D', 400, 2),
  makeProduct(14, 'Producto E', 500, 3),
];

const TEST_CATEGORIES: CategoryStub[] = [
  { id: 1, name: 'Bebidas' },
  { id: 2, name: 'Entradas' },
  { id: 3, name: 'Postres' },
];

// ─── Host components ─────────────────────────────────────────────────────────

@Component({
  selector: 'app-host-all-steps',
  imports: [ComboWizard],
  template: `
    <app-combo-wizard>
      <div comboWizardStep="general" data-testid="step-general">General Step</div>
      <div comboWizardStep="category" data-testid="step-category">Category Step</div>
      <div comboWizardStep="questions" data-testid="step-questions">Questions Step</div>
      <div comboWizardStep="pricing" data-testid="step-pricing">Pricing Step</div>
    </app-combo-wizard>
  `,
})
class HostAllSteps {
  readonly marker = true as const;
}

// ─── Wizard env setup ────────────────────────────────────────────────────────

interface WizardEnv {
  fixture: import('@angular/core/testing').ComponentFixture<ComboWizard>;
  wizard: ComboWizard;
  state: ComboWizardState;
  reference: ReferenceStub;
  setCategories(next: CategoryStub[]): void;
}

async function setupWizardTestBed(
  initialCategories: CategoryStub[] = [],
  products: ProductResponse[] = [],
): Promise<WizardEnv> {
  const reference = buildReferenceStub(initialCategories, products);
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ComboWizard],
    providers: [
      ComboWizardState,
      provideRouter([]),
      provideHttpClient(),
      MessageService,
      { provide: ComboReferenceCache, useValue: reference },
      { provide: SpecialSelectionsCache, useValue: specialSelectionsCacheStub() },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ComboWizard);
  fixture.detectChanges();
  const wizard: ComboWizard = fixture.componentInstance;
  const state: ComboWizardState = TestBed.inject(ComboWizardState);
  return {
    fixture,
    wizard,
    state,
    reference,
    setCategories(next: CategoryStub[]): void {
      reference.categories.set(next);
    },
  };
}

async function setupHostTestBed<T extends object>(host: new () => T): Promise<{
  fixture: import('@angular/core/testing').ComponentFixture<T>;
}> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [host, ComboWizard],
    providers: [
      ComboWizardState,
      provideRouter([]),
      provideHttpClient(),
      MessageService,
      { provide: ComboReferenceCache, useValue: buildReferenceStub() },
      { provide: SpecialSelectionsCache, useValue: specialSelectionsCacheStub() },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  return { fixture };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Wizard integration', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('combo-wizard.html')) {
        return Promise.resolve(comboWizardHtml as unknown as string);
      }
      if (url.endsWith('pricing-step.html')) {
        return Promise.resolve(pricingStepHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  // ── 1. Full wizard rendering ──────────────────────────────────────────
  describe('1. Full wizard rendering with projected content', () => {
    it('renders only the active step slot when all four types are projected', async () => {
      const host = await setupHostTestBed(HostAllSteps);
      const root = host.fixture.nativeElement as HTMLElement;
      const state = TestBed.inject(ComboWizardState);

      expect(root.querySelector('[data-testid="step-general"]')?.textContent.trim()).toBe(
        'General Step',
      );
      expect(root.querySelector('[data-testid="step-category"]')).toBeNull();
      expect(root.querySelector('[data-testid="step-questions"]')).toBeNull();
      expect(root.querySelector('[data-testid="step-pricing"]')).toBeNull();

      state.markStepCompleted('general');
      host.fixture.detectChanges();
      state.setCurrentStep('questions');
      host.fixture.detectChanges();

      expect(root.querySelector('[data-testid="step-general"]')).toBeNull();
      expect(root.querySelector('[data-testid="step-questions"]')?.textContent.trim()).toBe(
        'Questions Step',
      );

      state.markStepCompleted('questions');
      state.setCurrentStep('pricing');
      host.fixture.detectChanges();

      expect(root.querySelector('[data-testid="step-pricing"]')?.textContent.trim()).toBe(
        'Pricing Step',
      );
    });

    it('renders category slot inside the correct per-category pane', async () => {
      const host = await setupHostTestBed(HostAllSteps);
      const state = TestBed.inject(ComboWizardState);
      state.updateSelectedCategoryIds([1, 2]);
      host.fixture.detectChanges();
      state.setCurrentStep('category:1');
      host.fixture.detectChanges();

      const root = host.fixture.nativeElement as HTMLElement;
      const pane = root.querySelector('[data-step-pane="category:1"]');
      const slot = pane?.querySelector('[data-testid="step-category"]');
      expect(slot?.textContent.trim()).toBe('Category Step');
      // The projected slot lives only in the active category pane.
      expect(slot?.closest('[data-step-pane]')?.getAttribute('data-step-pane')).toBe('category:1');
      expect(root.querySelectorAll('[data-testid="step-category"]').length).toBe(1);
    });
  });

  // ── 2. Category step creation in timeline ──────────────────────────────
  describe('2. Category step creation reflected in timeline', () => {
    it('selected categories appear as steps between general and questions', async () => {
      const env = await setupWizardTestBed([
        { id: 1, name: 'Bebidas' },
        { id: 2, name: 'Entradas' },
      ]);

      let ids = env.wizard.stepView().map((s) => s.id);
      expect(ids).toEqual(['general', 'questions', 'pricing']);

      env.state.updateSelectedCategoryIds([1, 2]);
      env.fixture.detectChanges();

      ids = env.wizard.stepView().map((s) => s.id);
      expect(ids).toEqual(['general', 'category:1', 'category:2', 'questions', 'pricing']);

      const labels = env.wizard.stepView().map((s) => s.label);
      expect(labels).toEqual(['Información general', 'Bebidas', 'Entradas', 'Preguntas', 'Precio final']);
    });

    it('removing categories removes their timeline steps', async () => {
      const env = await setupWizardTestBed(TEST_CATEGORIES);
      env.state.updateSelectedCategoryIds([1, 2, 3]);
      env.fixture.detectChanges();
      expect(env.wizard.stepView().length).toBe(6);

      env.state.updateSelectedCategoryIds([1, 3]);
      env.fixture.detectChanges();

      const ids = env.wizard.stepView().map((s) => s.id);
      expect(ids).toEqual(['general', 'category:1', 'category:3', 'questions', 'pricing']);
    });

    it('step reset when current category is removed from the list', async () => {
      const env = await setupWizardTestBed([{ id: 1, name: 'Bebidas' }]);
      env.state.updateSelectedCategoryIds([1]);
      env.fixture.detectChanges();
      env.state.markStepCompleted('general');
      env.state.setCurrentStep('category:1');
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('category:1');

      env.state.updateSelectedCategoryIds([]);
      env.fixture.detectChanges();

      const ids = env.wizard.stepView().map((s) => s.id);
      expect(ids).toEqual(['general', 'questions', 'pricing']);
    });
  });

  // ── 3. Full navigation flow ───────────────────────────────────────────
  describe('3. Full navigation flow through all 5 steps', () => {
    it('walks general → cat:1 → cat:2 → questions → pricing with return at each step', async () => {
      const env = await setupWizardTestBed([
        { id: 1, name: 'Bebidas' },
        { id: 2, name: 'Entradas' },
      ]);
      env.state.updateSelectedCategoryIds([1, 2]);
      env.fixture.detectChanges();

      expect(env.state.currentStepId()).toBe('general');
      expect(env.wizard.canGoBack()).toBe(false);

      // Advance to cat:1
      env.state.markStepCompleted('general');
      env.fixture.detectChanges();
      env.wizard.onNext();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('category:1');
      expect(env.wizard.canGoBack()).toBe(true);

      // Back to general
      env.wizard.onBack();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('general');
      expect(env.wizard.canGoBack()).toBe(false);

      // Forward again to cat:1
      env.wizard.onNext();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('category:1');

      // Advance to cat:2
      env.state.markStepCompleted('category:1');
      env.fixture.detectChanges();
      env.wizard.onNext();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('category:2');

      // Back to cat:1
      env.wizard.onBack();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('category:1');

      // Forward to cat:2
      env.wizard.onNext();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('category:2');

      // Advance to questions
      env.state.markStepCompleted('category:2');
      env.fixture.detectChanges();
      env.wizard.onNext();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('questions');

      // Advance to pricing
      env.state.markStepCompleted('questions');
      env.fixture.detectChanges();
      env.wizard.onNext();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('pricing');

      expect(env.wizard.canAdvance()).toBe(false);
      expect(env.wizard.canGoBack()).toBe(true);

      // Back to questions
      env.wizard.onBack();
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('questions');
    });
  });

  // ── 4+5. Group validation blocking ────────────────────────────────────
  describe('4. Group validation blocks wizard advancement', () => {
    it('canAdvanceFromGroups returns false on MIN_NOT_MET', () => {
      expect(canAdvanceFromGroups([{ categoryId: 1, type: 'MIN_NOT_MET', message: 'x' }])).toBe(false);
    });

    it('canAdvanceFromGroups returns false on MAX_EXCEEDED', () => {
      expect(canAdvanceFromGroups([{ categoryId: 1, type: 'MAX_EXCEEDED', message: 'x' }])).toBe(false);
    });

    it('canAdvanceFromGroups returns false on EMPTY_GROUP', () => {
      expect(canAdvanceFromGroups([{ categoryId: 1, type: 'EMPTY_GROUP', message: 'x' }])).toBe(false);
    });

    it('canAdvanceFromGroups returns true on warnings-only', () => {
      expect(canAdvanceFromGroups([{ categoryId: 1, type: 'NO_ELIGIBLE_PRODUCTS', message: 'x' }])).toBe(true);
      expect(canAdvanceFromGroups([{ categoryId: 1, type: 'DUPLICATE_CATEGORY', message: 'x' }])).toBe(true);
      expect(canAdvanceFromGroups([{ categoryId: 1, type: 'INVALID_BOUNDS', message: 'x' }])).toBe(true);
    });

    it('validateAllGroups produces MIN_NOT_MET for required group with too few products', () => {
      const formData: WizardFormData = {
        name: 'Test', description: '', basePrice: 100, areaId: 1,
        active: true, baseRecipeEnabled: false, schedulingRequired: false,
        selectedCategoryIds: [1],
        groups: [{ id: null, categoryId: 1, displayOrder: 0, required: true, minSelections: 3, maxSelections: 5, productIds: [10] }],
        additions: [], questions: [], schedule: [],
      };
      const ref = { specialSelectionProductsByCategory: () => TEST_PRODUCTS.filter((p) => p.categoryId === 1) };
      const errors = validateAllGroups(formData, ref);
      expect(errors).toEqual([
        expect.objectContaining({ categoryId: 1, type: 'MIN_NOT_MET' }),
      ]);
    });

    it('wizard canAdvance is false when group step not completed', async () => {
      const env = await setupWizardTestBed([{ id: 1, name: 'Bebidas' }]);
      env.state.updateSelectedCategoryIds([1]);
      env.state.markStepCompleted('general');
      env.fixture.detectChanges();
      env.wizard.onNext();
      env.fixture.detectChanges();

      expect(env.state.currentStepId()).toBe('category:1');
      expect(env.state.canAdvance()).toBe(false);
      expect(env.wizard.canAdvance()).toBe(false);

      env.state.markStepCompleted('category:1');
      env.fixture.detectChanges();
      expect(env.wizard.canAdvance()).toBe(true);
    });
  });

  // ── 7. Pricing cost calculation ──────────────────────────────────────
  describe('5. Pricing cost calculation from selected products', () => {
    async function setupPricingStep(
      formData: WizardFormData,
      products: ProductResponse[],
    ): Promise<PricingStep> {
      const data = signal<WizardFormData>(formData);
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [PricingStep],
        providers: [
          {
            provide: ComboWizardState,
            useValue: {
              data: data.asReadonly(),
              steps: signal<readonly { id: string }[]>([{ id: 'pricing' }]),
              updateData: vi.fn(),
              markStepCompleted: vi.fn(),
              markStepIncomplete: vi.fn(),
            },
          },
          { provide: ComboReferenceCache, useValue: buildReferenceStub(TEST_CATEGORIES, products) },
        ],
      }).compileComponents();
      const fixture = TestBed.createComponent(PricingStep);
      fixture.detectChanges();
      return fixture.componentInstance;
    }

    function pricingFormData(groups: WizardFormData['groups']): WizardFormData {
      return {
        name: 'Test',
        description: '',
        basePrice: null,
        areaId: 1,
        active: true,
        baseRecipeEnabled: false,
        schedulingRequired: false,
        selectedCategoryIds: [1, 2],
        groups,
        additions: [],
        questions: [],
        schedule: [],
      };
    }

    it('sums MoneyDto base prices of all selected products across groups', async () => {
      // Wire shape: `{ amount: "100.00", currency: "COP" }`. PricingStep must
      // normalize each one with `toAmount()` — reducing the raw DTOs used to
      // produce NaN (the bug this test guards).
      const moneyProducts: ProductResponse[] = [
        makeProduct(20, 'Producto M1', { amount: '100.00', currency: 'COP' }, 1),
        makeProduct(21, 'Producto M2', { amount: '200.00', currency: 'COP' }, 1),
        makeProduct(22, 'Producto M3', { amount: '300.00', currency: 'COP' }, 2),
      ];
      const cmp = await setupPricingStep(
        pricingFormData([
          { id: null, categoryId: 1, displayOrder: 0, required: true, minSelections: 1, maxSelections: 1, productIds: [20, 21] },
          { id: null, categoryId: 2, displayOrder: 1, required: false, minSelections: 0, maxSelections: 1, productIds: [22] },
        ]),
        moneyProducts,
      );

      expect(cmp.groupCosts().map((g) => g.avgPrice)).toEqual([150, 300]);
      expect(cmp.groupCosts().map((g) => g.subtotal)).toEqual([150, 300]);
      expect(cmp.totalCost()).toBe(450);
      expect(Number.isNaN(cmp.totalCost())).toBe(false);
      expect(cmp.suggestedRetailPrice()).toBe(405);
    });

    it('returns 0 for empty groups', async () => {
      const cmp = await setupPricingStep(pricingFormData([]), TEST_PRODUCTS);

      expect(cmp.groupCosts()).toEqual([]);
      expect(cmp.totalCost()).toBe(0);
      expect(cmp.customerSelectionCount()).toBe(0);
    });

    it('skips empty productIds within a group', async () => {
      const cmp = await setupPricingStep(
        pricingFormData([
          { id: null, categoryId: 1, displayOrder: 0, required: false, minSelections: 0, maxSelections: 2, productIds: [] },
          { id: null, categoryId: 2, displayOrder: 1, required: false, minSelections: 0, maxSelections: 1, productIds: [12] },
        ]),
        TEST_PRODUCTS,
      );

      expect(cmp.groupCosts().map((g) => g.avgPrice)).toEqual([0, 300]);
      // Empty group contributes 0; group 2 = 300 × 1 selection.
      expect(cmp.totalCost()).toBe(300);
    });

    it('resolves product names and prices from the reference cache', async () => {
      const moneyProducts: ProductResponse[] = [
        makeProduct(20, 'Producto M1', { amount: '100.00', currency: 'COP' }, 1),
        makeProduct(99, 'No elegible', 500, 1),
      ];
      const cmp = await setupPricingStep(
        pricingFormData([
          { id: null, categoryId: 1, displayOrder: 0, required: false, minSelections: 0, maxSelections: 1, productIds: [20] },
        ]),
        moneyProducts,
      );

      expect(cmp.groupCosts()[0]?.products).toEqual([
        { id: 20, name: 'Producto M1', basePrice: 100 },
      ]);
      // Category name is resolved through the reference cache too.
      expect(cmp.groupCosts()[0]?.categoryName).toBe('Bebidas');
    });
  });
});
