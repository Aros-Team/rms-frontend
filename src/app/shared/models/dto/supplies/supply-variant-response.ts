import type { Money } from '@app/shared/models/dto/common/money';

export interface SupplyVariantResponse {
  id: number;
  supplyId: number;
  supplyName: string;
  categoryId: number;
  categoryName: string;
  unitId: number;
  unitAbbreviation: string;
  quantity: number;
  stockBodega: number;
  stockCocina: number;
  /** `MoneyDto` on the wire. Use `toAmount()` for math. */
  unitCost: Money;
}
