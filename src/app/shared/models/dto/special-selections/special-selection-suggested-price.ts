import type { Money } from '@app/shared/models/dto/common/money';

/**
 * Monetary fields are `MoneyDto { amount: string, currency: string }` on the
 * wire (`number` kept as a transitional tolerance). Normalize with
 * `toAmount()` before arithmetic and render with the `money` pipe.
 */
export interface SuggestedPriceBreakdownEntry {
  optionId?: number | null;
  productId: number;
  name: string;
  cost: Money | number;
}

export interface SuggestedPriceResponse {
  suggestedPrice: Money | number;
  totalCost: Money | number;
  marginPercent: number;
  breakdown: SuggestedPriceBreakdownEntry[];
}
