import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ResourceCache } from '@app/core/cache/resource-cache';
import { Table } from '@app/core/services/tables/table';
import { Area } from '@app/core/services/areas/area';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';
import { AreaResponse } from '@app/shared/models/dto/areas/area.model';

export interface TablesAndAreasData {
  tables: TableResponse[];
  areas: AreaResponse[];
}

@Injectable({ providedIn: 'root' })
export class TablesCacheService {
  private readonly tableService = inject(Table);
  private readonly areaService = inject(Area);

  // Tables - TTL medio (5 min)
  readonly tables = new ResourceCache<TableResponse[]>(
    () => this.tableService.getTables(),
    { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Areas - TTL largo (30 min)
  readonly areas = new ResourceCache<AreaResponse[]>(
    () => this.areaService.getAreas(),
    { ttlMs: 30 * 60 * 1000, staleWhileRevalidate: true }
  );

  // Combined data - para uso en modales
  readonly tablesAndAreas = new ResourceCache<TablesAndAreasData>(
    () => forkJoin({
      tables: this.tableService.getTables(),
      areas: this.areaService.getAreas()
    }),
    { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true }
  );

  invalidateTables(): void {
    this.tables.invalidate();
    this.tablesAndAreas.invalidate();
  }

  invalidateAll(): void {
    this.tables.invalidate();
    this.areas.invalidate();
    this.tablesAndAreas.invalidate();
  }
}
