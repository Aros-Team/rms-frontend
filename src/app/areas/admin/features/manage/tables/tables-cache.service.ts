import { Injectable, inject, OnDestroy } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';

import { ResourceCache } from '@app/core/cache/resource-cache';
import { Table } from '@app/core/services/tables/table';
import { Area } from '@app/core/services/areas/area';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { TableResponse } from '@app/shared/models/dto/tables/table-response.model';
import { AreaResponse } from '@app/shared/models/dto/areas/area.model';
import { environment } from '@environments/environment';

export interface TablesAndAreasData {
  tables: TableResponse[];
  areas: AreaResponse[];
}

const WS_TOPICS = {
  tableStatus: '/topic/tables/status',
} as const;

@Injectable({ providedIn: 'root' })
export class TablesCacheService implements OnDestroy {
  private readonly tableService = inject(Table);
  private readonly areaService = inject(Area);
  private readonly wsService = inject(WebSocket);
  private readonly authService = inject(Auth);

  private wsSub?: Subscription;

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

  constructor() {
    this.connectWebSocket();
  }

  /**
   * Applies a real-time table update from WebSocket directly into all caches
   * that hold table data, without triggering any HTTP request.
   */
  applyTableUpdate(updated: TableResponse): void {
    const patchTables = (list: TableResponse[]): TableResponse[] =>
      list.map(t => t.id === updated.id ? { ...t, ...updated } : t);

    this.tables.patchData(patchTables);

    this.tablesAndAreas.patchData(data => ({
      ...data,
      tables: patchTables(data.tables),
    }));
  }

  invalidateTables(): void {
    this.tables.invalidate();
    this.tablesAndAreas.invalidate();
  }

  invalidateAll(): void {
    this.tables.invalidate();
    this.areas.invalidate();
    this.tablesAndAreas.invalidate();
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) return;

    this.wsService.connect(environment.wsUrl, token);

    this.wsSub = this.wsService
      .subscribeToTopic<TableResponse>(WS_TOPICS.tableStatus)
      .subscribe((updated) => {
        this.applyTableUpdate(updated);
      });
  }
}
