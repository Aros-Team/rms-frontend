import type { Money } from '@app/shared/models/dto/common/money';
import { PurchaseItemResponse } from './purchase-item-response';

export interface PurchaseResponse {
  id: number;
  supplierId: number;
  registeredById: number;
  purchasedAt: string;
  /** `MoneyDto` on the wire. Use `toAmount()` for math. */
  totalAmount: Money;
  notes: string | null;
  createdAt: string;
  items: PurchaseItemResponse[];
}
