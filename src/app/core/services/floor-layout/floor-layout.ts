import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import type {
  FloorLayout,
  FloorLayoutMap,
  FloorLayoutRequest,
  FloorTablePlacement,
} from '@app/shared/models/dto/floor-layout/floor-layout';

/** HTTP boundary for `/v1/floor-layout`. */
@Injectable({ providedIn: 'root' })
export class FloorLayoutApi {
  private readonly http = inject(HttpClient);

  getLayout(): Observable<FloorLayout> {
    return this.http.get<FloorLayout>('v1/floor-layout');
  }

  /** Read-only map for operational staff, including placed tables. */
  getMap(): Observable<FloorLayoutMap> {
    return this.http.get<FloorLayoutMap>('v1/floor-layout/map');
  }

  updateLayout(layout: FloorLayoutRequest): Observable<FloorLayout> {
    return this.http.put<FloorLayout>('v1/floor-layout', layout);
  }

  getTablePlacements(): Observable<FloorTablePlacement[]> {
    return this.http.get<FloorTablePlacement[]>('v1/floor-layout/tables');
  }

  updateTablePlacements(
    placements: readonly FloorTablePlacement[],
  ): Observable<FloorTablePlacement[]> {
    return this.http.put<FloorTablePlacement[]>('v1/floor-layout/tables', placements);
  }
}
