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
  basePrice: number;
  hasOptions: boolean;
  categoryId: number;
  areaId: number;
  recipe: RecipeItemRequest[];
  optionIds?: number[];
}
