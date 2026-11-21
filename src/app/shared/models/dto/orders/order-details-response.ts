import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';
import type { Money } from '@app/shared/models/dto/common/money';

/**
 * Money fields below are `MoneyDto { amount: string, currency: string }` on the
 * wire (the backend money migration). `number` stays as a transitional
 * tolerance; normalize with `toAmount()` before arithmetic and render with the
 * `money` pipe.
 */

export interface OrderDetailsResponse {
  id: number;
  status: string; // expecting values like 'PENDING', 'COMPLETED', etc.
  takedAt: string;
  total: Money | number;
  tableName: string;
  responsibleName: string;
  clientOrders: ClientOrder[];
}

export interface ClientOrder {
  id: number;
  total: Money | number;
  status: string;
  details: ClientOrderDetail[];
}

export interface ClientOrderAddition {
  name: string;
  extraPrice: Money | number;
}

export interface ClientOrderClarification {
  question: string;
  answer: string;
}

export interface ClientGroupSelection {
  groupName: string;
  selectedOptions: string[];
}

export interface ClientOrderDetail {
  id: number;
  name: string;
  price: Money | number;
  quantity: number;
  observations: string;
  selectionType?: SelectionType;
  selectedProductIds?: number[];
  additions?: ClientOrderAddition[];
  clarifications?: ClientOrderClarification[];
  groupSelections?: ClientGroupSelection[];
  extraCharge?: Money | number;
}
