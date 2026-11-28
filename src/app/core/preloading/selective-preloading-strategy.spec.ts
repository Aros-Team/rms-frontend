/**
 * Tests for SelectivePreloadingStrategy.
 *
 * Feature: opt-in, authenticated, idle preloading of lazy routes.
 * Contract:
 *  - routes without `data: { preload: true }` never preload (opt-in only)
 *  - no `rms_access` cookie -> EMPTY, so the login screen downloads nothing
 *  - with a session and a normal connection, the loader runs after 3 s
 *  - Save-Data and 2G/slow-2G skip
 * Approach: stub `navigator.connection` and `document.cookie`, call `preload`,
 *           advance fake timers and assert whether the loader ran.
 */
import { firstValueFrom, of } from 'rxjs';

import { SelectivePreloadingStrategy } from './selective-preloading-strategy';

const PRELOAD_ROUTE = { path: 'products', data: { preload: true } };
const DELAY_MS = 3_000;

describe('SelectivePreloadingStrategy', () => {
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'connection');

  function withConnection(connection: unknown, authenticated = true): SelectivePreloadingStrategy {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: connection,
    });
    document.cookie = authenticated
      ? 'rms_access=test-token; path=/'
      : 'rms_access=; path=/; max-age=0';
    return new SelectivePreloadingStrategy();
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.cookie = 'rms_access=; path=/; max-age=0';
    if (original) {
      Object.defineProperty(Navigator.prototype, 'connection', original);
    } else {
      Reflect.deleteProperty(navigator, 'connection');
    }
  });

  it('preloads an opted-in route on a normal authenticated connection', async () => {
    const strategy = withConnection({ saveData: false, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));

    const result = firstValueFrom(strategy.preload(PRELOAD_ROUTE, load));

    expect(load).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DELAY_MS);

    await expect(result).resolves.toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('never preloads routes that do not opt in', () => {
    const strategy = withConnection({ saveData: false, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));
    const complete = vi.fn();

    strategy.preload({ path: 'products' }, load).subscribe({ complete });
    strategy.preload({ path: 'orders', data: { preload: false } }, load).subscribe({ complete });

    expect(load).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('does not warm admin chunks on the public login screen', () => {
    const strategy = withConnection({ saveData: false, effectiveType: '4g' }, false);
    const load = vi.fn().mockReturnValue(of(true));

    strategy.preload(PRELOAD_ROUTE, load).subscribe();

    expect(strategy.isAuthenticated()).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });

  it('skips when the user enabled Save-Data', () => {
    const strategy = withConnection({ saveData: true, effectiveType: '4g' });
    const load = vi.fn().mockReturnValue(of(true));
    const complete = vi.fn();

    strategy.preload(PRELOAD_ROUTE, load).subscribe({ complete });

    expect(load).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('skips on 2G connections', () => {
    for (const effectiveType of ['2g', 'slow-2g']) {
      const strategy = withConnection({ saveData: false, effectiveType });
      const load = vi.fn().mockReturnValue(of(true));

      strategy.preload(PRELOAD_ROUTE, load).subscribe();

      expect(load, effectiveType).not.toHaveBeenCalled();
    }
  });

  it('preloads when the Network Information API is unavailable', () => {
    const strategy = withConnection(undefined);

    expect(strategy.shouldPreload()).toBe(true);
    expect(strategy.isAuthenticated()).toBe(true);
  });
});
