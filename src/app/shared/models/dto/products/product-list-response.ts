import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';

export interface ProductListResponse {
  id: number;
  name: string;
  description?: string;
  basePrice: number;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  thumbnailUrl?: string;
  selectionType?: SelectionType;
  baseRecipeEnabled?: boolean;
  schedulingRequired?: boolean;
}
