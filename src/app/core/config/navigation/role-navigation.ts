/**
 * Single source of truth for role navigation and worker landing.
 *
 * Feature: One configuration drives every shell (admin, waiter, kitchen,
 * cashier) and every role redirect.
 *
 * Contract:
 *  - `ADMIN_NAV` is the admin shell menu (app-in-card + right rail).
 *  - Worker modules live in `worker-modules.ts`; this file derives the
 *    workspace matrix, landing priority and navigation from that registry.
 *  - Landing priority is declared per module (`priority`), so adding a module
 *    does not require touching guards, the shell or the login redirect.
 *
 * Pure functions only: guards, the login redirect and the error pages share
 * the exact same matrix, so it can be unit tested without TestBed.
 */
import type { AreaTypeValue } from '@models/dto/areas/area';
import type { UserInfo } from '@models/domain/user/user-info';

import type { NavItem, WorkerWorkspace } from './worker-modules';
import { WORKER_MODULES } from './worker-modules';

export type { NavItem, WorkerWorkspace } from './worker-modules';

export interface WorkerRouteData {
  /** Dispatch the worker to their landing screen. */
  readonly workerLanding?: true;
  /** Any authenticated worker may enter (profile, schedule). */
  readonly anyWorker?: true;
  /** Workspaces allowed to enter the route. Empty/absent means deny. */
  readonly workerWorkspaces?: readonly WorkerWorkspace[];
  /** Opt this entry screen into idle preloading (see SelectivePreloadingStrategy). */
  readonly preload?: boolean;
}

/** Navigation items per module, kept as a record for existing consumers. */
export const WORKER_NAV = Object.fromEntries(
  WORKER_MODULES.map((module) => [module.id, module.nav]),
) as unknown as Record<WorkerWorkspace, readonly NavItem[]>;

/** Landing route per module. */
export const WORKSPACE_HOME = Object.fromEntries(
  WORKER_MODULES.map((module) => [module.id, module.home]),
) as unknown as Record<WorkerWorkspace, string>;

/** Human label per module. */
export const WORKSPACE_LABEL = Object.fromEntries(
  WORKER_MODULES.map((module) => [module.id, module.label]),
) as unknown as Record<WorkerWorkspace, string>;

const WORKSPACE_AREAS: Readonly<Record<WorkerWorkspace, readonly AreaTypeValue[]>> =
  Object.fromEntries(
    WORKER_MODULES.map((module) => [module.id, module.areaTypes]),
  ) as unknown as Record<WorkerWorkspace, readonly AreaTypeValue[]>;

/** Multi-area landing priority, declared by each module. */
const WORKSPACE_PRIORITY: readonly WorkerWorkspace[] = [...WORKER_MODULES]
  .sort((left, right) => left.priority - right.priority)
  .map((module) => module.id);

export const ADMIN_NAV: readonly NavItem[] = [
  {
    id: 'dashboard',
    label: 'Inicio',
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
    id: 'schedules',
    label: 'Horarios',
    description: 'Planifica turnos y asistencia',
    icon: 'pi pi-calendar',
    routerLink: '/admin/schedules',
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
    id: 'settings',
    label: 'Ajustes',
    description: 'Preferencias del restaurante',
    icon: 'pi pi-cog',
    routerLink: '/admin/settings',
  },
];

/** Area types assigned to the user (empty when unauthenticated). */
export function userAreaTypes(user: Pick<UserInfo, 'areas'> | undefined): AreaTypeValue[] {
  return (user?.areas ?? []).flatMap((area) => (area.type ? [area.type] : []));
}

export function canAccessWorkspace(
  user: Pick<UserInfo, 'areas'> | undefined,
  workspace: string,
): boolean {
  if (!user) {
    return false;
  }
  const required = WORKSPACE_AREAS[workspace as WorkerWorkspace];
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
