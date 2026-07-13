import { Routes } from '@angular/router';
import { AreaGuard } from '@core/guards/area';
import { AuthGuard } from '@core/guards/auth';
import { RoleGuard } from '@core/guards/role';
import { RedirectGuard } from '@app/core/guards/redirect-guard';


export const routes: Routes = [

  {
    path: 'login',
    loadComponent: () => import('@areas/auth/auth-area').then(m => m.Auth),
    canActivate: [RedirectGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('@areas/auth/features/password-recovery/forgot-password').then(m => m.ForgotPassword),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('@areas/auth/features/password-recovery/reset-password').then(m => m.ResetPassword),
  },
  {
    path: 'login/verify',
    loadComponent: () => import('@areas/auth/features/two-factor/two-factor-verify/two-factor-verify').then(m => m.TwoFactorVerify),
  },
  {
    path: 'setup-account',
    loadComponent: () => import('@areas/auth/features/setup-account/setup-account').then(m => m.SetupAccount),
  },
  {
    path: 'admin',
    loadComponent: () => import('@areas/admin/admin-area').then(m => m.AdminArea),
    canActivate: [AuthGuard, RoleGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('@areas/admin/features/dashboard/dashboard').then(m => m.Dashboard),
      },
      {
        path: 'orders',
        loadComponent: () => import('@areas/admin/features/orders/orders').then(m => m.Orders),
      },
      {
        path: 'manage',
        loadComponent: () => import('@areas/admin/features/manage/manage').then(m => m.Manage),
        children: [
          {
            path: '',
            redirectTo: 'products',
            pathMatch: 'full'
          },
          {
            path: 'products',
            loadComponent: () => import('@areas/admin/features/manage/products/products').then(m => m.Products),
          },
          {
            path: 'categories',
            loadComponent: () => import('@areas/admin/features/manage/categories/categories').then(m => m.Categories),
          },
          {
            path: 'tables',
            loadComponent: () => import('@areas/admin/features/manage/tables/tables').then(m => m.Tables),
          },
          {
            path: 'areas',
            loadComponent: () => import('@areas/admin/features/manage/areas/areas').then(m => m.Areas),
          },
          {
            path: 'menu',
            loadComponent: () => import('@areas/admin/features/manage/menu/menu').then(m => m.Menu),
          },
          {
            path: 'orders-create',
            loadComponent: () => import('@shared/features/orders/order-creation/order-creation-form').then(m => m.OrderCreationForm),
          },
          {
            path: 'users',
            loadComponent: () => import('@areas/admin/features/manage/users/users').then(m => m.Users),
          },
          {
            path: 'users/:id/salary-history',
            loadComponent: () => import('@areas/admin/features/manage/users/salary-history/salary-history').then(m => m.SalaryHistory),
          },
          {
            path: 'inventory',
            loadComponent: () => import('@areas/admin/features/manage/inventory/inventory').then(m => m.Inventory),
          },
          {
            path: 'schedules',
            loadComponent: () => import('@areas/admin/features/manage/schedules/schedules').then(m => m.Schedules),
          },
          {
            path: 'schedules/:scheduleId/assignments',
            loadComponent: () => import('@areas/admin/features/manage/schedules/assignments/schedule-assignments').then(m => m.ScheduleAssignments),
          },
          {
            path: 'time-logs',
            loadComponent: () => import('@areas/admin/features/manage/time-logs/time-logs').then(m => m.TimeLogs),
          },
        ]
      },
      {
        path: 'analytics',
        loadComponent: () => import('@areas/admin/features/analytics/analytics').then(m => m.Analytics),
      },
      {
        path: 'create-product',
        loadComponent: () => import('@areas/admin/features/product-creation/product-creation-form').then(m => m.ProductCreationForm),
      },
      {
        path: 'profile',
        loadComponent: () => import('@shared/features/settings/settings').then(m => m.Settings),
      },
    ],
  },

  {
    path: 'worker',
    loadComponent: () => import('@areas/worker/worker-area').then(m => m.WorkerArea),
    canActivate: [AuthGuard, RoleGuard],
    children: [
      { path: '', redirectTo: 'waiter', pathMatch: 'full' },
      { path: 'waiter', loadComponent: () => import('@areas/worker/features/waiter/waiter-dashboard/waiter-dashboard').then(m => m.WaiterDashboard), canActivate: [AreaGuard] },
      { path: 'day-menu',   redirectTo: '/worker?tab=menu' },
      { path: 'take-order', redirectTo: '/worker?tab=carta' },
      { path: 'orders',     redirectTo: '/worker?tab=pedidos' },
      { path: 'kitchen', loadComponent: () => import('@areas/worker/features/kitchen/kitchen').then(m => m.Kitchen), canActivate: [AreaGuard] },
      { path: 'profile', loadComponent: () => import('@shared/features/settings/settings').then(m => m.Settings), canActivate: [AreaGuard] },
      { path: 'my-schedule', loadComponent: () => import('@areas/worker/features/my-schedule/my-schedule').then(m => m.MySchedule), canActivate: [AreaGuard] },
    ]
  },
  {
    path: '**',
    redirectTo: '/login'

  }
];
