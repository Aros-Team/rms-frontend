import { Money } from '@app/shared/models/dto/common/money';
import { ApiSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

/** Each option with its cost breakdown */
export interface OptionCostResponse {
  optionId: number;
  name: string;
  cost: Money;
  extraPrice: Money;
  categoryId: number;
  categorySelectionType: ApiSelectionType;
}

/** Each option group category with projected costs */
export interface CategoryCostResponse {
  categoryId: number;
  name: string;
  selectionType: ApiSelectionType;
  defaultSlotCost: Money;
  slotProjectedCost: Money;
  projectedContribution: Money;
}

/** Full cost breakdown for a product */
export interface ProductCostBreakdownResponse {
  productId: number;
  name: string;
  baseCost: Money;
  options: OptionCostResponse[];
  categories: CategoryCostResponse[];
  projectedOptionCost: Money;
  projectedEffectiveCost: Money;
}