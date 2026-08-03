import { RecipeItemRequest } from './product-create-request';
import { OptionExtrasItem } from './product-option';

export interface ProductUpdateRequest {
  name: string;
  description?: string;
  basePrice: number;
  categoryId: number;
  areaId: number;
  estimatedPrepMinutes?: number;
  recipe?: RecipeItemRequest[];
  optionIds?: number[];
  optionExtras?: OptionExtrasItem[];
}
