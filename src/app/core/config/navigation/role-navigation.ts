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
import type { AreaActivityValue } from '@models/dto/areas/area';
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

const WORKSPACE_ACTIVITIES: Readonly<Record<WorkerWorkspace, readonly AreaActivityValue[]>> =
  Object.fromEntries(
    WORKER_MODULES.map((module) => [module.id, module.activities]),
  ) as unknown as Record<WorkerWorkspace, readonly AreaActivityValue[]>;

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
    id: 'equipo',
    label: 'Equipo',
    description: 'Empleados, horarios, asistencia y nómina',
    icon: 'pi pi-users',
    routerLink: '/admin/team',
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

/** Activities assigned to the user (empty when unauthenticated). */
export function userActivities(user: Pick<UserInfo, 'areas' | 'areaActivities'> | undefined): AreaActivityValue[] {
  const explicit = (user?.areaActivities ?? []).flatMap((assignment) =>
    assignment.activities.filter(
      (activity): activity is AreaActivityValue =>
        activity === 'PREPARATION' || activity === 'SERVE' || activity === 'CASH',
    ),
  );
  if (explicit.length > 0) return [...new Set(explicit)];
  const fromAreas = (user?.areas ?? []).flatMap((area) => area.activities ?? []);
  if (fromAreas.length > 0) return [...new Set(fromAreas)];
  return [
    ...new Set(
      (user?.areas ?? [])
        .map((area) => (area as { type?: string }).type)
        .map(legacyActivity)
        .filter((activity): activity is AreaActivityValue => activity !== null),
    ),
  ];
}

function legacyActivity(type: string | undefined): AreaActivityValue | null {
  switch (type) {
    case 'KITCHEN':
    case 'GRILL':
    case 'PREPARATION':
      return 'PREPARATION';
    case 'SERVICE':
    case 'BAR':
    case 'SERVE':
      return 'SERVE';
    case 'CASH':
      return 'CASH';
    default:
      return null;
  }
}

/** Legacy alias kept for the old area-type tests. */
export function userAreaTypes(user: Pick<UserInfo, 'areas' | 'areaActivities'> | undefined): string[] {
  return (user?.areas ?? []).map((area) => (area as { type?: string }).type).filter((value): value is string => !!value);
}

export function canAccessWorkspace(
  user: Pick<UserInfo, 'areas' | 'areaActivities'> | undefined,
  workspace: string,
): boolean {
  if (!user) {
    return false;
  }
  const required = WORKSPACE_ACTIVITIES[workspace as WorkerWorkspace];
  return userActivities(user).some((activity) => required.includes(activity));
}

/** Every workspace the user may enter, ordered by landing priority. */
export function workerWorkspaces(user: Pick<UserInfo, 'areas' | 'areaActivities'> | undefined): WorkerWorkspace[] {
  return WORKSPACE_PRIORITY.filter((workspace) => canAccessWorkspace(user, workspace));
}

/** Workspace the user lands on, or `null` when they have no known area. */
export function primaryWorkerWorkspace(
  user: Pick<UserInfo, 'areas' | 'areaActivities'> | undefined,
): WorkerWorkspace | null {
  return workerWorkspaces(user)[0] ?? null;
}

/** Landing route for a worker, or `null` when they have no known area. */
export function workerHome(user: Pick<UserInfo, 'areas' | 'areaActivities'> | undefined): string | null {
  const workspace = primaryWorkerWorkspace(user);
  return workspace ? WORKSPACE_HOME[workspace] : null;
}

/** Whether the user works the service floor (waiter / bar). */
export function isServiceWorker(user: Pick<UserInfo, 'areas' | 'areaActivities'> | undefined): boolean {
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
