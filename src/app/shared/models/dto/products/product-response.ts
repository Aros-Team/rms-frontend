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
  /** People working on the product during its preparation time. Defaults to 1. */
  requiredWorkers?: number;
  /** Estimated/real/auto preparation-time source used for costing. */
  prepTimeMode?: 'ESTIMATED' | 'REAL' | 'AUTO';
  /** Signed URL of the primary image (mobile variant), `null` when the product has none. */
  imageUrl?: string | null;
  /** Signed URL of the primary image (tablet variant). */
  imageTabletUrl?: string | null;
  /** Signed URL of the primary image (desktop variant). */
  imageDesktopUrl?: string | null;
  selectionType?: SelectionType;
  /** IDs of the option groups associated with the product (`GET /v1/products/{id}`). */
  optionGroupIds?: number[];
}
