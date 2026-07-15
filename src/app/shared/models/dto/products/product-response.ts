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
  basePrice: number;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  areaName: string;
  recipe: ProductRecipeItem[];
  thumbnailUrl?: string;
  selectionType?: SelectionType;
  baseRecipeEnabled?: boolean;
  schedulingRequired?: boolean;
}
