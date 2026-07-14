export interface SuggestedPriceBreakdownEntry {
  optionId: number;
  name: string;
  cost: number;
}

export interface SuggestedPriceResponse {
  suggestedPrice: number;
  totalCost: number;
  marginPercent: number;
  breakdown: SuggestedPriceBreakdownEntry[];
}

export interface SuggestedPriceErrorResponse {
  status: number;
  message: string;
  missingVariants: number[];
}