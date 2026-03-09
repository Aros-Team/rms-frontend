export interface Product {
  id: number;
  name: string;
  basePrice: number;
  hasOptions: boolean;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  // Para UI:
  stock?: number;
  description?: string;
  imageUrl?: string;
  tags?: string[];
}