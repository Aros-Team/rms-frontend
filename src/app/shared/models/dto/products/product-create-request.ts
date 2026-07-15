import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';

export interface RecipeItemRequest {
  supplyVariantId: number;
  requiredQuantity: number;
}

export interface ProductOptionCreateRequest {
  name: string;
  optionCategoryId: number;
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
  selectionType?: SelectionType;
  baseRecipeEnabled?: boolean;
  schedulingRequired?: boolean;
}
