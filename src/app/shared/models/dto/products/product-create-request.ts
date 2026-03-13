export interface ProductCreateRequest {
  name: string;
  basePrice: number;
  hasOptions: boolean;
  categoryId: number;
  areaId: number;
}