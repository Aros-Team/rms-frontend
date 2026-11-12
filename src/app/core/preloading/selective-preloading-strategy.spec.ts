/**
 * Tests for SelectivePreloadingStrategy.
 *
 * Feature: Lazy-route preloading that backs off on constrained connections.
 * Contract: preloads on a normal connection; skips when the user enabled
 *           Save-Data or the connection reports 2G/slow-2G; returns EMPTY
 *           (never calls `load`) when skipping.
 * Approach: Stub `navigator.connection`, call `preload`, assert whether the
 *           loader ran. This is the decision that decides whether the app
 *           downloads ~1 MB of extra chunks.
 */
import { of } from 'rxjs';

import { SelectivePreloadingStrategy } from './selective-preloading-strategy';

describe('SelectivePreloadingStrategy', () => {
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'connection');

  function withConnection(connection: unknown): SelectivePreloadingStrategy {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: connection,
    });
    return new SelectivePreloadingStrategy();
  }

  afterEach(() => {
    if (original) {
      Object.defineProperty(Navigator.prototype, 'connection', original);
    } else {
      Reflect.deleteProperty(navigator, 'connection');
    }
  });

  it('should preload on a normal connection', () => {
    const strategy = withConnection({ saveData: false, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));

    strategy.preload({ path: 'products' }, load).subscribe();

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('should skip when the user enabled Save-Data', () => {
    const strategy = withConnection({ saveData: true, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));

    strategy.preload({ path: 'products' }, load).subscribe();

    expect(load).not.toHaveBeenCalled();
  });

  it('should skip on 2G connections', () => {
    for (const effectiveType of ['2g', 'slow-2g']) {
      const strategy = withConnection({ saveData: false, effectiveType });
      const load = vi.fn().mockReturnValue(of(true));

      strategy.preload({ path: 'products' }, load).subscribe();

      expect(load, effectiveType).not.toHaveBeenCalled();
    }
  });

  it('should preload when the Network Information API is unavailable', () => {
    const strategy = withConnection(undefined);

    expect(strategy.shouldPreload()).toBe(true);
  });
});
