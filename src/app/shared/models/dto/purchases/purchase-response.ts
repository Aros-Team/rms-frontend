import { PurchaseItemResponse } from './purchase-item-response';

export interface PurchaseResponse {
  id: number;
  supplierId: number;
  registeredById: number;
  purchasedAt: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  items: PurchaseItemResponse[];
}
