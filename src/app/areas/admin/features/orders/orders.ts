import { Component } from '@angular/core';

import { OrdersTable } from '@areas/admin/features/orders/components/orders-table/orders-table';

@Component({
  selector: 'app-orders',
  imports: [OrdersTable],
  templateUrl: './orders.html',
  styles: ``
})
export class Orders {
  title = 'Gestión de Pedidos';
  description = 'Aquí puedes gestionar todos los pedidos del restaurante';
}
