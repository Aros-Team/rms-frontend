import { Injectable, inject } from '@angular/core';
import { Params, Router } from '@angular/router';

import { ChatNavigation } from './chat.models';

/** A navigation intent resolved to an Angular router target. */
export interface ResolvedAgentNavigation {
  readonly commands: readonly (string | number)[];
  readonly queryParams?: Params;
  readonly label: string;
}

const SCREEN_LABELS: Readonly<Record<string, string>> = {
  dashboard: 'Panel principal',
  orders: 'Pedidos',
  create_order: 'Crear pedido',
  products: 'Productos',
  product_recipe: 'Receta del producto',
  create_product: 'Nuevo producto',
  categories: 'Categorías',
  areas: 'Áreas',
  tables: 'Mesas',
  combos: 'Combos',
  inventory: 'Inventario',
  workers: 'Trabajadores',
  salary_history: 'Historial salarial',
  schedules: 'Horarios',
  attendance: 'Asistencia',
  payroll: 'Nómina',
  analytics: 'Estadísticas',
  analytics_prime_cost: 'Costo primo',
  analytics_menu: 'Ingeniería de menú',
  analytics_operations: 'Operación',
  analytics_cohort: 'Cohortes',
  analytics_alerts: 'Alertas',
  settings: 'Ajustes',
};

/**
 * Pure resolver: turns the agent's screen key into a router target.
 *
 * Kept free of Angular DI so it can be unit tested with plain objects. Returns
 * `null` for unknown screens instead of navigating somewhere arbitrary.
 */
export function resolveAgentNavigation(action: ChatNavigation): ResolvedAgentNavigation | null {
  const screen = action.screen.trim().toLowerCase();
  const label = SCREEN_LABELS[screen];
  if (!screen || !label) {
    return null;
  }

  const query = action.query?.trim() ?? undefined;
  const tab = action.tab?.trim() ?? undefined;
  const entityId = Number(action.entity_id);
  const hasEntity = Number.isInteger(entityId) && entityId > 0;

  const withQuery = (
    params: Record<string, string | null | undefined>,
  ): Params | undefined => {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        clean[key] = value;
      }
    }
    return Object.keys(clean).length > 0 ? clean : undefined;
  };

  switch (screen) {
    case 'dashboard':
      return { commands: ['/admin'], label };
    case 'orders':
      return { commands: ['/admin/orders'], label };
    case 'create_order':
      return { commands: ['/admin/manage/orders-create'], label };
    case 'products':
      return {
        commands: ['/admin/manage/products'],
        queryParams: withQuery({ search: query }),
        label,
      };
    case 'product_recipe':
      if (hasEntity) {
        return { commands: ['/admin/manage/products', entityId, 'recipe'], label };
      }
      return {
        commands: ['/admin/manage/products'],
        queryParams: withQuery({ search: query }),
        label: SCREEN_LABELS['products'],
      };
    case 'create_product':
      return { commands: ['/admin/create-product'], label };
    case 'categories':
      return { commands: ['/admin/manage/categories'], label };
    case 'areas':
      return { commands: ['/admin/manage/areas'], label };
    case 'tables':
      return { commands: ['/admin/manage/tables'], label };
    case 'combos':
      return { commands: ['/admin/manage/combos'], label };
    case 'inventory':
      return { commands: ['/admin/manage/inventory'], label };
    case 'workers':
      return {
        commands: ['/admin/team/workers'],
        queryParams: withQuery({ search: query }),
        label,
      };
    case 'salary_history':
      if (hasEntity) {
        return { commands: ['/admin/team/workers', entityId, 'salary-history'], label };
      }
      return {
        commands: ['/admin/team/workers'],
        queryParams: withQuery({ search: query }),
        label: SCREEN_LABELS['workers'],
      };
    case 'schedules':
      return {
        commands: ['/admin/team/schedules'],
        queryParams: withQuery({ tab }),
        label,
      };
    case 'attendance':
      return { commands: ['/admin/team/attendance'], label };
    case 'payroll':
      return { commands: ['/admin/team/payroll'], label };
    case 'analytics':
      return { commands: ['/admin/analytics'], label };
    case 'analytics_prime_cost':
      return { commands: ['/admin/analytics/prime-cost'], label };
    case 'analytics_menu':
      return { commands: ['/admin/analytics/menu-engineering'], label };
    case 'analytics_operations':
      return { commands: ['/admin/analytics/operations'], label };
    case 'analytics_cohort':
      return { commands: ['/admin/analytics/cohort'], label };
    case 'analytics_alerts':
      return { commands: ['/admin/analytics/alerts'], label };
    case 'settings':
      return { commands: ['/admin/settings'], label };
    default:
      return null;
  }
}

/** Executes the navigation intents emitted by the assistant. */
@Injectable({ providedIn: 'root' })
export class AgentNavigation {
  private readonly router = inject(Router);

  /**
   * Moves the UI to the screen requested by the assistant.
   *
   * @returns the human label of the destination, or `null` when the screen is
   *          unknown or the navigation was cancelled.
   */
  async navigate(action: ChatNavigation): Promise<string | null> {
    const target = resolveAgentNavigation(action);
    if (!target) {
      return null;
    }
    const navigated = await this.router.navigate([...target.commands], {
      queryParams: target.queryParams,
    });
    return navigated ? target.label : null;
  }
}
