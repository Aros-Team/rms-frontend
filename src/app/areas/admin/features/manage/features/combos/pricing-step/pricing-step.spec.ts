import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
  signal,
  type WritableSignal,
} from '@angular/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { WizardFormData, WizardStepId } from '@app/core/services/combos/combo-wizard-state';
import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';

import { PricingStep } from './pricing-step';
import pricingStepHtml from './pricing-step.html?raw';

function emptyFormData(): WizardFormData {
  return {
    name: '',
    description: '',
    basePrice: null,
    areaId: null,
    active: true,
    baseRecipeEnabled: false,
    schedulingRequired: false,
    selectedCategoryIds: [],
    groups: [],
    additions: [],
    questions: [],
    schedule: [],
  };
}

interface WizardMock {
  data: WritableSignal<WizardFormData>;
  steps: WritableSignal<readonly { id: WizardStepId }[]>;
  updateData: ReturnType<typeof vi.fn>;
  markStepCompleted: ReturnType<typeof vi.fn>;
  markStepIncomplete: ReturnType<typeof vi.fn>;
}

function buildWizardMock(
  initial?: Partial<WizardFormData>,
): WizardMock {
  const data = signal<WizardFormData>({ ...emptyFormData(), ...initial });
  const stepsSig = signal<readonly { id: WizardStepId }[]>([
    { id: 'general' },
    { id: 'pricing' },
  ]);
  return {
    data,
    steps: stepsSig,
    updateData: vi.fn((partial: Partial<WizardFormData>) => {
      data.update((d) => ({ ...d, ...partial }));
    }),
    markStepCompleted: vi.fn(),
    markStepIncomplete: vi.fn(),
  };
}

interface ReferenceMock {
  productById: ReturnType<typeof vi.fn>;
  categoryName: ReturnType<typeof vi.fn>;
  loadIfStale: ReturnType<typeof vi.fn>;
}

const mockProducts: ProductResponse[] = [
  { id: 100, name: 'Producto A', basePrice: 10.5, active: true, categoryId: 1, categoryName: 'Bebidas', areaId: 1, areaName: 'Cocina', recipe: [] },
  { id: 101, name: 'Producto B', basePrice: 15.0, active: true, categoryId: 1, categoryName: 'Bebidas', areaId: 1, areaName: 'Cocina', recipe: [] },
  { id: 102, name: 'Producto C', basePrice: 20.0, active: true, categoryId: 2, categoryName: 'Entradas', areaId: 1, areaName: 'Cocina', recipe: [] },
];

function buildReferenceMock(): ReferenceMock {
  return {
    productById: vi.fn((id: number) => mockProducts.find((p) => p.id === id) ?? undefined),
    categoryName: vi.fn((id: number | null) => {
      const map: Record<number, string> = { 1: 'Bebidas', 2: 'Entradas' };
      return id !== null ? (map[id] ?? `Categoría #${String(id)}`) : undefined;
    }),
    loadIfStale: vi.fn(),
  };
}

function formDataWithGroups(): WizardFormData {
  return {
    ...emptyFormData(),
    name: 'Combo Test',
    selectedCategoryIds: [1, 2],
    groups: [
      { id: 1, categoryId: 1, displayOrder: 0, required: true, minSelections: 1, maxSelections: 2, productIds: [100, 101] },
      { id: 2, categoryId: 2, displayOrder: 1, required: false, minSelections: 0, maxSelections: 3, productIds: [102] },
    ],
  };
}

