/**
 * Reads the configured labor-cost mode for the recipe page.
 *
 * `labor_cost_mode` (`AUTO | REAL | STANDARD`) is stored in the general
 * configuration group, but there is no typed labor-settings endpoint yet
 * (P4-SET-04) and the costing service ignores it: `ProductCostResponse`
 * always uses the area's real hourly rate for the period. This service exposes
 * the configured value so the page can state it honestly instead of inventing
 * an endpoint or pretending the mode changes the number.
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export type LaborCostMode = 'AUTO' | 'REAL' | 'STANDARD';

interface ConfigEntryResponse {
  key: string;
  value: string;
}

interface ConfigGroupResponse {
  entries: ConfigEntryResponse[];
}

const LABOR_MODE_KEY = 'labor_cost_mode';

@Injectable({ providedIn: 'root' })
export class RecipeLaborMode {
  private readonly http = inject(HttpClient);

  /**
   * Returns the configured mode, or `null` when the configuration endpoint is
   * unavailable or the entry is missing. The page renders "No disponible"
   * rather than failing the whole load for a decorative setting.
   */
  load(): Observable<string | null> {
    return this.http.get<ConfigGroupResponse[]>('v1/config').pipe(
      map((groups) => {
        for (const group of groups) {
          for (const entry of group.entries) {
            if (entry.key === LABOR_MODE_KEY) return entry.value.trim();
          }
        }
        return null;
      }),
      catchError(() => of(null)),
    );
  }
}

/** Spanish label for the configured mode; unknown values render verbatim. */
export function laborModeLabel(mode: string | null): string {
  switch (mode) {
    case null:
    case '':
      return 'No disponible';
    case 'AUTO':
      return 'Automático (AUTO)';
    case 'REAL':
      return 'Real (REAL)';
    case 'STANDARD':
      return 'Estándar (STANDARD)';
    default:
      return mode;
  }
}
