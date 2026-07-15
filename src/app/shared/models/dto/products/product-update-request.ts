import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';
import { RecipeItemRequest } from './product-create-request';

export interface ProductUpdateRequest {
  id: number;
  name: string;
  basePrice: number;
  categoryId: number;
  areaId: number;
  recipe?: RecipeItemRequest[];
  optionIds?: number[];
  selectionType?: SelectionType;
  baseRecipeEnabled?: boolean;
  schedulingRequired?: boolean;
}
