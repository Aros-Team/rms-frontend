import { Injectable } from '@angular/core';
import { Route, PreloadingStrategy } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';

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
 * data or the connection reports 2G.
 */
@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(_route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return this.shouldPreload() ? load() : EMPTY;
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
