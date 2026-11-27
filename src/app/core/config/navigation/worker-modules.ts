import type { Type } from '@angular/core';

import type { AreaActivityValue } from '@models/dto/areas/area';

/** One destination inside a worker module's navigation. */
export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly routerLink: string;
  readonly exact?: boolean;
  readonly queryParams?: Readonly<Record<string, string>>;
}

/**
 * A pluggable worker module.
 *
 * Adding a module is a single entry here: the route table, the area guard, the
 * landing priority, the shell navigation and the module switcher all derive
 * from this registry. Removing an entry removes the module everywhere.
 */
export interface WorkerModuleDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  /** Browser tab title for the module route. */
  readonly title: string;
  /** Activities that grant access to this module. */
  readonly activities: readonly AreaActivityValue[];
  /** Landing route of the module, e.g. `/worker/kitchen`. */
  readonly home: string;
  /** Additional route prefixes owned by the module (detail screens). */
  readonly extraPaths?: readonly string[];
  /** Lower runs first when a worker can access several modules. */
  readonly priority: number;
  /** Opt this entry screen into idle preloading. */
  readonly preload: boolean;
  readonly nav: readonly NavItem[];
  readonly loadComponent: () => Promise<Type<unknown>>;
}

export const WORKER_MODULES = [
  {
    id: 'cashier',
    label: 'Caja',
    description: 'Cobros y turno de caja',
    icon: 'pi pi-wallet',
    title: 'Caja',
    activities: ['CASH'],
    home: '/worker/cashier',
    priority: 0,
    preload: false,
    nav: [
      {
        id: 'caja',
        label: 'Caja',
        description: 'Cobros y turno de caja',
        icon: 'pi pi-wallet',
        routerLink: '/worker/cashier',
        exact: true,
      },
      {
        id: 'cuenta',
        label: 'Cuenta',
        description: 'Ajustes de cuenta',
        icon: 'pi pi-user',
        routerLink: '/worker/profile',
      },
    ],
    loadComponent: () =>
      import('@areas/cashier/cashier-area').then((m) => m.CashierArea),
  },
  {
    id: 'waiter',
    label: 'Servicio de mesa',
    description: 'Menú, carta y pedidos',
    icon: 'pi pi-bell',
    title: 'Tomar pedidos',
    activities: ['SERVE'],
    home: '/worker/waiter',
    extraPaths: ['/worker/combos'],
    priority: 1,
    preload: true,
    nav: [
      {
        id: 'menu',
        label: 'Menú',
        description: 'Menú del día',
        icon: 'pi pi-sun',
        routerLink: '/worker/waiter',
        exact: true,
        queryParams: { tab: 'menu' },
      },
      {
        id: 'carta',
        label: 'Carta',
        description: 'Seleccionar productos',
        icon: 'pi pi-book',
        routerLink: '/worker/waiter',
        exact: true,
        queryParams: { tab: 'carta' },
      },
      {
        id: 'pedidos',
        label: 'Pedidos',
        description: 'Pedidos del día',
        icon: 'pi pi-list',
        routerLink: '/worker/waiter',
        exact: true,
        queryParams: { tab: 'pedidos' },
      },
      {
        id: 'cuenta',
        label: 'Cuenta',
        description: 'Ajustes de cuenta y horario',
        icon: 'pi pi-user',
        routerLink: '/worker/profile',
      },
    ],
    loadComponent: () =>
      import('@areas/worker/features/waiter/waiter-dashboard/waiter-dashboard').then(
        (m) => m.WaiterDashboard,
      ),
  },
  {
    id: 'kitchen',
    label: 'Preparación',
    description: 'Estación de preparación',
    icon: 'pi pi-th-large',
    title: 'Preparación',
    activities: ['PREPARATION'],
    home: '/worker/kitchen',
    priority: 2,
    preload: true,
    nav: [],
    loadComponent: () =>
      import('@areas/worker/features/kitchen/kitchen').then((m) => m.Kitchen),
  },
] as const satisfies readonly WorkerModuleDefinition[];

export type WorkerWorkspace = (typeof WORKER_MODULES)[number]['id'];

/** Registry entry for a module id, if it exists. */
export function workerModule(id: string): WorkerModuleDefinition | null {
  return WORKER_MODULES.find((module) => module.id === id) ?? null;
}

/** Registry entry whose `home` or route prefix owns the URL, if any. */
export function moduleForUrl(url: string): WorkerModuleDefinition | null {
  const path = url.split('?')[0] ?? '';
  return (
    WORKER_MODULES.find((module) => {
      const extraPaths =
        (module as { extraPaths?: readonly string[] }).extraPaths ?? [];
      return (
        path === module.home ||
        path.startsWith(`${module.home}/`) ||
        extraPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
      );
    }) ?? null
  );
}
