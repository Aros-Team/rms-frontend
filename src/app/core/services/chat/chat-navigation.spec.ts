import { describe, expect, it } from 'vitest';

import { resolveAgentNavigation } from './chat-navigation';

describe('resolveAgentNavigation', () => {
  it('maps a section screen to its admin route', () => {
    expect(resolveAgentNavigation({ screen: 'products' })).toEqual({
      commands: ['/admin/manage/products'],
      queryParams: undefined,
      label: 'Productos',
    });
  });

  it('carries the search text as a query param', () => {
    expect(resolveAgentNavigation({ screen: 'products', query: '  Pizza  ' })).toEqual({
      commands: ['/admin/manage/products'],
      queryParams: { search: 'Pizza' },
      label: 'Productos',
    });
  });

  it('opens the product recipe when an entity id is known', () => {
    expect(
      resolveAgentNavigation({ screen: 'product_recipe', entity_id: 42 }),
    ).toEqual({
      commands: ['/admin/manage/products', 42, 'recipe'],
      label: 'Receta del producto',
    });
  });

  it('falls back to the searchable list when the recipe lacks an id', () => {
    expect(
      resolveAgentNavigation({ screen: 'product_recipe', query: 'Lasaña' }),
    ).toEqual({
      commands: ['/admin/manage/products'],
      queryParams: { search: 'Lasaña' },
      label: 'Productos',
    });
  });

  it('passes search and tab to the workers screen', () => {
    expect(
      resolveAgentNavigation({ screen: 'workers', query: 'Ana', tab: 'payroll' }),
    ).toEqual({
      commands: ['/admin/manage/workers'],
      queryParams: { search: 'Ana', tab: 'payroll' },
      label: 'Trabajadores',
    });
  });

  it('opens the salary history for a concrete employee', () => {
    expect(
      resolveAgentNavigation({ screen: 'salary_history', entity_id: 7 }),
    ).toEqual({
      commands: ['/admin/manage/workers', 7, 'salary-history'],
      label: 'Historial salarial',
    });
  });

  it('deep-links the schedules tab', () => {
    expect(resolveAgentNavigation({ screen: 'schedules', tab: 'registros' })).toEqual({
      commands: ['/admin/schedules'],
      queryParams: { tab: 'registros' },
      label: 'Horarios',
    });
  });

  it('routes each analytics sub-screen', () => {
    expect(resolveAgentNavigation({ screen: 'analytics_prime_cost' })?.commands).toEqual([
      '/admin/analytics/prime-cost',
    ]);
    expect(resolveAgentNavigation({ screen: 'analytics_menu' })?.commands).toEqual([
      '/admin/analytics/menu-engineering',
    ]);
    expect(resolveAgentNavigation({ screen: 'analytics_alerts' })?.commands).toEqual([
      '/admin/analytics/alerts',
    ]);
  });

  it('rejects unknown screens instead of navigating somewhere arbitrary', () => {
    expect(resolveAgentNavigation({ screen: 'not-a-screen' })).toBeNull();
    expect(resolveAgentNavigation({ screen: '' })).toBeNull();
  });
});
