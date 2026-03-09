import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { OrderResponse } from '../models/dto/orders/order-response.model';

/**
 * OrdersEventsService
 *
 * Arquitectura: servicio compartido (shared) para comunicar eventos de órdenes
 * entre pantallas (Orders Home -> Kitchen, etc.). Mantiene bajo acoplamiento
 * y cumple reglas de AGENTS.md (features pueden depender de shared).
 */
@Injectable({ providedIn: 'root' })
export class OrdersEventsService {
  /** Emite cuando se crea una nueva orden (estado inicial: QUEUE) */
  readonly orderCreated$ = new Subject<OrderResponse>();

  emitOrderCreated(order: OrderResponse): void {
    this.orderCreated$.next(order);
  }
}
