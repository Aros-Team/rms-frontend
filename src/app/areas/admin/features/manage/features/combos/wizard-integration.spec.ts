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
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState, type WizardFormData } from '@app/core/services/combos/combo-wizard-state';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { SELECTION_TYPE } from '@app/shared/models/dto/special-selections/selection-type';

import { ComboWizard } from './combo-wizard';
import { canAdvanceFromGroups, validateAllGroups } from './group-validation';
import comboWizardHtml from './combo-wizard.html?raw';

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

function makeProduct(id: number, name: string, basePrice: number, categoryId: number): ProductResponse {
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
      { provide: SpecialSelectionsCacheService, useValue: specialSelectionsCacheStub() },
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
      { provide: SpecialSelectionsCacheService, useValue: specialSelectionsCacheStub() },
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

      expect(root.querySelector('[data-testid="step-general"]')).toBeTruthy();
      expect(root.querySelector('[data-testid="step-category"]')).toBeNull();
      expect(root.querySelector('[data-testid="step-questions"]')).toBeNull();
      expect(root.querySelector('[data-testid="step-pricing"]')).toBeNull();

      state.markStepCompleted('general');
      host.fixture.detectChanges();
      state.setCurrentStep('questions');
      host.fixture.detectChanges();

      expect(root.querySelector('[data-testid="step-general"]')).toBeNull();
      expect(root.querySelector('[data-testid="step-questions"]')).toBeTruthy();

      state.markStepCompleted('questions');
      state.setCurrentStep('pricing');
      host.fixture.detectChanges();

      expect(root.querySelector('[data-testid="step-pricing"]')).toBeTruthy();
    });

    it('renders category slot inside the correct per-category pane', async () => {
      const host = await setupHostTestBed(HostAllSteps);
      const state = TestBed.inject(ComboWizardState);
      state.updateSelectedCategoryIds([1, 2]);
      host.fixture.detectChanges();
      state.setCurrentStep('category:1');
      host.fixture.detectChanges();

      const root = host.fixture.nativeElement as HTMLElement;
      expect(root.querySelector('[data-testid="step-category"]')).toBeTruthy();

      const pane = root.querySelector('[data-step-pane="category:1"]');
      expect(pane).toBeTruthy();
      expect(pane?.querySelector('[data-testid="step-category"]')).toBeTruthy();
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
      expect(errors.some((e) => e.type === 'MIN_NOT_MET')).toBe(true);
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
    it('sums base prices of all selected products across groups', () => {
      const groups = [
        { categoryId: 1, productIds: [10, 11] }, // 100 + 200
        { categoryId: 2, productIds: [12] },       // 300
      ];
      let total = 0;
      let count = 0;
      for (const g of groups) {
        for (const pid of g.productIds) {
          const p = TEST_PRODUCTS.find((x) => x.id === pid);
          if (p) { total += p.basePrice; count++; }
        }
      }
      expect(total).toBe(600);
      expect(count).toBe(3);
    });

    it('returns 0 for empty groups', () => {
      let total = 0;
      for (const g of [] as { productIds: number[] }[]) {
        for (const pid of g.productIds) {
          const p = TEST_PRODUCTS.find((x) => x.id === pid);
          if (p) total += p.basePrice;
        }
      }
      expect(total).toBe(0);
    });

    it('skips empty productIds within a group', () => {
      const groups = [
        { productIds: [] },
        { productIds: [12] },
      ];
      let total = 0;
      for (const g of groups) {
        for (const pid of g.productIds) {
          const p = TEST_PRODUCTS.find((x) => x.id === pid);
          if (p) total += p.basePrice;
        }
      }
      expect(total).toBe(300);
    });

    it('resolves product prices from reference cache', () => {
      const ref = buildReferenceStub(TEST_CATEGORIES, TEST_PRODUCTS);
      expect(ref.productById(10)?.basePrice).toBe(100);
      expect(ref.productById(999)).toBeUndefined();
    });
  });
});
