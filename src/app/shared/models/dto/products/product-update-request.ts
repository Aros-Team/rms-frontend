import { RecipeItemRequest } from './product-create-request';

export interface ProductUpdateRequest {
  id: number;
  name: string;
  basePrice: number;
  categoryId: number;
  areaId: number;
  recipe?: RecipeItemRequest[];
  optionIds?: number[];
}