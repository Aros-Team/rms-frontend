export interface ProductUpdateRequest {
  id: number;
  name: string;
  basePrice: number;
  hasOptions: boolean;
  categoryId: number;
  areaId: number;
}