import { Routes } from '@angular/router';
import { OrdersHomePageComponent } from './features/orders/pages/orders-home/orders-home.page';

export const appRoutes: Routes = [
  {
    path: '',
    component: OrdersHomePageComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