describe('PricingStep', () => {
  let fixture: ComponentFixture<PricingStep>;
  let component: PricingStep;
  let wizardMock: WizardMock;
  let referenceMock: ReferenceMock;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('pricing-step.html')) {
        return Promise.resolve(pricingStepHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  function createComponent(
    initialData?: Partial<WizardFormData>,
  ): void {
    wizardMock = buildWizardMock(initialData);
    referenceMock = buildReferenceMock();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PricingStep],
      providers: [
        { provide: ComboWizardState, useValue: wizardMock },
        { provide: ComboReferenceCache, useValue: referenceMock },
      ],
    });
    fixture = TestBed.createComponent(PricingStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function getNative(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  describe('cost breakdown', () => {
    it('renders cost breakdown with selected products', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      const native = getNative();
      expect(native.querySelectorAll('[data-testid="cost-product-row"]').length).toBe(3);
      expect(native.textContent).toContain('Producto A');
      expect(native.textContent).toContain('Producto B');
      expect(native.textContent).toContain('Producto C');
    });

    it('displays total cost with customer selection count', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      const native = getNative();
      expect(native.querySelector('[data-testid="total-cost"]')).toBeTruthy();
      expect(native.textContent).toContain('Costo total');
      expect(native.textContent).toContain('5 selecciones');
    });

    it('total cost is avg × maxSelections per group', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      expect(component.groupCosts()[0]?.subtotal).toBeCloseTo(25.5);   // (10.5+15)/2 × 2
      expect(component.groupCosts()[1]?.subtotal).toBeCloseTo(60);     // 20 × 3
      expect(component.totalCost()).toBeCloseTo(85.5);
    });

    it('total cost updates when groups change', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      const formData = formDataWithGroups();
      const firstGroup = formData.groups[0];
      const updatedData: WizardFormData = {
        ...formData,
        groups: [
          { ...firstGroup, productIds: [100] },
        ],
      };
      wizardMock.data.set(updatedData);
      fixture.detectChanges();

      const native = getNative();
      // avg = 10.5 / 1 = 10.5, × maxSelections=2 = 21
      expect(native.textContent).toContain('21.00');
    });

    it('shows empty message when no groups', () => {
      createComponent();
      fixture.detectChanges();

      expect(getNative().textContent).toContain('No hay grupos seleccionados');
      expect(getNative().querySelector('[data-testid="total-cost"]')).toBeNull();
    });

    it('shows subtotal per group', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      const subtotals = getNative().querySelectorAll('[data-testid="group-subtotal"]');
      expect(subtotals.length).toBe(2);
    });
  });

  describe('manual price input', () => {
    it('renders final price input with currency mode', () => {
      createComponent({ basePrice: 25 });
      fixture.detectChanges();

      const input = getNative().querySelector('[data-testid="final-price-input"]');
      expect(input).toBeTruthy();
    });

    it('updates wizard state on price change', () => {
      createComponent({ basePrice: 10 });
      fixture.detectChanges();

      component.onBasePriceChange(35.99);
      fixture.detectChanges();

      expect(wizardMock.updateData).toHaveBeenCalledWith({ basePrice: 35.99 });
    });
  });

  describe('suggested retail price', () => {
    it('shows suggested price section when groups exist', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      expect(getNative().querySelector('[data-testid="suggested-price-section"]')).toBeTruthy();
    });

    it('hides suggested price section when no groups', () => {
      createComponent();
      fixture.detectChanges();

      expect(getNative().querySelector('[data-testid="suggested-price-section"]')).toBeNull();
    });

    it('suggestedRetailPrice is totalCost × 0.9', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      expect(component.suggestedRetailPrice()).toBeCloseTo(76.95); // 85.5 × 0.9
    });

    it('shows suggested price value in template', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      const priceValue = getNative().querySelector('[data-testid="suggested-price-value"]');
      expect(priceValue?.textContent).toContain('76.95');
    });

    it('applySuggestedPrice sets basePrice to suggested retail price', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      component.applySuggestedPrice();

      expect(wizardMock.updateData).toHaveBeenCalledWith({ basePrice: 76.95 });
    });
  });

  describe('active toggle', () => {
    it('renders active selectbutton', () => {
      createComponent();
      fixture.detectChanges();

      const el = getNative().querySelector('[data-testid="active-selectbutton"]');
      expect(el).toBeTruthy();
    });

    it('calls updateData on active change', () => {
      createComponent({ active: true });
      fixture.detectChanges();

      component.onActiveChange(false);
      fixture.detectChanges();

      expect(wizardMock.updateData).toHaveBeenCalledWith({ active: false });
    });
  });

  describe('step completion', () => {
    it('marks step completed on init', () => {
      createComponent({ basePrice: 10 });
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('pricing');
    });
  });
});
