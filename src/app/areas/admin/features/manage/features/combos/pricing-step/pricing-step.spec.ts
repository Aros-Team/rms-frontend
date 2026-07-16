import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
  signal,
  type WritableSignal,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { beforeAll, describe, expect, it } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import type { WizardFormData, WizardStepId } from '@app/core/services/combos/combo-wizard-state';
import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import type { SuggestedPriceResponse, SuggestedPriceBreakdownEntry } from '@app/shared/models/dto/special-selections/special-selection-suggested-price';

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
  sourceId: WritableSignal<number | null>;
  steps: WritableSignal<readonly { id: WizardStepId }[]>;
  updateData: ReturnType<typeof vi.fn>;
  markStepCompleted: ReturnType<typeof vi.fn>;
  markStepIncomplete: ReturnType<typeof vi.fn>;
}

function buildWizardMock(
  initial?: Partial<WizardFormData>,
  sourceId?: number | null,
): WizardMock {
  const data = signal<WizardFormData>({ ...emptyFormData(), ...initial });
  const sourceIdSig = signal<number | null>(sourceId ?? null);
  const stepsSig = signal<readonly { id: WizardStepId }[]>([
    { id: 'general' },
    { id: 'pricing' },
  ]);
  return {
    data,
    sourceId: sourceIdSig,
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

const mockBreakdown: SuggestedPriceBreakdownEntry[] = [
  { productId: 100, name: 'Producto A', cost: 10.5 },
  { productId: 101, name: 'Producto B', cost: 15.0 },
  { productId: 102, name: 'Producto C', cost: 20.0 },
];

const mockSuggestedPrice: SuggestedPriceResponse = {
  suggestedPrice: 59.15,
  totalCost: 45.5,
  marginPercent: 30,
  breakdown: mockBreakdown,
};

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

interface SpecialSelectionsMock {
  suggestPrice: ReturnType<typeof vi.fn>;
}

function buildSpecialSelectionsMock(): SpecialSelectionsMock {
  return {
    suggestPrice: vi.fn(),
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
  let specialSelectionsMock: SpecialSelectionsMock;

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
    sourceId?: number | null,
  ): void {
    wizardMock = buildWizardMock(initialData, sourceId);
    referenceMock = buildReferenceMock();
    specialSelectionsMock = buildSpecialSelectionsMock();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PricingStep],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: ComboWizardState, useValue: wizardMock },
        { provide: ComboReferenceCache, useValue: referenceMock },
        { provide: SpecialSelectionsCacheService, useValue: specialSelectionsMock },
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

    it('displays total cost with product count', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      const native = getNative();
      expect(native.querySelector('[data-testid="total-cost"]')).toBeTruthy();
      expect(native.textContent).toContain('Costo total');
      expect(native.textContent).toContain('3');
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
      expect(native.textContent).toContain('10.50');
      expect(native.textContent).toContain('1');
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

  describe('suggested price', () => {
    it('shows suggested price section only when sourceId is not null', () => {
      createComponent(formDataWithGroups(), null);
      fixture.detectChanges();

      expect(getNative().querySelector('[data-testid="suggested-price-section"]')).toBeNull();
    });

    it('shows suggested price section when sourceId exists', () => {
      createComponent(formDataWithGroups(), 42);
      fixture.detectChanges();

      expect(getNative().querySelector('[data-testid="suggested-price-section"]')).toBeTruthy();
    });

    it('renders margin input with default 30', () => {
      createComponent(formDataWithGroups(), 42);
      fixture.detectChanges();

      expect(component.margin()).toBe(30);
    });

    it('shows loading state during calculation', () => {
      createComponent(formDataWithGroups(), 42);
      fixture.detectChanges();

      specialSelectionsMock.suggestPrice.mockReturnValue(
        new Observable<SuggestedPriceResponse>(() => { /* never completes */ }),
      );
      component.calculatePrice();
      fixture.detectChanges();

      expect(getNative().querySelector('[data-testid="suggested-loading"]')).toBeTruthy();
    });

    it('displays suggested price result on success', () => {
      createComponent(formDataWithGroups(), 42);
      fixture.detectChanges();

      specialSelectionsMock.suggestPrice.mockReturnValue(of(mockSuggestedPrice));
      component.calculatePrice();
      fixture.detectChanges();

      const resultEl = getNative().querySelector('[data-testid="suggested-result"]');
      expect(resultEl).toBeTruthy();

      const priceValue = getNative().querySelector('[data-testid="suggested-price-value"]');
      expect(priceValue?.textContent).toContain('59.15');
    });

    it('displays error on HttpErrorResponse 422 with missingVariants', () => {
      createComponent(formDataWithGroups(), 42);
      fixture.detectChanges();

      const errorBody = { message: 'Faltan variantes', missingVariants: [100, 101] };
      const httpError = new HttpErrorResponse({
        status: 422,
        error: errorBody,
      });
      specialSelectionsMock.suggestPrice.mockReturnValue(throwError(() => httpError));
      component.calculatePrice();
      fixture.detectChanges();

      expect(getNative().querySelector('[data-testid="suggested-error"]')).toBeTruthy();
      expect(getNative().querySelector('[data-testid="missing-variants-error"]')).toBeTruthy();
      expect(getNative().textContent).toContain('Faltan variantes para los productos: 100, 101');
    });

    it('apply suggested price sets basePrice', () => {
      createComponent(formDataWithGroups(), 42);
      fixture.detectChanges();

      specialSelectionsMock.suggestPrice.mockReturnValue(of(mockSuggestedPrice));
      component.calculatePrice();

      expect(wizardMock.updateData).not.toHaveBeenCalledWith({ basePrice: 59.15 });

      component.applySuggestedPrice();

      expect(wizardMock.updateData).toHaveBeenCalledWith({ basePrice: 59.15 });
    });

    it('calculatePrice does nothing when sourceId is null', () => {
      createComponent(formDataWithGroups(), null);
      fixture.detectChanges();

      component.calculatePrice();

      expect(specialSelectionsMock.suggestPrice).not.toHaveBeenCalled();
    });

    it('shows breakdown entries in result', () => {
      createComponent(formDataWithGroups(), 42);
      fixture.detectChanges();

      specialSelectionsMock.suggestPrice.mockReturnValue(of(mockSuggestedPrice));
      component.calculatePrice();
      fixture.detectChanges();

      const native = getNative();
      expect(native.querySelectorAll('[data-testid="breakdown-entry"]').length).toBe(3);
      expect(native.textContent).toContain('Producto A');
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
      createComponent();
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('pricing');
    });
  });
});
