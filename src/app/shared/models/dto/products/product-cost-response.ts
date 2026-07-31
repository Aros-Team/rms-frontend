export type CostItemType = 'MATERIAL' | 'LABOR';

export interface CostItem {
  description: string;
  amount: number;
  type: CostItemType;
}

export interface ProductCostResponse {
  productId: number;
  totalCost: number;
  materialCost: number;
  laborCost: number;
  breakdown: CostItem[];
}