import type { Money } from '@app/shared/models/dto/common/money';

export type CostItemType = 'MATERIAL' | 'LABOR';

export interface CostItem {
  description: string;
  /** `MoneyDto` on the wire (`{ amount: "1234.56", currency: "COP" }`). */
  amount: Money;
  type: CostItemType;
}

/** Wire shape of `ProductCostResponse` (`GET /v1/products/{id}/cost`). */
export interface ProductCostResponse {
  productId: number;
  totalCost: Money;
  materialCost: Money;
  laborCost: Money;
  breakdown: CostItem[];
  estimatedPrepMinutes?: number | null;
  realPrepMinutes?: number | null;
  realPrepSampleCount?: number;
  prepTimeMode?: 'ESTIMATED' | 'REAL' | 'AUTO';
  prepTimeUsedSource?: 'ESTIMATED' | 'REAL';
  prepTimeUsedMinutes?: number | null;
}
