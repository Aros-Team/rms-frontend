import { CategorySimpleResponse } from "../category/category-simple-response";

export interface ProductResponse {
  id: number;
  name: string;
  basePrice: number;
  hasOptions: boolean;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
}