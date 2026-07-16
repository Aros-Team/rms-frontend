import { describe, expect, it } from 'vitest';

import type { WizardFormData, WizardGroupDraft } from '@app/core/services/combos/combo-wizard-state';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { SELECTION_TYPE } from '@app/shared/models/dto/special-selections/selection-type';

import {
  validateGroup,
  validateAllGroups,
  canAdvanceFromGroups,
  computeEligibleProducts,
  type GroupValidationError,
} from './group-validation';

function mockGroup(overrides?: Partial<WizardGroupDraft>): WizardGroupDraft {
  return {
    id: null,
    categoryId: 1,
    displayOrder: 0,
    required: true,
    minSelections: 1,
    maxSelections: 3,
    productIds: [],
    ...overrides,
  };
}

function mockProducts(): ProductResponse[] {
  return [
    {
      id: 10, name: 'Producto A', basePrice: 100, active: true,
      categoryId: 1, categoryName: 'Cat 1', areaId: 1, areaName: 'Area 1', recipe: [],
      selectionType: SELECTION_TYPE.SPECIAL_SELECTION,
    },
    {
      id: 11, name: 'Producto B', basePrice: 200, active: true,
      categoryId: 1, categoryName: 'Cat 1', areaId: 1, areaName: 'Area 1', recipe: [],
      selectionType: SELECTION_TYPE.SPECIAL_SELECTION,
    },
    {
      id: 12, name: 'Producto C', basePrice: 300, active: false,
      categoryId: 1, categoryName: 'Cat 1', areaId: 1, areaName: 'Area 1', recipe: [],
      selectionType: SELECTION_TYPE.SPECIAL_SELECTION,
    },
    {
      id: 13, name: 'Producto D', basePrice: 400, active: true,
      categoryId: 1, categoryName: 'Cat 1', areaId: 1, areaName: 'Area 1', recipe: [],
      selectionType: SELECTION_TYPE.STANDARD,
    },
    {
      id: 20, name: 'Producto E', basePrice: 500, active: true,
      categoryId: 2, categoryName: 'Cat 2', areaId: 1, areaName: 'Area 1', recipe: [],
      selectionType: SELECTION_TYPE.SPECIAL_SELECTION,
    },
  ];
}

function mockReference(products: ProductResponse[]) {
  return {
    specialSelectionProductsByCategory: (categoryId: number) =>
      products.filter(
        (p) => p.categoryId === categoryId && p.selectionType === SELECTION_TYPE.SPECIAL_SELECTION,
      ),
  };
}

function mockFormData(overrides?: Partial<WizardFormData>): WizardFormData {
  return {
    name: 'Test',
    description: '',
    basePrice: 100,
    areaId: 1,
    active: true,
    baseRecipeEnabled: false,
    schedulingRequired: false,
    selectedCategoryIds: [1],
    groups: [mockGroup()],
    additions: [],
    questions: [],
    schedule: [],
    ...overrides,
  };
}

