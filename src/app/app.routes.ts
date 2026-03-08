import { Routes } from '@angular/router';
import { authGuard, adminGuard, kitchenGuard } from './core/auth/application/guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/orders/pages/orders-home/orders-home.page').then(m => m.OrdersHomePageComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/orders/pages/orders-list/orders-list.page').then(m => m.OrdersListPageComponent)
      }
    ]
  },
  {
    path: 'kitchen',
    canActivate: [kitchenGuard],
    loadComponent: () => import('./features/kitchen/pages/kitchen-dashboard/kitchen-dashboard.page').then(m => m.KitchenDashboardPageComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    children: [
      {
        path: 'products',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/products/pages/products-list/products-list.page').then(m => m.ProductsListPageComponent)
          },
          {
            path: 'new',
            loadComponent: () => import('./features/products/pages/product-create/product-create.page').then(m => m.ProductCreatePageComponent)
          }
        ]
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];
