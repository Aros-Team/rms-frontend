import { Injectable } from '@angular/core';
import { Route, PreloadingStrategy } from '@angular/router';
import { EMPTY, Observable, switchMap, timer } from 'rxjs';

/** Delay before background preloading starts, so it never races the route. */
const PRELOAD_DELAY_MS = 2_000;

/** Network Information API subset we care about (not in lib.dom yet). */
interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Preloads lazy routes only when it is cheap to do so.
 *
 * `PreloadAllModules` fetched every lazy chunk (78 of them, >1 MB) right after
 * boot, including on tablets on metered mobile data. This keeps the same
 * behaviour on a normal connection and skips it when the user asked to save
 * data, the connection reports 2G, or the route opted out with
 * `data: { preload: false }`.
 *
 * The load itself is deferred: starting on subscription would compete with the
 * current route's own data requests during the first paint.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!this.shouldPreload() || route.data?.['preload'] === false) {
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
}
