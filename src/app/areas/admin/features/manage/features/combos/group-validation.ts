import type { WizardGroupDraft, WizardFormData } from '@app/core/services/combos/combo-wizard-state';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { SELECTION_TYPE } from '@app/shared/models/dto/special-selections/selection-type';

export interface GroupValidationError {
  categoryId: number;
  type: 'MIN_NOT_MET' | 'MAX_EXCEEDED' | 'NO_ELIGIBLE_PRODUCTS' | 'INVALID_BOUNDS' | 'DUPLICATE_CATEGORY' | 'EMPTY_GROUP';
  message: string;
}

const CAT_PREFIX = 'La categoría #';

const ERROR_MESSAGES: Record<GroupValidationError['type'], (categoryId: number) => string> = {
  MIN_NOT_MET: (catId) =>
    `${CAT_PREFIX}${String(catId)} requiere al menos el mínimo de selecciones.`,
  MAX_EXCEEDED: (catId) =>
    `${CAT_PREFIX}${String(catId)} excede el máximo de selecciones permitidas.`,
  NO_ELIGIBLE_PRODUCTS: (catId) =>
    `${CAT_PREFIX}${String(catId)} no tiene productos disponibles para selección especial.`,
  INVALID_BOUNDS: (catId) =>
    `${CAT_PREFIX}${String(catId)} tiene valores de mínimo y máximo inválidos.`,
  DUPLICATE_CATEGORY: (catId) =>
    `${CAT_PREFIX}${String(catId)} está asignada a más de un grupo.`,
  EMPTY_GROUP: (catId) =>
    `${CAT_PREFIX}${String(catId)} es obligatoria y no tiene productos seleccionados.`,
};

export function validateGroup(
  group: WizardGroupDraft,
  eligibleProductCount: number,
): GroupValidationError | null {
  const categoryId = group.categoryId ?? 0;

  if (eligibleProductCount === 0) {
    return {
      categoryId,
      type: 'NO_ELIGIBLE_PRODUCTS',
      message: ERROR_MESSAGES.NO_ELIGIBLE_PRODUCTS(categoryId),
    };
  }

  if (group.minSelections < 0 || group.maxSelections < 1 || group.minSelections > group.maxSelections) {
    return {
      categoryId,
      type: 'INVALID_BOUNDS',
      message: ERROR_MESSAGES.INVALID_BOUNDS(categoryId),
    };
  }

  if (group.required && group.productIds.length === 0) {
    return {
      categoryId,
      type: 'EMPTY_GROUP',
      message: ERROR_MESSAGES.EMPTY_GROUP(categoryId),
    };
  }

  if (group.required && group.productIds.length < group.minSelections) {
    return {
      categoryId,
      type: 'MIN_NOT_MET',
      message: ERROR_MESSAGES.MIN_NOT_MET(categoryId),
    };
  }

  if (group.productIds.length > group.maxSelections) {
    return {
      categoryId,
      type: 'MAX_EXCEEDED',
      message: ERROR_MESSAGES.MAX_EXCEEDED(categoryId),
    };
  }

  return null;
}

export function validateAllGroups(
  formData: WizardFormData,
  reference: { specialSelectionProductsByCategory(id: number): ProductResponse[] },
): GroupValidationError[] {
  const errors: GroupValidationError[] = [];

  const seenCategoryIds = new Set<number>();

  for (const group of formData.groups) {
    const categoryId = group.categoryId;
    if (categoryId === null) {
      continue;
    }

    if (seenCategoryIds.has(categoryId)) {
      errors.push({
        categoryId,
        type: 'DUPLICATE_CATEGORY',
        message: ERROR_MESSAGES.DUPLICATE_CATEGORY(categoryId),
      });
    }
    seenCategoryIds.add(categoryId);

    const eligibleProducts = reference.specialSelectionProductsByCategory(categoryId);
    const error = validateGroup(group, eligibleProducts.length);
    if (error !== null) {
      errors.push(error);
    }
  }

  return errors;
}

export function canAdvanceFromGroups(errors: GroupValidationError[]): boolean {
  const criticalTypes = new Set<GroupValidationError['type']>(['MIN_NOT_MET', 'MAX_EXCEEDED', 'EMPTY_GROUP']);
  return !errors.some((e) => criticalTypes.has(e.type));
}

export function computeEligibleProducts(
  group: WizardGroupDraft,
  products: ProductResponse[],
): ProductResponse[] {
  return products.filter(
    (p) => p.categoryId === group.categoryId && p.active && p.selectionType === SELECTION_TYPE.SPECIAL_SELECTION,
  );
}
