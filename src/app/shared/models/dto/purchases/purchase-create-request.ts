import { PurchaseItemRequest } from './purchase-item-request';

export interface PurchaseCreateRequest {
  supplierId: number;
  registeredById: number;
  purchasedAt: string;
  totalAmount: number;
  notes?: string;
  items: PurchaseItemRequest[];
}
