import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
  signal,
  type WritableSignal,
} from '@angular/core';
import { beforeAll, describe, expect, it } from 'vitest';

import type { WizardFormData, WizardGroupDraft } from '@app/core/services/combos/combo-wizard-state';
import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';

import { GroupStep } from './group-step';
import groupStepHtml from './group-step.html?raw';

// ── Test data ───────────────────────────────────────────────────────────

const TEST_CATEGORY_ID = 7;

const MOCK_PRODUCTS: ProductResponse[] = [
  { id: 1, name: 'Hamburguesa', basePrice: 15000, active: true, categoryId: TEST_CATEGORY_ID, categoryName: 'Comidas', areaId: 1, areaName: 'Cocina', recipe: [] },
  { id: 2, name: 'Papas fritas', basePrice: 8000, active: true, categoryId: TEST_CATEGORY_ID, categoryName: 'Comidas', areaId: 1, areaName: 'Cocina', recipe: [] },
  { id: 3, name: 'Gaseosa', basePrice: 5000, active: true, categoryId: TEST_CATEGORY_ID, categoryName: 'Comidas', areaId: 1, areaName: 'Cocina', recipe: [] },
  { id: 4, name: 'Inactivo', basePrice: 10000, active: false, categoryId: TEST_CATEGORY_ID, categoryName: 'Comidas', areaId: 1, areaName: 'Cocina', recipe: [] },
];

const MOCK_CATEGORY_NAME = 'Comidas';

function emptyFormData(): WizardFormData {
  return {
    name: '',
    description: '',
    basePrice: null,
    areaId: null,
    active: true,
    baseRecipeEnabled: false,
    schedulingRequired: false,
    selectedCategoryIds: [TEST_CATEGORY_ID],
    groups: [],
    additions: [],
    questions: [],
    schedule: [],
  };
}

function mockGroup(overrides?: Partial<WizardGroupDraft>): WizardGroupDraft {
  return {
    id: null,
    categoryId: TEST_CATEGORY_ID,
    displayOrder: 0,
    required: true,
    minSelections: 1,
    maxSelections: 3,
    productIds: [],
    ...overrides,
  };
}

// ── Mocks ───────────────────────────────────────────────────────────────

interface WizardMock {
  data: WritableSignal<WizardFormData>;
  updateData: ReturnType<typeof vi.fn>;
  updateSelectedCategoryIds: ReturnType<typeof vi.fn>;
  updateGroups: ReturnType<typeof vi.fn>;
  updateSchedule: ReturnType<typeof vi.fn>;
  markStepCompleted: ReturnType<typeof vi.fn>;
  markStepIncomplete: ReturnType<typeof vi.fn>;
  isStepCompleted: ReturnType<typeof vi.fn>;
}

function buildWizardMock(initial?: Partial<WizardFormData>): WizardMock {
  const data = signal<WizardFormData>({ ...emptyFormData(), ...initial });
  return {
    data,
    updateData: vi.fn((partial: Partial<WizardFormData>) => {
      data.update((d) => ({ ...d, ...partial }));
    }),
    updateSelectedCategoryIds: vi.fn((ids: readonly number[]) => {
      data.update((d) => ({ ...d, selectedCategoryIds: [...ids] }));
    }),
    updateGroups: vi.fn((groups: WizardGroupDraft[]) => {
      data.update((d) => ({ ...d, groups }));
    }),
    updateSchedule: vi.fn(),
    markStepCompleted: vi.fn(),
    markStepIncomplete: vi.fn(),
    isStepCompleted: vi.fn().mockReturnValue(false),
  };
}

interface ReferenceMock {
  categories: WritableSignal<[]>;
  products: WritableSignal<ProductResponse[]>;
  isLoading: WritableSignal<boolean>;
  loadIfStale: ReturnType<typeof vi.fn>;
  categoryName: ReturnType<typeof vi.fn>;
  categoryById: ReturnType<typeof vi.fn>;
  specialSelectionProductsByCategory: ReturnType<typeof vi.fn>;
}

