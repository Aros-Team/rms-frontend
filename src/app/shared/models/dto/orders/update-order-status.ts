import type { CreateOrderDetail } from './create-order-request';

/**
 * Body of `PUT /v1/orders/{id}`.
 *
 * The backend reuses the same payload as order creation (`TakeOrderRequest`):
 * `{ tableId, details }`. It does not accept a bare `{ status }` — status
 * transitions go through `PUT /orders/{id}/ready|deliver|cancel`.
 */
export interface UpdateOrderRequest {
  tableId: number;
  details: CreateOrderDetail[];
}
