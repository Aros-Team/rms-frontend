/**
 * Tests for the central role/navigation configuration.
 *
 * Feature: one module defines workspace membership, landing order and shell
 * navigation for every role.
 *
 * Contract:
 *  - area mapping: SERVICE/BAR → waiter, KITCHEN/GRILL → kitchen, CASH → cashier
 *  - landing priority: cashier > waiter > kitchen
 *  - multi-area workers keep access to every assigned workspace
 *  - the kitchen workspace has NO navigation (no waiter tabs on a TV)
 *  - admin labels are the corrected Spanish ones (Estadísticas)
 *
 * Approach: pure functions, no TestBed; assert exact workspace lists, routes
 * and nav ids.
 */
import type { UserInfo } from '@models/domain/user/user-info';
import type { AreaTypeValue } from '@models/dto/areas/area';
import {
  ADMIN_NAV,
  WORKER_NAV,
  canAccessWorkspace,
  homeRouteFor,
  isServiceWorker,
  primaryWorkerWorkspace,
  userAreaTypes,
  workerHome,
  workerWorkspaces,
} from './role-navigation';

function worker(...types: (AreaTypeValue | undefined)[]): UserInfo {
  return {
    id: 2,
    name: 'Beto',
    document: '2',
    email: 'beto@rms.test',
    role: 'WORKER',
    areas: types.map((type, index) => ({ id: index + 1, name: `Area ${String(index)}`, type })),
  };
}

const ADMIN: UserInfo = { ...worker(), id: 1, name: 'Ana', role: 'ADMIN' };

describe('role navigation config', () => {
  describe('userAreaTypes', () => {
    it('returns every assigned area and skips an area without a type', () => {
      expect(userAreaTypes(worker('SERVICE', undefined, 'GRILL'))).toEqual(['SERVICE', 'GRILL']);
    });

    it('returns an empty list for an undefined user', () => {
      expect(userAreaTypes(undefined)).toEqual([]);
    });
  });

  describe('workspace membership', () => {
    it('maps SERVICE and BAR to waiter', () => {
      expect(canAccessWorkspace(worker('SERVICE'), 'waiter')).toBe(true);
      expect(canAccessWorkspace(worker('BAR'), 'waiter')).toBe(true);
    });

    it('maps KITCHEN and GRILL to kitchen', () => {
      expect(canAccessWorkspace(worker('KITCHEN'), 'kitchen')).toBe(true);
      expect(canAccessWorkspace(worker('GRILL'), 'kitchen')).toBe(true);
    });

    it('maps CASH to cashier only', () => {
      expect(canAccessWorkspace(worker('CASH'), 'cashier')).toBe(true);
      expect(canAccessWorkspace(worker('CASH'), 'waiter')).toBe(false);
      expect(canAccessWorkspace(worker('CASH'), 'kitchen')).toBe(false);
    });

    it('returns false for an undefined user', () => {
      expect(canAccessWorkspace(undefined, 'waiter')).toBe(false);
    });
  });

  describe('landing', () => {
    it('orders multi-area landing as cashier > waiter > kitchen', () => {
      expect(workerWorkspaces(worker('KITCHEN', 'SERVICE', 'CASH'))).toEqual([
        'cashier',
        'waiter',
        'kitchen',
      ]);
    });

    it('resolves a CASH-only worker to the cashier home', () => {
      expect(workerHome(worker('CASH'))).toBe('/worker/cashier');
    });

    it('resolves a GRILL-only worker to the kitchen home', () => {
      expect(workerHome(worker('GRILL'))).toBe('/worker/kitchen');
    });

    it('returns null when the worker has no known area', () => {
      expect(primaryWorkerWorkspace(worker())).toBeNull();
      expect(workerHome(worker())).toBeNull();
    });
  });

  describe('homeRouteFor', () => {
    it('sends an ADMIN to /admin', () => {
      expect(homeRouteFor(ADMIN)).toBe('/admin');
    });

    it('sends a CASH worker to the cashier area, never to /worker', () => {
      expect(homeRouteFor(worker('CASH'))).toBe('/worker/cashier');
    });

    it('keeps /worker as the fallback for a worker without areas', () => {
      expect(homeRouteFor(worker())).toBe('/worker');
    });

    it('sends an anonymous visitor to /login', () => {
      expect(homeRouteFor(undefined)).toBe('/login');
    });
  });

  it('treats SERVICE and BAR as the service floor', () => {
    expect(isServiceWorker(worker('SERVICE'))).toBe(true);
    expect(isServiceWorker(worker('BAR'))).toBe(true);
    expect(isServiceWorker(worker('CASH'))).toBe(false);
  });

  describe('navigation', () => {
    it('gives the kitchen no navigation (no waiter tabs on a station)', () => {
      expect(WORKER_NAV.kitchen).toEqual([]);
    });

    it('drives the waiter tabs from query params on the waiter route', () => {
      expect(WORKER_NAV.waiter.map((item) => item.queryParams?.['tab'])).toEqual([
        'menu',
        'carta',
        'pedidos',
        undefined,
      ]);
      expect(WORKER_NAV.waiter.every((item) => item.routerLink.startsWith('/worker/'))).toBe(true);
    });

    it('gives the cashier a real cashier destination', () => {
      expect(WORKER_NAV.cashier[0]).toMatchObject({
        id: 'caja',
        routerLink: '/worker/cashier',
      });
    });

    it('keeps the admin sections with corrected Spanish labels', () => {
      expect(ADMIN_NAV.map((item) => item.id)).toEqual([
        'dashboard',
        'orders',
        'schedules',
        'manage',
        'analytics',
        'settings',
      ]);
      expect(ADMIN_NAV.find((item) => item.id === 'analytics')?.label).toBe('Estadísticas');
      expect(ADMIN_NAV.find((item) => item.id === 'settings')?.routerLink).toBe('/admin/settings');
      // Settings absorbed the old "Mi cuenta" screen: profile, password and
      // privacy live in the account section, so the nav item is gone.
      expect(ADMIN_NAV.find((item) => item.id === 'account')).toBeUndefined();
    });

    it('does not repeat an id inside a role menu', () => {
      for (const items of [ADMIN_NAV, ...Object.values(WORKER_NAV)]) {
        const ids = items.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });
});
