import { Routes } from '@angular/router';
import { OrdersHomePageComponent } from './features/orders/pages/orders-home/orders-home.page';
<<<<<<< Updated upstream
=======
import { OrdersListPageComponent } from './features/orders/pages/orders-list/orders-list.page';
import { ProductsListPageComponent } from './features/products/pages/products-list/products-list.page';
import { ProductCreatePageComponent } from './features/products/pages/product-create/product-create.page';
import { AppShellLayoutComponent } from './shared/layout/app-shell-layout.component';
import { AuthShellPageComponent } from './features/auth/pages/auth-shell/auth-shell.page';
import { LoginPageComponent } from './features/auth/pages/login/login.page';
import { ForgotPasswordPageComponent } from './features/auth/pages/forgot-password/forgot-password.page';
import { TwoFactorPageComponent } from './features/auth/pages/two-factor/two-factor.page';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { twoFactorGuard } from './core/guards/two-factor.guard';
>>>>>>> Stashed changes

export const appRoutes: Routes = [
  {
    path: '',
<<<<<<< Updated upstream
    component: OrdersHomePageComponent,
=======
    component: AppShellLayoutComponent,
    // canActivate: [authGuard], // Temporalmente desactivado para desarrollo
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
>>>>>>> Stashed changes
  },
  {
    path: '**',
    redirectTo: '',
  },
];
