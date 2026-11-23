/**
 * Tests for SelectivePreloadingStrategy.
 *
 * Feature: Lazy-route preloading that backs off on constrained connections and
 *          defers the download until after the current route settled.
 * Contract: preloads after a 2 s delay on a normal connection; skips when the
 *           user enabled Save-Data, the connection reports 2G/slow-2G, or the
 *           route declares `data: { preload: false }`; returns EMPTY (never
 *           calls `load`) when skipping.
 * Approach: Stub `navigator.connection`, call `preload`, advance fake timers
 *           and assert whether the loader ran. This is the decision that
 *           decides whether the app downloads ~1 MB of extra chunks.
 */
import { firstValueFrom, of } from 'rxjs';

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

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (original) {
      Object.defineProperty(Navigator.prototype, 'connection', original);
    } else {
      Reflect.deleteProperty(navigator, 'connection');
    }
  });

  it('should preload on a normal connection after the delay', async () => {
    const strategy = withConnection({ saveData: false, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));

    const result = firstValueFrom(strategy.preload({ path: 'products' }, load));

    // Deferred: nothing is fetched while the current route is still loading.
    expect(load).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('should skip when the user enabled Save-Data', () => {
    const strategy = withConnection({ saveData: true, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));
    const complete = vi.fn();

    strategy.preload({ path: 'products' }, load).subscribe({ complete });

    expect(load).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('should skip on 2G connections', () => {
    for (const effectiveType of ['2g', 'slow-2g']) {
      const strategy = withConnection({ saveData: false, effectiveType });
      const load = vi.fn().mockReturnValue(of(true));

      strategy.preload({ path: 'products' }, load).subscribe();

      expect(load, effectiveType).not.toHaveBeenCalled();
    }
  });

  it('should skip routes that opt out with data.preload === false', () => {
    const strategy = withConnection({ saveData: false, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));
    const complete = vi.fn();

    strategy
      .preload({ path: 'products', data: { preload: false } }, load)
      .subscribe({ complete });

    expect(load).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('should preload routes that keep the default preload flag', async () => {
    const strategy = withConnection({ saveData: false, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));

    const result = firstValueFrom(
      strategy.preload({ path: 'products', data: { preload: true } }, load),
    );
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('should preload when the Network Information API is unavailable', () => {
    const strategy = withConnection(undefined);

    expect(strategy.shouldPreload()).toBe(true);
  });
});
