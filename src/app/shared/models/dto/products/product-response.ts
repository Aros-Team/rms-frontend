import type { Money } from '@app/shared/models/dto/common/money';
import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';

export interface ProductRecipeItem {
  id?: number;
  supplyVariantId: number;
  requiredQuantity: number;
}

export interface ProductResponse {
  id: number;
  name: string;
  description?: string;
  /** `MoneyDto { amount: string, currency: string }` on the wire. Use `toAmount()` for math. */
  basePrice: Money;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  areaName: string;
  recipe: ProductRecipeItem[];
  estimatedPrepMinutes?: number;
  /** Signed URL of the primary image (mobile variant), `null` when the product has none. */
  imageUrl?: string | null;
  selectionType?: SelectionType;
  /** IDs of the option groups associated with the product (`GET /v1/products/{id}`). */
  optionGroupIds?: number[];
}
