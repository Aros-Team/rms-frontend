import { Routes } from '@angular/router';
import { AuthGuard } from '@core/guards/auth-guard';
import { RoleGuard } from '@core/guards/role-guard';
import { RedirectGuard } from '@app/core/guards/redirect-guard';


export const routes: Routes = [

  {
    path: 'login',
    loadComponent: () => import('@areas/login/login-area').then(m => m.Login),
    canActivate: [RedirectGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/password-recovery/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/password-recovery/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'login/verify',
    loadComponent: () => import('./features/auth/two-factor/two-factor-verify/two-factor-verify.component').then(m => m.TwoFactorVerifyComponent),
  },
  {
    path: 'setup-account',
    loadComponent: () => import('./features/auth/setup-account/setup-account.component').then(m => m.SetupAccountComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('@areas/admin/admin-area').then(m => m.AdminArea),
    canActivate: [AuthGuard, RoleGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('@features/admin/dashboard/dashboard').then(m => m.Dashboard),
      },
      {
        path: 'orders',
        loadComponent: () => import('@features/admin/orders/orders').then(m => m.Orders),
      },
      {
        path: 'manage',
        loadComponent: () => import('@features/admin/manage/manage').then(m => m.Manage),
        children: [
          {
            path: '',
            redirectTo: 'products',
            pathMatch: 'full'
          },
          {
            path: 'products',
            loadComponent: () => import('@features/admin/manage/products/products').then(m => m.Products),
          },
          {
            path: 'categories',
            loadComponent: () => import('@features/admin/manage/categories/categories').then(m => m.Categories),
          },
          {
            path: 'tables',
            loadComponent: () => import('@features/admin/manage/tables/tables').then(m => m.Tables),
          },
          {
            path: 'areas',
            loadComponent: () => import('@features/admin/manage/areas/areas').then(m => m.Areas),
          },
          {
            path: 'menu',
            loadComponent: () => import('@features/admin/manage/menu/menu').then(m => m.Menu),
          },
          {
            path: 'orders-create',
            loadComponent: () => import('./features/orders-create/order-creation-form').then(m => m.OrderCreationForm),
          },
          {
            path: 'users',
            loadComponent: () => import('@features/admin/manage/users/users').then(m => m.Users),
          },
          {
            path: 'inventory',
            loadComponent: () => import('./features/admin/manage/inventory/inventory').then(m => m.Inventory),
          },
        ]
      },
      {
        path: 'analytics',
        loadComponent: () => import('@features/admin/analytics/analytics').then(m => m.Analytics),
      },
      {
        path: 'create-product',
        loadComponent: () => import('@features/admin/creation/product-creation-form').then(m => m.ProductCreationForm),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
    ],
  },

  {
    path: 'worker',
    loadComponent: () => import('@areas/worker/worker-area').then(m => m.WorkerArea),
    canActivate: [AuthGuard, RoleGuard],
    children: [
      { path: '', loadComponent: () => import('@features/waiter/waiter-area').then(m => m.WaiterArea) },
      { path: 'day-menu', loadComponent: () => import('@features/waiter/day-menu/day-menu').then(m => m.DayMenu) },
      { path: 'take-order', loadComponent: () => import('@features/waiter/take-order/take-order').then(m => m.TakeOrder) },
      { path: 'orders', loadComponent: () => import('@features/waiter/today-orders/today-orders').then(m => m.TodayOrders) },
      { path: 'kitchen', loadComponent: () => import('@features/kitchen/kitchen').then(m => m.Kitchen) },
      { path: 'profile', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
    ]
  },
  {
    path: '**',
    redirectTo: '/login'

  }
];