describe('validateGroup', () => {
  it('returns null for a valid group', () => {
    const group = mockGroup({ categoryId: 1, minSelections: 1, maxSelections: 3, productIds: [10, 11] });
    const result = validateGroup(group, 2);
    expect(result).toBeNull();
  });

  it('returns NO_ELIGIBLE_PRODUCTS when eligibleProductCount is 0', () => {
    const group = mockGroup({ categoryId: 1, productIds: [10] });
    const result = validateGroup(group, 0);
    expect(result).toEqual<GroupValidationError>({
      categoryId: 1,
      type: 'NO_ELIGIBLE_PRODUCTS',
      message: expect.any(String) as string,
    });
  });

  it('returns INVALID_BOUNDS when minSelections > maxSelections', () => {
    const group = mockGroup({ minSelections: 5, maxSelections: 2, productIds: [10] });
    const result = validateGroup(group, 3);
    expect(result).toEqual<GroupValidationError>({
      categoryId: 1,
      type: 'INVALID_BOUNDS',
      message: expect.any(String) as string,
    });
  });

  it('returns INVALID_BOUNDS when minSelections < 0', () => {
    const group = mockGroup({ minSelections: -1, maxSelections: 3, productIds: [10] });
    const result = validateGroup(group, 3);
    expect(result).toEqual<GroupValidationError>({
      categoryId: 1,
      type: 'INVALID_BOUNDS',
      message: expect.any(String) as string,
    });
  });

  it('returns INVALID_BOUNDS when maxSelections < 1', () => {
    const group = mockGroup({ minSelections: 0, maxSelections: 0, productIds: [10] });
    const result = validateGroup(group, 3);
    expect(result).toEqual<GroupValidationError>({
      categoryId: 1,
      type: 'INVALID_BOUNDS',
      message: expect.any(String) as string,
    });
  });

  it('returns EMPTY_GROUP when required and no products selected', () => {
    const group = mockGroup({ required: true, minSelections: 1, maxSelections: 3, productIds: [] });
    const result = validateGroup(group, 3);
    expect(result).toEqual<GroupValidationError>({
      categoryId: 1,
      type: 'EMPTY_GROUP',
      message: expect.any(String) as string,
    });
  });

  it('returns MIN_NOT_MET when required and productIds < minSelections', () => {
    const group = mockGroup({ required: true, minSelections: 3, maxSelections: 5, productIds: [10] });
    const result = validateGroup(group, 4);
    expect(result).toEqual<GroupValidationError>({
      categoryId: 1,
      type: 'MIN_NOT_MET',
      message: expect.any(String) as string,
    });
  });

  it('does NOT return MIN_NOT_MET when not required even if under minSelections', () => {
    const group = mockGroup({ required: false, minSelections: 3, maxSelections: 5, productIds: [10] });
    const result = validateGroup(group, 4);
    expect(result).toBeNull();
  });

  it('returns MAX_EXCEEDED when productIds > maxSelections', () => {
    const group = mockGroup({ minSelections: 1, maxSelections: 2, productIds: [10, 11, 20] });
    const result = validateGroup(group, 4);
    expect(result).toEqual<GroupValidationError>({
      categoryId: 1,
      type: 'MAX_EXCEEDED',
      message: expect.any(String) as string,
    });
  });

  it('validates a non-required empty group as valid', () => {
    const group = mockGroup({ required: false, minSelections: 1, maxSelections: 3, productIds: [] });
    const result = validateGroup(group, 3);
    expect(result).toBeNull();
  });
});

describe('validateAllGroups', () => {
  it('returns no errors for valid groups', () => {
    const products = mockProducts();
    const ref = mockReference(products);
    const group = mockGroup({ categoryId: 1, productIds: [10, 11] });
    const formData = mockFormData({ groups: [group] });
    const errors = validateAllGroups(formData, ref);
    expect(errors).toHaveLength(0);
  });

  it('detects DUPLICATE_CATEGORY when two groups share the same categoryId', () => {
    const products = mockProducts();
    const ref = mockReference(products);
    const group1 = mockGroup({ categoryId: 1, productIds: [10] });
    const group2 = mockGroup({ categoryId: 1, productIds: [11] });
    const formData = mockFormData({ groups: [group1, group2] });
    const errors = validateAllGroups(formData, ref);
    const duplicateErrors = errors.filter((e) => e.type === 'DUPLICATE_CATEGORY');
    expect(duplicateErrors).toHaveLength(1);
    expect(duplicateErrors[0]?.categoryId).toBe(1);
  });

  it('skips groups with null categoryId', () => {
    const products = mockProducts();
    const ref = mockReference(products);
    const group = mockGroup({ categoryId: null, productIds: [10] });
    const formData = mockFormData({ groups: [group] });
    const errors = validateAllGroups(formData, ref);
    expect(errors).toHaveLength(0);
  });

  it('collects all validation errors across multiple groups', () => {
    const products = mockProducts();
    const ref = mockReference(products);
    const group1 = mockGroup({ categoryId: 1, required: true, minSelections: 1, maxSelections: 3, productIds: [] });
    const group2 = mockGroup({ categoryId: 2, required: true, minSelections: 1, maxSelections: 2, productIds: [10, 20, 30] });
    const formData = mockFormData({ groups: [group1, group2] });
    const errors = validateAllGroups(formData, ref);

    const types = errors.map((e) => e.type);
    expect(types).toContain('EMPTY_GROUP');
    expect(types).toContain('MAX_EXCEEDED');
  });
});

