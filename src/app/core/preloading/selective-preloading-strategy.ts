import { Injectable } from '@angular/core';
import { Route, PreloadingStrategy } from '@angular/router';
import { EMPTY, Observable, switchMap, timer } from 'rxjs';

/** Delay before background preloading starts, so it never races the route. */
const PRELOAD_DELAY_MS = 3_000;

/** Network Information API subset we care about (not in lib.dom yet). */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Opt-in, authenticated, idle preloading.
 *
 * History: `PreloadAllModules` fetched all 144 lazy chunks (>2.8 MB) after boot.
 * A first fix deferred it 2 s and added `data: { preload: false }`, but it was
 * still default-on: a Lighthouse run measured 132 JS requests on the public
 * login screen and a 7.5 s LCP on the dashboard, because every admin/worker
 * chunk competed with the current route.
 *
 * Current contract: preload only when
 *  - the route opts in with `data: { preload: true }` (four entry screens),
 *  - a session cookie exists (never warm admin/worker chunks on login), and
 *  - the connection is not Save-Data / 2G.
 *
 * The load itself is deferred so it never competes with the current route.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.data?.['preload'] !== true) {
      return EMPTY;
    }

    if (!this.isAuthenticated() || !this.shouldPreload()) {
      return EMPTY;
    }

    return timer(PRELOAD_DELAY_MS).pipe(switchMap(() => load()));
  }

  /** Exposed for tests and for callers that want to log the decision. */
  shouldPreload(): boolean {
    const connection = (
      navigator as Navigator & { connection?: NetworkInformation }
    ).connection;

    if (connection?.saveData === true) {
      return false;
    }

    const effectiveType = connection?.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return false;
    }

    return true;
  }

  /** A session cookie is the only signal available before the router runs. */
  isAuthenticated(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    return /(^| )rms_access=/.test(document.cookie);
  }
}
