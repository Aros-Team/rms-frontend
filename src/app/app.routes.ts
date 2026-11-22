import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { AreaGuard } from '@core/guards/area/area';
import { AuthGuard } from '@core/guards/auth/auth';
import { RoleGuard } from '@core/guards/role/role';
import { RedirectGuard } from '@app/core/guards/redirect-guard/redirect-guard';
import { settingsUnsavedChangesGuard } from '@areas/admin/features/settings/settings-unsaved-changes.guard';
import type { WorkerRouteData } from '@app/core/config/navigation/role-navigation';

/**
 * Route table.
 *
 * Structure:
 *  - one pathless auth shell for the five public/auth screens (`/login`,
 *    `/login/verify`, `/forgot-password`, `/reset-password`, `/setup-account`)
 *  - `/admin` workstation shell (AuthGuard + RoleGuard)
 *  - `/worker` workstation shell; every child declares its workspace in
 *    `data` and is checked by `AreaGuard` (deny by default)
 *  - `/worker/cashier` is a real guarded route even though the payments UI is
 *    still a placeholder (D-009)
 *
 * PENDING (Phase 2): `/admin/analytics/operations|cohort|alerts` stay routed but
 * redirect to the two analytics screens that exist. The components are rebuilt
 * in Phase 2; do not delete the routes before that.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: '',
    title: 'Acceso',
    loadComponent: () => import('@areas/auth/auth-area').then((m) => m.Auth),
    children: [
      {
        path: 'login',
        title: 'Iniciar sesión',
        loadComponent: () =>
          import('@areas/auth/features/login/login').then((m) => m.LoginForm),
        canActivate: [RedirectGuard],
      },
      {
        path: 'login/verify',
        title: 'Verificación en dos pasos',
        loadComponent: () =>
          import('@areas/auth/features/two-factor/two-factor-verify/two-factor-verify').then(
            (m) => m.TwoFactorVerify,
          ),
      },
      {
        path: 'forgot-password',
        title: 'Recuperar contraseña',
        loadComponent: () =>
          import('@areas/auth/features/password-recovery/forgot-password').then(
            (m) => m.ForgotPassword,
          ),
      },
      {
        path: 'reset-password',
        title: 'Restablecer contraseña',
        loadComponent: () =>
          import('@areas/auth/features/password-recovery/reset-password').then(
            (m) => m.ResetPassword,
          ),
      },
      {
        path: 'setup-account',
        title: 'Configurar cuenta',
        loadComponent: () =>
          import('@areas/auth/features/setup-account/setup-account').then((m) => m.SetupAccount),
      },
    ],
  },
  {
    path: 'server-error',
    title: 'Servidor no disponible',
    loadComponent: () =>
      import('@shared/components/server-error-page/server-error-page').then(
        (m) => m.ServerErrorPage,
      ),
  },
  {
    path: 'forbidden',
    title: 'Acceso denegado',
    loadComponent: () =>
      import('@shared/components/forbidden-page/forbidden-page').then((m) => m.ForbiddenPage),
  },
  {
    path: 'admin',
    title: 'Administración',
    loadComponent: () => import('@areas/admin/admin-area').then((m) => m.AdminArea),
    canActivate: [AuthGuard, RoleGuard],
    children: [
      {
        path: '',
        title: 'Panel',
        loadComponent: () =>
          import('@areas/admin/features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'orders',
        title: 'Pedidos',
        loadComponent: () => import('@areas/admin/features/orders/orders').then((m) => m.Orders),
      },
      {
        path: 'schedules',
        title: 'Horarios',
        loadComponent: () =>
          import('@areas/admin/features/manage/features/schedules/schedules-page').then(
            (m) => m.SchedulesPage,
          ),
      },
      {
        path: 'manage',
        title: 'Gestión',
        loadComponent: () => import('@areas/admin/features/manage/manage').then((m) => m.Manage),
        children: [
          {
            path: '',
            redirectTo: 'products',
            pathMatch: 'full',
          },
          {
            path: 'products',
            title: 'Productos',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/products/products').then(
                (m) => m.Products,
              ),
          },
          {
            path: 'products/:id/recipe',
            title: 'Receta del producto',
            loadComponent: () =>
              import(
                '@areas/admin/features/manage/features/products/product-recipe-page/product-recipe-page'
              ).then((m) => m.ProductRecipePage),
          },
          {
            path: 'categories',
            title: 'Categorías',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/categories/categories').then(
                (m) => m.Categories,
              ),
          },
          {
            path: 'tables',
            title: 'Mesas',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/tables/tables').then((m) => m.Tables),
          },
          {
            path: 'areas',
            title: 'Áreas',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/areas/areas').then((m) => m.Areas),
          },
          {
            path: 'combos',
            title: 'Combos',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/combos/combos').then((m) => m.Combos),
          },
          {
            path: 'combos/new',
            title: 'Nuevo combo',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/combos/combo-wizard-page').then(
                (m) => m.ComboWizardPage,
              ),
          },
          {
            path: 'combos/:id/edit',
            title: 'Editar combo',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/combos/combo-wizard-page').then(
                (m) => m.ComboWizardPage,
              ),
          },
          {
            path: 'combos/:id/history',
            title: 'Historial del combo',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/combos/combo-history').then(
                (m) => m.ComboHistory,
              ),
          },
          {
            path: 'orders-create',
            title: 'Crear pedido',
            loadComponent: () =>
              import('@shared/features/orders/order-creation/order-creation-form').then(
                (m) => m.OrderCreationForm,
              ),
          },
          {
            path: 'workers',
            title: 'Trabajadores',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/workers/workers').then(
                (m) => m.Workers,
              ),
          },
          {
            path: 'workers/:id/salary-history',
            title: 'Historial salarial',
            loadComponent: () =>
              import(
                '@areas/admin/features/manage/features/workers/salary-history/salary-history'
              ).then((m) => m.SalaryHistory),
          },
          {
            path: 'inventory',
            title: 'Inventario',
            loadComponent: () =>
              import('@areas/admin/features/manage/features/inventory/inventory').then(
                (m) => m.Inventory,
              ),
          },
        ],
      },
      {
        path: 'analytics',
        title: 'Analítica',
        loadComponent: () =>
          import('@areas/admin/features/analytics/analytics').then((m) => m.Analytics),
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'prime-cost',
          },
          {
            path: 'prime-cost',
            title: 'Costo primo',
            loadComponent: () =>
              import('@areas/admin/features/analytics/features/prime-cost/prime-cost').then(
                (m) => m.PrimeCost,
              ),
          },
          {
            path: 'menu-engineering',
            title: 'Ingeniería de menú',
            loadComponent: () =>
              import(
                '@areas/admin/features/analytics/features/menu-engineering/menu-engineering'
              ).then((m) => m.MenuEngineering),
          },
          {
            path: 'operations',
            title: 'Operación',
            loadComponent: () =>
              import('@areas/admin/features/analytics/features/operations/operations').then(
                (m) => m.Operations,
              ),
          },
          {
            path: 'cohort',
            title: 'Cohortes',
            loadComponent: () =>
              import('@areas/admin/features/analytics/features/cohort/cohort').then(
                (m) => m.Cohort,
              ),
          },
          {
            path: 'alerts',
            title: 'Alertas',
            loadComponent: () =>
              import('@areas/admin/features/analytics/features/alerts/alerts').then(
                (m) => m.Alerts,
              ),
          },
        ],
      },
      {
        path: 'settings',
        title: 'Configuración',
        loadComponent: () =>
          import('@areas/admin/features/settings/settings-page').then((m) => m.SettingsPage),
        canDeactivate: [settingsUnsavedChangesGuard],
      },
      {
        path: 'create-product',
        title: 'Crear producto',
        loadComponent: () =>
          import('@areas/admin/features/product-creation/product-creation-form').then(
            (m) => m.ProductCreationForm,
          ),
      },
      {
        path: 'profile',
        title: 'Mi perfil',
        loadComponent: () => import('@shared/features/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  {
    path: 'worker',
    title: 'Área de trabajo',
    loadComponent: () => import('@areas/worker/worker-area').then((m) => m.WorkerArea),
    canActivate: [AuthGuard, RoleGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Área de trabajo',
        loadComponent: () =>
          import('@areas/worker/worker-landing/worker-landing').then((m) => m.WorkerLanding),
        canActivate: [AreaGuard],
        data: { workerLanding: true } satisfies WorkerRouteData,
      },
      {
        path: 'waiter',
        title: 'Tomar pedidos',
        loadComponent: () =>
          import('@areas/worker/features/waiter/waiter-dashboard/waiter-dashboard').then(
            (m) => m.WaiterDashboard,
          ),
        canActivate: [AreaGuard],
        data: { workerWorkspaces: ['waiter'] } satisfies WorkerRouteData,
      },
      {
        path: 'combos/:id',
        title: 'Detalle del combo',
        loadComponent: () =>
          import('@areas/worker/features/waiter/combos/combo-detail').then((m) => m.ComboDetail),
        canActivate: [AreaGuard],
        data: { workerWorkspaces: ['waiter'] } satisfies WorkerRouteData,
      },
      {
        path: 'kitchen',
        title: 'Cocina',
        loadComponent: () =>
          import('@areas/worker/features/kitchen/kitchen').then((m) => m.Kitchen),
        canActivate: [AreaGuard],
        data: { workerWorkspaces: ['kitchen'] } satisfies WorkerRouteData,
      },
      {
        path: 'cashier',
        title: 'Caja',
        loadComponent: () => import('@areas/cashier/cashier-area').then((m) => m.CashierArea),
        canActivate: [AreaGuard],
        data: { workerWorkspaces: ['cashier'] } satisfies WorkerRouteData,
      },
      {
        path: 'profile',
        title: 'Mi perfil',
        loadComponent: () => import('@shared/features/settings/settings').then((m) => m.Settings),
        canActivate: [AreaGuard],
        data: { anyWorker: true } satisfies WorkerRouteData,
      },
      {
        path: 'my-schedule',
        title: 'Mi horario',
        loadComponent: () =>
          import('@areas/worker/features/my-schedule/my-schedule').then((m) => m.MySchedule),
        canActivate: [AreaGuard],
        data: { anyWorker: true } satisfies WorkerRouteData,
      },
    ],
  },
  {
    path: 'cashier',
    pathMatch: 'full',
    redirectTo: '/worker/cashier',
  },
  {
    path: 'dev/ui',
    title: 'Design system',
    loadComponent: () => import('@shared/ui/gallery/gallery').then((m) => m.UiGallery),
    canMatch: [() => isDevMode()],
  },
  {
    path: '**',
    title: 'Página no encontrada',
    loadComponent: () =>
      import('@shared/components/not-found-page/not-found-page').then((m) => m.NotFoundPage),
  },
];
