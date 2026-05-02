export interface ProductRecipeItem {
  id?: number;
  supplyVariantId: number;
  requiredQuantity: number;
}

export interface ProductResponse {
  id: number;
  name: string;
  basePrice: number;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  areaName: string;
  recipe: ProductRecipeItem[];
}