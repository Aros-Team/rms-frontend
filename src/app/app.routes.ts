import { Routes } from '@angular/router';
import { OrdersHomePageComponent } from './features/orders/pages/orders-home/orders-home.page';
import { OrdersListPageComponent } from './features/orders/pages/orders-list/orders-list.page';
import { ProductsListPageComponent } from './features/products/pages/products-list/products-list.page';
import { ProductCreatePageComponent } from './features/products/pages/product-create/product-create.page';
import { AppShellLayoutComponent } from './shared/layout/app-shell-layout.component';
import { AuthShellPageComponent } from './features/auth/pages/auth-shell/auth-shell.page';
import { LoginPageComponent } from './features/auth/pages/login/login.page';

export const appRoutes: Routes = [
  {
    path: 'auth',
    component: AuthShellPageComponent,
    children: [
      {
        path: 'login',
        component: LoginPageComponent,
      },
      {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    component: AppShellLayoutComponent,
    children: [
      {
        path: '',
        component: OrdersHomePageComponent,
      },
      {
        path: 'orders',
        component: OrdersListPageComponent,
      },
      {
        path: 'products',
        component: ProductsListPageComponent,
      },
      {
        path: 'products/new',
        component: ProductCreatePageComponent,
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/auth/login',
  },
];
