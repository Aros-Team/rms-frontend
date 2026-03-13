export interface ProductSimpleResponse {
  id: number;
  name: string;
  basePrice: number;
  hasOptions: boolean;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
}