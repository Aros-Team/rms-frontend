import type { OptionExtrasItem } from './product-option';

export interface RecipeItemRequest {
  supplyVariantId: number;
  requiredQuantity: number;
}

export interface ProductOptionCreateRequest {
  name: string;
  /** API field name for the option group (`ProductOptionRequest.optionGroupId`). */
  optionGroupId: number;
  recipe: RecipeItemRequest[];
}

export interface ProductCreateRequest {
  name: string;
  description?: string;
  basePrice: number;
  categoryId: number;
  areaId: number;
  recipe: RecipeItemRequest[];
  optionIds?: number[];
  optionExtras?: OptionExtrasItem[];
  estimatedPrepMinutes?: number;
}
