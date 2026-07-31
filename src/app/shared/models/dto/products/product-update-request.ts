import { RecipeItemRequest } from './product-create-request';

export interface ProductUpdateRequest {
  name: string;
  description?: string;
  basePrice: number;
  categoryId: number;
  areaId: number;
  estimatedPrepMinutes?: number;
  recipe?: RecipeItemRequest[];
  optionIds?: number[];
}
