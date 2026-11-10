import type { Money } from '@app/shared/models/dto/common/money';
export interface PurchaseItemResponse {
  id: number;
  supplyVariantId: number;
  quantityOrdered: number;
  quantityReceived: number;
  /** `MoneyDto` on the wire. Use `toAmount()` for math. */
  unitPrice: Money | number;
}