function buildReferenceMock(): ReferenceMock {
  const products = signal<ProductResponse[]>(MOCK_PRODUCTS);
  return {
    categories: signal<[]>([]),
    products,
    isLoading: signal(false),
    loadIfStale: vi.fn(),
    categoryName: vi.fn((id: number) => (id === TEST_CATEGORY_ID ? MOCK_CATEGORY_NAME : undefined)),
    categoryById: vi.fn(),
    specialSelectionProductsByCategory: vi.fn((categoryId: number) =>
      MOCK_PRODUCTS.filter((p) => p.categoryId === categoryId),
    ),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('GroupStep', () => {
  let fixture: ComponentFixture<GroupStep>;
  let component: GroupStep;
  let wizardMock: WizardMock;
  let referenceMock: ReferenceMock;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('group-step.html')) {
        return Promise.resolve(groupStepHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  function createComponent(
    initialData?: Partial<WizardFormData>,
    categoryId: number = TEST_CATEGORY_ID,
  ): void {
    wizardMock = buildWizardMock(initialData);
    referenceMock = buildReferenceMock();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [GroupStep],
      providers: [
        { provide: ComboWizardState, useValue: wizardMock },
        { provide: ComboReferenceCache, useValue: referenceMock },
      ],
    });
    fixture = TestBed.createComponent(GroupStep);
    component = fixture.componentInstance;
    component.categoryId = categoryId;
    fixture.detectChanges();
  }

  function getNative(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  describe('rendering', () => {
    it('renders category name from reference cache', () => {
      createComponent({ groups: [mockGroup()] });
      fixture.detectChanges();

      const root = getNative();
      expect(root.textContent).toContain('Comidas');
    });

    it('renders product cards from specialSelectionProductsByCategory', () => {
      createComponent({ groups: [mockGroup()] });
      fixture.detectChanges();

      const cards = getNative().querySelectorAll('[data-testid="available-product"]');
      expect(cards.length).toBe(3);
    });

    it('does not show inactive products', () => {
      createComponent({ groups: [mockGroup()] });
      fixture.detectChanges();

      expect(getNative().textContent).not.toContain('Inactivo');
    });

    it('renders selected products with remove button', () => {
      createComponent({ groups: [mockGroup({ productIds: [1, 2] })] });
      fixture.detectChanges();

      const selected = getNative().querySelectorAll('[data-testid="selected-product"]');
      expect(selected.length).toBe(2);

      const removeBtns = getNative().querySelectorAll('[data-testid="remove-product-btn"]');
      expect(removeBtns.length).toBe(2);
    });

    it('shows min/max constraint text', () => {
      createComponent({ groups: [mockGroup({ minSelections: 1, maxSelections: 3 })] });
      fixture.detectChanges();

      expect(getNative().textContent).toContain('Selecciona mínimo 1, máximo 3');
    });

    it('shows required badge when group is required', () => {
      createComponent({ groups: [mockGroup({ required: true, minSelections: 1, maxSelections: 3 })] });
      fixture.detectChanges();

      expect(getNative().textContent).toContain('Obligatorio');
      expect(getNative().textContent).toContain('Mín 1');
      expect(getNative().textContent).toContain('Máx 3');
    });

    it('does not show required badge when group is not required', () => {
      createComponent({ groups: [mockGroup({ required: false })] });
      fixture.detectChanges();

      expect(getNative().textContent).not.toContain('Obligatorio');
    });

    it('shows selection count text', () => {
      createComponent({ groups: [mockGroup({ productIds: [1], maxSelections: 3 })] });
      fixture.detectChanges();

      const countEl = getNative().querySelector('[data-testid="selection-count"]');
      expect((countEl?.textContent ?? '').trim()).toContain('1 / 3 seleccionados');
    });

    it('shows empty search message when search has no results', () => {
      createComponent({ groups: [mockGroup()] });
      vi.useFakeTimers();
      component.onSearchInput('xyz_no_match');
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      vi.useRealTimers();

      const empty = getNative().querySelector('[data-testid="empty-search"]');
      expect(empty).toBeTruthy();
    });
  });

  describe('product selection', () => {
    it('clicking a product adds it to the group', () => {
      createComponent({ groups: [mockGroup()] });
      fixture.detectChanges();

      const product1 = MOCK_PRODUCTS[0];
      component.toggleProduct(product1);
      fixture.detectChanges();

      const updatedGroups = wizardMock.data().groups;
      const group = updatedGroups.find((g: WizardGroupDraft) => g.categoryId === TEST_CATEGORY_ID);
      expect(group?.productIds).toContain(1);
    });

    it('does not add beyond maxSelections', () => {
      createComponent({ groups: [mockGroup({ maxSelections: 1, productIds: [] })] });
      fixture.detectChanges();

      component.addProduct(1);
      component.addProduct(2);
      fixture.detectChanges();

      const group = wizardMock.data().groups.find((g: WizardGroupDraft) => g.categoryId === TEST_CATEGORY_ID);
      expect(group?.productIds.length).toBe(1);
    });

    it('removing a selected product removes it from the group', () => {
      createComponent({ groups: [mockGroup({ minSelections: 0, productIds: [1, 2] })] });
      fixture.detectChanges();

      component.removeProduct(1);
      fixture.detectChanges();

      const group = wizardMock.data().groups.find((g: WizardGroupDraft) => g.categoryId === TEST_CATEGORY_ID);
      expect(group?.productIds).toEqual([2]);
    });

    it('clicking a selected product removes it via toggle', () => {
      createComponent({ groups: [mockGroup({ minSelections: 0, productIds: [1] })] });
      fixture.detectChanges();

      const product1 = MOCK_PRODUCTS[0];
      component.toggleProduct(product1);
      fixture.detectChanges();

      const group = wizardMock.data().groups.find((g: WizardGroupDraft) => g.categoryId === TEST_CATEGORY_ID);
      expect(group?.productIds).toEqual([]);
    });

    it('shows warning when removing below minimum', () => {
      createComponent({ groups: [mockGroup({ minSelections: 2, maxSelections: 3, productIds: [1, 2] })] });
      fixture.detectChanges();

      component.removeProduct(1);
      component.removeProduct(2);
      fixture.detectChanges();

      const warning = getNative().querySelector('[data-testid="min-warning"]');
      expect(warning).toBeTruthy();
      expect(warning?.textContent).toContain('Debe seleccionar al menos 2 producto(s)');
    });

    it('does not remove product when it would violate minimum', () => {
      createComponent({ groups: [mockGroup({ minSelections: 2, productIds: [1, 2] })] });
      fixture.detectChanges();

      component.removeProduct(1);
      component.removeProduct(2);
      fixture.detectChanges();

      const group = wizardMock.data().groups.find((g: WizardGroupDraft) => g.categoryId === TEST_CATEGORY_ID);
      expect(group?.productIds.length).toBe(2);
    });

    it('clears min warning when a product is added', () => {
      createComponent({ groups: [mockGroup({ minSelections: 1, productIds: [1] })] });
      fixture.detectChanges();

      component.removeProduct(1);
      fixture.detectChanges();
      expect(getNative().querySelector('[data-testid="min-warning"]')).toBeTruthy();

      component.addProduct(2);
      fixture.detectChanges();
      expect(getNative().querySelector('[data-testid="min-warning"]')).toBeNull();
    });
  });

  describe('search filtering', () => {
    it('filters available products by name', () => {
      createComponent({ groups: [mockGroup()] });
      vi.useFakeTimers();
      component.onSearchInput('Hamburguesa');
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      vi.useRealTimers();

      expect(component.searchFilteredProducts().length).toBe(1);
      expect(component.searchFilteredProducts()[0]?.name).toBe('Hamburguesa');
    });

    it('search is case-insensitive', () => {
      createComponent({ groups: [mockGroup()] });
      vi.useFakeTimers();
      component.onSearchInput('hamburguesa');
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      vi.useRealTimers();

      expect(component.searchFilteredProducts().length).toBe(1);
    });

    it('shows all products when search query is empty', () => {
      createComponent({ groups: [mockGroup()] });
      fixture.detectChanges();

      expect(component.searchFilteredProducts().length).toBe(3);
    });
  });

  describe('step completion', () => {
    it('auto-completes when selected count >= minSelections', () => {
      createComponent({ groups: [mockGroup({ minSelections: 1 })] });
      fixture.detectChanges();

      component.addProduct(1);
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('category:7');
    });

    it('auto-incompletes when selected count < minSelections', () => {
      createComponent({ groups: [mockGroup({ minSelections: 2, productIds: [] })] });

      expect(wizardMock.markStepIncomplete).toHaveBeenCalledWith('category:7');
    });
  });

  describe('disabled state and max reached', () => {
    it('disables adding when maxSelections reached', () => {
      createComponent({ groups: [mockGroup({ maxSelections: 1, productIds: [1] })] });
      fixture.detectChanges();

      expect(component.canSelectMore()).toBe(false);
    });

    it('allows adding when under maxSelections', () => {
      createComponent({ groups: [mockGroup({ maxSelections: 3, productIds: [1] })] });
      fixture.detectChanges();

      expect(component.canSelectMore()).toBe(true);
    });

    it('blocks addProduct when max reached', () => {
      createComponent({ groups: [mockGroup({ maxSelections: 1, productIds: [1] })] });
      fixture.detectChanges();

      component.addProduct(2);
      fixture.detectChanges();

      const group = wizardMock.data().groups.find((g: WizardGroupDraft) => g.categoryId === TEST_CATEGORY_ID);
      expect(group?.productIds).toEqual([1]);
    });
  });

  describe('edge cases', () => {
    it('handles missing group gracefully', () => {
      createComponent();
      fixture.detectChanges();

      expect(component.currentGroup()).toBeUndefined();
      expect(component.selectedProductIds()).toEqual([]);
      expect(component.categoryName()).toBe('Comidas');
    });

    it('renders fallback category name when cache has no name', () => {
      createComponent(undefined, 99);

      const catName = component.categoryName();
      expect(catName).toBe('Categoría #99');
    });

    it('selectionCountText shows 0 / N for empty group', () => {
      createComponent({ groups: [mockGroup({ productIds: [], maxSelections: 3 })] });
      fixture.detectChanges();

      const text = component.selectionCountText();
      expect(text).toBe('0 / 3 seleccionados');
    });
  });
});
