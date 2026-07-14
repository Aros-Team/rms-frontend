import { Injectable, inject, DestroyRef } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ResourceCache } from '@app/core/cache/resource-cache';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { SpecialSelections } from './special-selections';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';
import { ScheduleEntryRequest } from '@app/shared/models/dto/special-selections/schedule-entry';
import { SpecialSelectionHistoryPage } from '@app/shared/models/dto/special-selections/special-selection-history';
import { SpecialSelectionHistoryRangeResponse } from '@app/shared/models/dto/special-selections/special-selection-history';
import { SpecialSelectionHistoryEntry } from '@app/shared/models/dto/special-selections/special-selection-history';
import { SuggestedPriceResponse } from '@app/shared/models/dto/special-selections/special-selection-suggested-price';
import { SpecialSelectionWsPayload } from '@app/shared/models/dto/special-selections/special-selection-ws-payload';

@Injectable({ providedIn: 'root' })
export class SpecialSelectionsCacheService {
  private readonly api = inject(SpecialSelections);
  private readonly ws = inject(WebSocket);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.ws.subscribeToTopic<SpecialSelectionWsPayload>('/topic/special-selections/updated').pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((payload) => {
      if (payload.selection) {
        const sel = payload.selection;
        const detail = this.detailCaches.get(payload.productId);
        if (detail) {
          detail.patchData(() => sel);
        }
      } else {
        this.detailCaches.delete(payload.productId);
        this.historyCaches.delete(payload.productId);
        this.historyRangeCaches.delete(payload.productId);
        this.historyVersionCaches.delete(payload.productId);
      }
      this.availableNow.refresh();
    });
  }

  readonly list = new ResourceCache<SpecialSelectionResponse[]>(
    () => this.api.list(),
    { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
  );

  readonly availableNow = new ResourceCache<SpecialSelectionResponse[]>(
    () => this.api.availableNow(),
    { ttlMs: 60 * 1000, staleWhileRevalidate: true }
  );

  private readonly detailCaches = new Map<number, ResourceCache<SpecialSelectionResponse>>();
  private readonly historyCaches = new Map<number, ResourceCache<SpecialSelectionHistoryPage>>();
  private readonly historyRangeCaches = new Map<number, ResourceCache<SpecialSelectionHistoryRangeResponse>>();
  private readonly historyVersionCaches = new Map<number, Map<number, ResourceCache<SpecialSelectionHistoryEntry>>>();

  detail(id: number): ResourceCache<SpecialSelectionResponse> {
    let cache = this.detailCaches.get(id);
    if (!cache) {
      cache = new ResourceCache<SpecialSelectionResponse>(
        () => this.api.getById(id),
        { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true }
      );
      this.detailCaches.set(id, cache);
    }
    return cache;
  }

  history(id: number): ResourceCache<SpecialSelectionHistoryPage> {
    let cache = this.historyCaches.get(id);
    if (!cache) {
      cache = new ResourceCache<SpecialSelectionHistoryPage>(
        () => this.api.getHistory(id, 0, 10),
        { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
      );
      this.historyCaches.set(id, cache);
    }
    return cache;
  }

  historyRange(id: number): ResourceCache<SpecialSelectionHistoryRangeResponse> {
    let cache = this.historyRangeCaches.get(id);
    if (!cache) {
      cache = new ResourceCache<SpecialSelectionHistoryRangeResponse>(
        () => this.api.getHistoryRange(id, '', ''),
        { ttlMs: 5 * 60 * 1000, staleWhileRevalidate: true }
      );
      this.historyRangeCaches.set(id, cache);
    }
    return cache;
  }

  historyVersion(id: number, version: number): ResourceCache<SpecialSelectionHistoryEntry> {
    let inner = this.historyVersionCaches.get(id);
    if (!inner) {
      inner = new Map();
      this.historyVersionCaches.set(id, inner);
    }
    let cache = inner.get(version);
    if (!cache) {
      cache = new ResourceCache<SpecialSelectionHistoryEntry>(
        () => this.api.getHistoryVersion(id, version),
        { ttlMs: 10 * 60 * 1000, staleWhileRevalidate: true }
      );
      inner.set(version, cache);
    }
    return cache;
  }

  invalidateAll(): void {
    this.list.invalidate();
    this.availableNow.invalidate();
    this.detailCaches.forEach((c) => { c.invalidate(); });
    this.historyCaches.forEach((c) => { c.invalidate(); });
    this.historyRangeCaches.forEach((c) => { c.invalidate(); });
    this.historyVersionCaches.forEach((inner) => { inner.forEach((c) => { c.invalidate(); }); });
  }

  invalidateDetail(id: number): void {
    this.detailCaches.get(id)?.invalidate();
  }

  invalidateHistory(id: number): void {
    this.historyCaches.get(id)?.invalidate();
    this.historyRangeCaches.get(id)?.invalidate();
    this.historyVersionCaches.get(id)?.forEach((c) => { c.invalidate(); });
  }

  suggestPrice(id: number, marginPercent: number): Observable<SuggestedPriceResponse> {
    return this.api.suggestPrice(id, { marginPercent: marginPercent });
  }

  create(req: SpecialSelectionRequest): Observable<SpecialSelectionResponse> {
    return this.api.create(req).pipe(tap(() => { this.invalidateAll(); }));
  }

  update(id: number, req: SpecialSelectionRequest): Observable<SpecialSelectionResponse> {
    return this.api.update(id, req).pipe(tap(() => {
      this.invalidateAll();
      this.invalidateHistory(id);
    }));
  }

  patchSchedule(id: number, entries: ScheduleEntryRequest[]): Observable<SpecialSelectionResponse> {
    return this.api.patchSchedule(id, { entries: entries }).pipe(tap(() => {
      this.availableNow.invalidate();
      this.invalidateDetail(id);
    }));
  }

  patchPrice(id: number, basePrice: number): Observable<SpecialSelectionResponse> {
    return this.api.patchPrice(id, { basePrice: basePrice }).pipe(tap(() => {
      this.availableNow.invalidate();
      this.invalidateDetail(id);
    }));
  }

  delete(id: number): Observable<object> {
    return this.api.delete(id).pipe(tap(() => {
      this.detailCaches.delete(id);
      this.historyCaches.delete(id);
      this.historyRangeCaches.delete(id);
      this.historyVersionCaches.delete(id);
      this.list.invalidate();
      this.availableNow.invalidate();
    }));
  }

  revert(id: number, version: number): Observable<SpecialSelectionResponse> {
    return this.api.revertHistory(id, version).pipe(tap(() => {
      this.invalidateDetail(id);
      this.invalidateHistory(id);
      this.availableNow.invalidate();
    }));
  }
}