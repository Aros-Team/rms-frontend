import { Observable } from 'rxjs';
import { Order } from '../../../domain/models/order.model';
import { CreateOrderRequest } from '../../../../../shared/models/dto/orders/create-order-request.model';
import { OrderResponse } from '../../../../../shared/models/dto/orders/order-response.model';

export interface OrdersRepositoryPort {
  /**
   * Crea una nueva orden
   * POST /api/v1/orders
   */
  createOrder(payload: CreateOrderRequest): Observable<OrderResponse>;

  /**
   * Obtiene órdenes con filtros opcionales
   * GET /api/v1/orders?status=QUEUE|PREPARING|READY
   */
  getOrders(filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<OrderResponse[]>;

  /**
   * Cancela una orden
   * PUT /api/v1/orders/{id}/cancel
   */
  cancelOrder(id: number): Observable<OrderResponse>;

  /**
   * Marca una orden como lista (listo para entregar)
   * PUT /api/v1/orders/{id}/ready
   */
  markOrderReady(id: number): Observable<OrderResponse>;

  /**
   * Entrega una orden al cliente
   * PUT /api/v1/orders/{id}/deliver
   */
  deliverOrder(id: number): Observable<OrderResponse>;

  /**
   * Prepara la siguiente orden de la cola
   * PUT /api/v1/orders/prepare
   */
  prepareNextOrder(): Observable<OrderResponse>;

  /**
   * Agrega un producto a una orden existente
   * POST /api/v1/orders/{orderId}/items
   * @deprecated Usar createOrder para nuevas órdenes
   */
  addProductToOrder(payload: {
    orderId: number;
    productId: number;
    quantity: number;
    note?: string;
  }): Observable<Order>;
}
