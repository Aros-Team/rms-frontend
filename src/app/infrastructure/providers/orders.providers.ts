import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { ORDERS_REPOSITORY } from '../../core/orders/application/tokens/orders.tokens';
import { OrdersHttpRepository } from '../http/orders/orders-http.repository';

export function provideOrdersInfrastructure(): EnvironmentProviders {
  return makeEnvironmentProviders([
    OrdersHttpRepository,
    {
      provide: ORDERS_REPOSITORY,
      useExisting: OrdersHttpRepository,
    },
  ]);
}