describe('canAdvanceFromGroups', () => {
  it('returns true when there are no errors', () => {
    expect(canAdvanceFromGroups([])).toBe(true);
  });

  it('blocks on MIN_NOT_MET errors', () => {
    const errors: GroupValidationError[] = [
      { categoryId: 1, type: 'MIN_NOT_MET', message: 'test' },
    ];
    expect(canAdvanceFromGroups(errors)).toBe(false);
  });

  it('blocks on MAX_EXCEEDED errors', () => {
    const errors: GroupValidationError[] = [
      { categoryId: 1, type: 'MAX_EXCEEDED', message: 'test' },
    ];
    expect(canAdvanceFromGroups(errors)).toBe(false);
  });

  it('blocks on EMPTY_GROUP errors', () => {
    const errors: GroupValidationError[] = [
      { categoryId: 1, type: 'EMPTY_GROUP', message: 'test' },
    ];
    expect(canAdvanceFromGroups(errors)).toBe(false);
  });

  it('allows NO_ELIGIBLE_PRODUCTS as a warning only', () => {
    const errors: GroupValidationError[] = [
      { categoryId: 1, type: 'NO_ELIGIBLE_PRODUCTS', message: 'test' },
    ];
    expect(canAdvanceFromGroups(errors)).toBe(true);
  });

  it('allows DUPLICATE_CATEGORY as a warning only', () => {
    const errors: GroupValidationError[] = [
      { categoryId: 1, type: 'DUPLICATE_CATEGORY', message: 'test' },
    ];
    expect(canAdvanceFromGroups(errors)).toBe(true);
  });

  it('allows INVALID_BOUNDS as a warning only', () => {
    const errors: GroupValidationError[] = [
      { categoryId: 1, type: 'INVALID_BOUNDS', message: 'test' },
    ];
    expect(canAdvanceFromGroups(errors)).toBe(true);
  });

  it('blocks when critical error mixed with warnings', () => {
    const errors: GroupValidationError[] = [
      { categoryId: 1, type: 'MIN_NOT_MET', message: 'critical' },
      { categoryId: 1, type: 'NO_ELIGIBLE_PRODUCTS', message: 'warning' },
    ];
    expect(canAdvanceFromGroups(errors)).toBe(false);
  });
});

describe('computeEligibleProducts', () => {
  it('filters by categoryId, active, and SPECIAL_SELECTION', () => {
    const products = mockProducts();
    const group = mockGroup({ categoryId: 1 });
    const eligible = computeEligibleProducts(group, products);
    expect(eligible).toHaveLength(2);
    expect(eligible.every((p) => p.categoryId === 1)).toBe(true);
    expect(eligible.every((p) => p.active)).toBe(true);
    expect(eligible.every((p) => p.selectionType === SELECTION_TYPE.SPECIAL_SELECTION)).toBe(true);
  });

  it('returns empty array when no products match categoryId', () => {
    const products = mockProducts();
    const group = mockGroup({ categoryId: 999 });
    const eligible = computeEligibleProducts(group, products);
    expect(eligible).toHaveLength(0);
  });

  it('returns empty array when no active products in category', () => {
    const inactiveProduct: ProductResponse = {
      id: 99, name: 'Inactive', basePrice: 100, active: false,
      categoryId: 1, categoryName: 'Cat 1', areaId: 1, areaName: 'Area 1', recipe: [],
      selectionType: SELECTION_TYPE.SPECIAL_SELECTION,
    };
    const group = mockGroup({ categoryId: 1 });
    const eligible = computeEligibleProducts(group, [inactiveProduct]);
    expect(eligible).toHaveLength(0);
  });

  it('excludes STANDARD selection products', () => {
    const products = mockProducts();
    const group = mockGroup({ categoryId: 1 });
    const eligible = computeEligibleProducts(group, products);
    expect(eligible.some((p) => p.id === 13)).toBe(false);
  });

  it('handles empty products array', () => {
    const group = mockGroup({ categoryId: 1 });
    const eligible = computeEligibleProducts(group, []);
    expect(eligible).toHaveLength(0);
  });

  it('handles null categoryId by returning empty', () => {
    const products = mockProducts();
    const group = mockGroup({ categoryId: null });
    const eligible = computeEligibleProducts(group, products);
    expect(eligible).toHaveLength(0);
  });
});
