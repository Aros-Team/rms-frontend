/**
 * Tests for the PricingStep component (combo wizard step 3).
 *
 * Feature: Pricing form for combo products (base price, discount, final price).
 * Contract: Computes final price from base and discount, validates price constraints.
 * Approach: Mount component via TestBed with test host, set prices, assert calculations.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { WizardFormData, WizardStepId } from '@app/core/services/combos/combo-wizard-state';
import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';

import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';
import { PricingStep } from './pricing-step';
import pricingStepHtml from './pricing-step.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';

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
    await resolveUiResources({
      'pricing-step.html': pricingStepHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
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
    it('normalizes MoneyDto product prices so totalCost stays exact (regression)', () => {
      // Wire shape: `basePrice` is `{ amount: "15000.00", currency: "COP" }`.
      // Reducing the raw objects used to produce NaN.
      mockProducts.push(
        { id: 200, name: 'Costo A', basePrice: { amount: '15000.00', currency: 'COP' }, active: true, categoryId: 1, categoryName: 'Bebidas', areaId: 1, areaName: 'Cocina', recipe: [] },
        { id: 201, name: 'Costo B', basePrice: { amount: '10000.00', currency: 'COP' }, active: true, categoryId: 1, categoryName: 'Bebidas', areaId: 1, areaName: 'Cocina', recipe: [] },
      );
      createComponent({
        ...emptyFormData(),
        groups: [
          { id: 9, categoryId: 1, displayOrder: 0, required: true, minSelections: 1, maxSelections: 1, productIds: [200, 201] },
        ],
      });
      fixture.detectChanges();

      expect(component.groupCosts()[0]?.avgPrice).toBe(12500);
      expect(component.groupCosts()[0]?.subtotal).toBe(12500);
      expect(component.totalCost()).toBe(12500);
      expect(Number.isNaN(component.totalCost())).toBe(false);
      expect(component.suggestedRetailPrice()).toBeCloseTo(11250);

      mockProducts.length = 3;
    });

    it('renders cost breakdown with selected products', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      const native = getNative();
      const rows = Array.from(native.querySelectorAll('[data-testid="cost-product-row"]'));
      expect(rows.length).toBe(3);
      expect(rows.map((row) => row.querySelector('span')?.textContent.trim())).toEqual([
        'Producto A',
        'Producto B',
        'Producto C',
      ]);
      // Prices go through the `money` pipe (COP: no decimals).
      expect(rows.map((row) => row.querySelectorAll('span')[1].textContent.trim())).toEqual([
        '$\u00A011',
        '$\u00A015',
        '$\u00A020',
      ]);
    });

    it('displays total cost with customer selection count', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      const native = getNative();
      const totalCost = native.querySelector('[data-testid="total-cost"]');
      expect(totalCost?.querySelector('span.text-base')?.textContent.trim()).toBe(
        'Costo total: $\u00A086',
      );
      expect(totalCost?.querySelector('span.text-sm')?.textContent.trim()).toBe('(5 selecciones)');
    });

    it('total cost is avg × maxSelections per group', () => {
      createComponent(formDataWithGroups());
      fixture.detectChanges();

      expect(component.groupCosts()[0]?.subtotal).toBeCloseTo(25.5);   // (10.5+15)/2 × 2
      expect(component.groupCosts()[1]?.subtotal).toBeCloseTo(60);     // 20 × 3
      expect(component.totalCost()).toBeCloseTo(85.5);

      const subtotals = Array.from(
        getNative().querySelectorAll('[data-testid="group-subtotal"]'),
      ).map((row) => row.querySelectorAll('span')[1].textContent.trim());
      expect(subtotals).toEqual(['$\u00A026', '$\u00A060']);
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
      // avg = 10.5 / 1 = 10.5, × maxSelections=2 = 21 → COP renders 0 decimals
      expect(native.querySelector('[data-testid="total-cost"] span.text-base')?.textContent.trim())
        .toBe('Costo total: $\u00A021');
    });

    it('shows empty message when no groups', () => {
      createComponent();
      fixture.detectChanges();

      const empty = getNative().querySelector('p.text-sm.text-muted');
      expect(empty?.textContent.trim()).toBe('No hay grupos seleccionados para calcular costos.');
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

      const host = getNative().querySelector('[data-testid="final-price-input"]');
      // `mode="currency"` is what makes the control format in COP.
      expect(host?.getAttribute('mode')).toBe('currency');
      const input = host?.querySelector<HTMLInputElement>('input');
      // The input id matches the <label for="finalPrice"> in the template.
      expect(input?.id).toBe('finalPrice');
      expect(input?.getAttribute('inputmode')).toBe('decimal');
      expect(getNative().querySelector('label[for="finalPrice"]')?.textContent.trim()).toBe(
        'Precio final',
      );
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

      const section = getNative().querySelector('[data-testid="suggested-price-section"]');
      expect(section?.querySelector('[data-testid="suggested-price-value"]')?.textContent.trim())
        .toBe('$\u00A077');
      expect(section?.querySelector('[data-testid="apply-suggested-price-btn"]')?.textContent.trim())
        .toBe('Usar como precio final');
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
      // 85.5 × 0.9 = 76.95 → COP rounds to the whole peso
      expect(priceValue?.textContent.trim()).toBe('$\u00A077');
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
      expect(el?.getAttribute('role')).toBe('group');
      const toggles = Array.from(el?.querySelectorAll('p-togglebutton') ?? []);
      expect(toggles.length).toBe(2);
      expect(toggles.map((t) => t.querySelector('.p-togglebutton-label')?.textContent.trim()))
        .toEqual(['Sí', 'No']);
      expect(toggles.map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
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
