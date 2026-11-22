/**
 * Single source of truth for role navigation and worker landing.
 *
 * Feature: One configuration drives every shell (admin, waiter, kitchen,
 * cashier) and every role redirect.
 *
 * Contract:
 *  - `ADMIN_NAV` is the admin shell menu (app-in-card + right rail).
 *  - `WORKER_NAV` maps each worker workspace to its navigation items; the
 *    kitchen workspace has no navigation (a station board has no tabs).
 *  - Workspace membership comes from the API area types:
 *      waiter  -> SERVICE | BAR
 *      kitchen -> KITCHEN | GRILL
 *      cashier -> CASH
 *  - Landing priority for multi-area workers is cashier > waiter > kitchen,
 *    so a CASH worker always reaches the cashier area instead of the waiter
 *    home.
 *
 * Pure functions only: guards, the login redirect and the error pages share
 * the exact same matrix, so it can be unit tested without TestBed.
 */
import type { AreaTypeValue } from '@models/dto/areas/area';
import type { UserInfo } from '@models/domain/user/user-info';

export type WorkerWorkspace = 'waiter' | 'kitchen' | 'cashier';

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly routerLink: string;
  readonly exact?: boolean;
  readonly queryParams?: Readonly<Record<string, string>>;
}

/** Route `data` contract consumed by `AreaGuard`. */
export interface WorkerRouteData {
  /** Dispatch the worker to their landing screen. */
  readonly workerLanding?: true;
  /** Any authenticated worker may enter (profile, schedule). */
  readonly anyWorker?: true;
  /** Workspaces allowed to enter the route. Empty/absent means deny. */
  readonly workerWorkspaces?: readonly WorkerWorkspace[];
}

const WORKSPACE_AREAS: Readonly<Record<WorkerWorkspace, readonly AreaTypeValue[]>> = {
  cashier: ['CASH'],
  waiter: ['SERVICE', 'BAR'],
  kitchen: ['KITCHEN', 'GRILL'],
};

/** Multi-area landing priority. CASH first: it has nowhere else to go. */
const WORKSPACE_PRIORITY: readonly WorkerWorkspace[] = ['cashier', 'waiter', 'kitchen'];

export const WORKSPACE_HOME: Readonly<Record<WorkerWorkspace, string>> = {
  waiter: '/worker/waiter',
  kitchen: '/worker/kitchen',
  cashier: '/worker/cashier',
};

export const WORKSPACE_LABEL: Readonly<Record<WorkerWorkspace, string>> = {
  waiter: 'Servicio de mesa',
  kitchen: 'Cocina',
  cashier: 'Caja',
};

export const ADMIN_NAV: readonly NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Vista general del restaurante',
    icon: 'pi pi-home',
    routerLink: '/admin',
    exact: true,
  },
  {
    id: 'orders',
    label: 'Pedidos',
    description: 'Gestiona los pedidos del día',
    icon: 'pi pi-shopping-cart',
    routerLink: '/admin/orders',
  },
  {
    id: 'manage',
    label: 'Restaurante',
    description: 'Gestiona tu restaurante',
    icon: 'pi pi-shop',
    routerLink: '/admin/manage',
  },
  {
    id: 'analytics',
    label: 'Estadísticas',
    description: 'Analiza el rendimiento',
    icon: 'pi pi-chart-bar',
    routerLink: '/admin/analytics',
  },
  {
    id: 'profile',
    label: 'Configuración',
    description: 'Ajustes de cuenta',
    icon: 'pi pi-cog',
    routerLink: '/admin/profile',
  },
];

export const WORKER_NAV: Readonly<Record<WorkerWorkspace, readonly NavItem[]>> = {
  waiter: [
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
  kitchen: [],
  cashier: [
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
};

/** Area types assigned to the user (empty when unauthenticated). */
export function userAreaTypes(user: Pick<UserInfo, 'areas'> | undefined): AreaTypeValue[] {
  return (user?.areas ?? []).flatMap((area) => (area.type ? [area.type] : []));
}

export function canAccessWorkspace(
  user: Pick<UserInfo, 'areas'> | undefined,
  workspace: WorkerWorkspace,
): boolean {
  if (!user) {
    return false;
  }
  const required = WORKSPACE_AREAS[workspace];
  return userAreaTypes(user).some((type) => required.includes(type));
}

/** Every workspace the user may enter, ordered by landing priority. */
export function workerWorkspaces(user: Pick<UserInfo, 'areas'> | undefined): WorkerWorkspace[] {
  return WORKSPACE_PRIORITY.filter((workspace) => canAccessWorkspace(user, workspace));
}

/** Workspace the user lands on, or `null` when they have no known area. */
export function primaryWorkerWorkspace(
  user: Pick<UserInfo, 'areas'> | undefined,
): WorkerWorkspace | null {
  return workerWorkspaces(user)[0] ?? null;
}

/** Landing route for a worker, or `null` when they have no known area. */
export function workerHome(user: Pick<UserInfo, 'areas'> | undefined): string | null {
  const workspace = primaryWorkerWorkspace(user);
  return workspace ? WORKSPACE_HOME[workspace] : null;
}

/** Whether the user works the service floor (waiter / bar). */
export function isServiceWorker(user: Pick<UserInfo, 'areas'> | undefined): boolean {
  return canAccessWorkspace(user, 'waiter');
}

/**
 * Landing route for any authenticated user. Workers always go to their own
 * area (never the generic `/worker` index), so a CASH worker cannot bounce
 * through the waiter home.
 */
export function homeRouteFor(user: UserInfo | undefined): string {
  if (!user) {
    return '/login';
  }
  if (user.role === 'ADMIN') {
    return '/admin';
  }
  return workerHome(user) ?? '/worker';
}
