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
  basePrice: Money | number;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  areaName: string;
  recipe: ProductRecipeItem[];
  estimatedPrepMinutes?: number;
  imageUrl?: string;
  selectionType?: SelectionType;
}
