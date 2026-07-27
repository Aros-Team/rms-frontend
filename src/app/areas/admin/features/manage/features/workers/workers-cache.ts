import { Injectable, inject } from '@angular/core';
import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Worker } from '@app/core/services/workers/worker';
import { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';

@Injectable({ providedIn: 'root' })
export class WorkersCache {
  private readonly workerService = inject(Worker);

  readonly workers = new ResourceCache<WorkerResponse[]>(
    () => this.workerService.getWorkers(),
    { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
  );

  invalidateWorkers(): void {
    this.workers.invalidate();
  }
}
