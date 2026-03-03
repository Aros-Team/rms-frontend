import { InjectionToken } from '@angular/core';
import { OrdersRepositoryPort } from '../ports/output/orders.repository.port';

export const ORDERS_REPOSITORY = new InjectionToken<OrdersRepositoryPort>('ORDERS_REPOSITORY');
