import { Component } from '@angular/core';

import { OrdersTable } from '@areas/admin/features/orders/components/orders-table/orders-table';
import { RmsPageHeader } from '@shared/ui/page-header/page-header';

@Component({
  selector: 'app-orders',
  imports: [OrdersTable, RmsPageHeader],
  templateUrl: './orders.html',
})
export class Orders {
  title = 'Gestión de Pedidos';
  description = 'Aquí puedes gestionar todos los pedidos del restaurante';
}
