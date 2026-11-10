import { Injectable, inject } from '@angular/core';

import { ResourceCache } from '@app/core/cache/resource-cache/resource-cache';
import { Payroll } from '@app/core/services/payroll/payroll';

import { PayrollResponse } from '@models/dto/payroll/payroll-response';
import { PayrollEventResponse } from '@models/dto/payroll/payroll-event-response';
import { PayrollSettlementResponse } from '@models/dto/payroll/payroll-settlement-response';

/** Cache TTL for payroll data — money changes as soon as an admin settles. */
const PAYROLL_TTL_MS = 2 * 60 * 1000;

/**
 * `ResourceCache` wrappers for payroll data.
 *
 * Mirrors the pattern already used by `WorkersCache` and `AnalyticsCache`: one
 * `ResourceCache` per query, lazily created per key when the query needs
 * parameters (`period`, `worker`). Caches are keyed by the exact query, so
 * switching the visible month never shows the previous month's numbers.
 *
 * Mutations must call `invalidate*()` afterwards (see
 * `docs/architecture.md` §10.7).
 */
@Injectable({ providedIn: 'root' })
export class PayrollCache {
  private readonly api = inject(Payroll);

  /** Every payroll record, unfiltered (`GET /v1/payroll`). */
  readonly payrolls = new ResourceCache<PayrollResponse[]>(() => this.api.getAllPayrolls(), {
    ttlMs: PAYROLL_TTL_MS,
    staleWhileRevalidate: true,
  });

  private readonly periodCaches = new Map<string, ResourceCache<PayrollResponse[]>>();
  private readonly workerCaches = new Map<string, ResourceCache<PayrollResponse[]>>();
  private readonly eventCaches = new Map<string, ResourceCache<PayrollEventResponse[]>>();
  private readonly settlementCaches = new Map<string, ResourceCache<PayrollSettlementResponse[]>>();

  /** Payroll records of one month (`GET /v1/payroll/{year}/{month}`). */
  period(year: number, month: number): ResourceCache<PayrollResponse[]> {
    const key = `${String(year)}-${String(month)}`;
    return this.memoize(this.periodCaches, key, () =>
      new ResourceCache<PayrollResponse[]>(() => this.api.getPayrollsByPeriod(year, month), {
        ttlMs: PAYROLL_TTL_MS,
        staleWhileRevalidate: true,
      }),
    );
  }

  /** Every payroll record of one worker (`GET /v1/payroll/worker/{userId}`). */
  worker(userId: number): ResourceCache<PayrollResponse[]> {
    const key = String(userId);
    return this.memoize(this.workerCaches, key, () =>
      new ResourceCache<PayrollResponse[]>(() => this.api.getPayrollsByWorker(userId), {
        ttlMs: PAYROLL_TTL_MS,
        staleWhileRevalidate: true,
      }),
    );
  }

  /** Events of one worker in one month. */
  events(userId: number, year: number, month: number): ResourceCache<PayrollEventResponse[]> {
    const key = `${String(userId)}-${String(year)}-${String(month)}`;
    return this.memoize(this.eventCaches, key, () =>
      new ResourceCache<PayrollEventResponse[]>(
        () => this.api.getEvents(userId, year, month),
        { ttlMs: PAYROLL_TTL_MS, staleWhileRevalidate: true },
      ),
    );
  }

  /** Settlements of one worker in one month. */
  settlements(
    userId: number,
    year: number,
    month: number,
  ): ResourceCache<PayrollSettlementResponse[]> {
    const key = `${String(userId)}-${String(year)}-${String(month)}`;
    return this.memoize(this.settlementCaches, key, () =>
      new ResourceCache<PayrollSettlementResponse[]>(
        () => this.api.getSettlements(userId, year, month),
        { ttlMs: PAYROLL_TTL_MS, staleWhileRevalidate: true },
      ),
    );
  }

  /**
   * Marks every cache entry stale.
   *
   * Call after any payroll mutation (create/update/delete of a payroll, an
   * event or a settlement): a settlement changes `paidAmount`/`pendingAmount`
   * on the payroll row, and an event changes `bonuses`/`deductions`, so the
   * whole family is stale together.
   */
  invalidateAll(): void {
    this.payrolls.invalidate();
    for (const cache of this.periodCaches.values()) cache.invalidate();
    for (const cache of this.workerCaches.values()) cache.invalidate();
    for (const cache of this.eventCaches.values()) cache.invalidate();
    for (const cache of this.settlementCaches.values()) cache.invalidate();
  }

  private memoize<T>(
    store: Map<string, T>,
    key: string,
    create: () => T,
  ): T {
    const existing = store.get(key);
    if (existing !== undefined) return existing;

    const created = create();
    store.set(key, created);
    return created;
  }
}
