import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

import { HttpErrorResponse } from '@angular/common/http';
import { Auth } from '@app/core/services/auth/auth';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { SpecialSelectionsCacheService } from './special-selections-cache.service';
import { SpecialSelections } from './special-selections';
import { SpecialSelectionsRealtime } from './special-selections-realtime';
import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';
import { SpecialSelectionWsPayload } from '@app/shared/models/dto/special-selections/special-selection-ws-payload';
import {
  SpecialSelectionHistoryEntry,
  SpecialSelectionHistoryPage,
} from '@app/shared/models/dto/special-selections/special-selection-history';

describe('SpecialSelectionsCacheService', () => {
  let service: SpecialSelectionsCacheService;
  let httpMock: HttpTestingController;
  let realtimeSubject: Subject<SpecialSelectionWsPayload>;
  let realtimeMock: Pick<SpecialSelectionsRealtime, 'updates$'>;
  let comboRefInvalidate: ReturnType<typeof vi.fn>;
  let comboRefRefresh: ReturnType<typeof vi.fn>;
  let comboReferenceStub: Pick<ComboReferenceCache, 'invalidate' | 'refresh'>;

  const mockSelection: SpecialSelectionResponse = {
    id: 1,
    name: 'Menú Almuerzo',
    description: 'Sopa + plato fuerte',
    basePrice: 12.50,
    active: true,
    areaId: 1,
    selectionType: 'SPECIAL_SELECTION',
    baseRecipeEnabled: false,
    schedulingRequired: true,
    groups: [],
    additions: [],
    questions: [],
    schedule: [{ id: 1, dayOfWeek: 'MONDAY', startTime: '11:00', endTime: '15:00' }],
  };

  const mockHistory: SpecialSelectionHistoryPage = {
    content: [],
    totalElements: 0,
    totalPages: 0,
    size: 10,
    number: 0,
    first: true,
    last: true,
  };

  const mockHistoryEntry: SpecialSelectionHistoryEntry = {
    version: 1,
    changeType: 'CREATE',
    author: 'admin',
    timestamp: '2026-07-15T10:00:00Z',
    isCurrent: true,
    snapshot: mockSelection,
  };

  beforeEach(() => {
    realtimeSubject = new Subject<SpecialSelectionWsPayload>();
    realtimeMock = { updates$: realtimeSubject.asObservable() };

    comboRefInvalidate = vi.fn();
    comboRefRefresh = vi.fn();
    comboReferenceStub = { invalidate: comboRefInvalidate, refresh: comboRefRefresh };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SpecialSelectionsCacheService,
        SpecialSelections,
        { provide: SpecialSelectionsRealtime, useValue: realtimeMock },
        { provide: ComboReferenceCache, useValue: comboReferenceStub },
      ],
    });

    service = TestBed.inject(SpecialSelectionsCacheService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });
  it('list cache fetches from correct endpoint', () => {
    service.list.load();
    const req = httpMock.expectOne('v1/special-selections');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(service.list.data()).toEqual([]);
  });

  it('availableNow cache fetches from correct endpoint', () => {
    service.availableNow.load();
    const req = httpMock.expectOne('v1/special-selections/available-now');
    expect(req.request.method).toBe('GET');
    req.flush([mockSelection]);
    const data = service.availableNow.data();
    expect(data?.length).toBe(1);
    expect(data?.[0].name).toBe('Menú Almuerzo');
  });

  it('detail cache fetches per-id endpoint', () => {
    const cache = service.detail(1);
    cache.load();
    const req = httpMock.expectOne('v1/special-selections/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockSelection);
    expect(cache.data()?.id).toBe(1);
  });

  it('create POSTs and invalidates top-level caches', () => {
    let emitted = false;
    service.create({} as unknown as SpecialSelectionRequest).subscribe(() => { emitted = true; });

    const req = httpMock.expectOne('v1/special-selections');
    expect(req.request.method).toBe('POST');
    req.flush(mockSelection);

    expect(emitted).toBe(true);
  });

  it('delete removes per-id caches and invalidates list', () => {
    service.detail(1).load();
    httpMock.expectOne('v1/special-selections/1').flush(mockSelection);

    service.delete(1).subscribe();
    const req = httpMock.expectOne('v1/special-selections/1');
    expect(req.request.method).toBe('DELETE');    req.flush({});

    service.detail(1).load();
    httpMock.expectOne('v1/special-selections/1');
  });

  it('suggestPrice propagates HttpErrorResponse on 422', () => {
    const missingVariants = [42, 87];
    service.suggestPrice(1, 30).subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(422);
        const body = err.error as { missingVariants: number[] };
        expect(body.missingVariants).toEqual([42, 87]);
        expect(body.message).toContain('missing unit_cost');
      },
    });

    const req = httpMock.expectOne('v1/special-selections/1/suggest-price');
    expect(req.request.method).toBe('POST');
    req.flush(
      { status: 422, message: 'missing unit_cost', missingVariants },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
  });

  it('suggestPrice returns SuggestedPriceResponse on 200', () => {
    const response = {
      suggestedPrice: 15.50,
      totalCost: 10.85,
      marginPercent: 30,
      breakdown: [{ productId: 10, name: 'Lentejas', cost: 1.20 }],
    };

    service.suggestPrice(1, 30).subscribe((data) => {
      expect(data.suggestedPrice).toBe(15.50);
      expect(data.breakdown.length).toBe(1);
    });

    const req = httpMock.expectOne('v1/special-selections/1/suggest-price');
    req.flush(response);
  });

  it('history cache fetches paginated endpoint', () => {
    const cache = service.history(1);
    cache.load();
    const req = httpMock.expectOne('v1/special-selections/1/history?page=0&size=10');
    expect(req.request.method).toBe('GET');
    req.flush(mockHistory);
    expect(cache.data()?.content).toEqual([]);
  });

  it('invalidateAll marks all caches stale', () => {
    service.list.load();
    httpMock.expectOne('v1/special-selections').flush([mockSelection]);

    service.detail(1).load();
    httpMock.expectOne('v1/special-selections/1').flush(mockSelection);

    expect(service.list.data()).toBeTruthy();
    expect(service.detail(1).data()).toBeTruthy();

    service.invalidateAll();

    expect(service.list.status()).toBe('stale');
    expect(service.detail(1).status()).toBe('stale');
  });

  function primeRealtimeFixtures(): void {
    service.list.load();
    httpMock.expectOne('v1/special-selections').flush([mockSelection]);

    service.availableNow.load();
    httpMock.expectOne('v1/special-selections/available-now').flush([mockSelection]);

    service.detail(1).load();
    httpMock.expectOne('v1/special-selections/1').flush(mockSelection);

    service.history(1).load();
    httpMock.expectOne('v1/special-selections/1/history?page=0&size=10').flush(mockHistory);

    service.historyRange(1).load();
    httpMock.expectOne('v1/special-selections/1/history/range?from=&to=').flush({
      versions: [mockHistoryEntry],
    });

    service.historyVersion(1, 1).load();
    httpMock.expectOne('v1/special-selections/1/history/1').flush(mockHistoryEntry);
  }

  function flushAvailableNowRefresh(selection = mockSelection): void {
    const refreshReq = httpMock.expectOne('v1/special-selections/available-now');
    refreshReq.flush([selection]);
  }

  function expectAffectedCachesStale(expectedDetail: SpecialSelectionResponse): void {
    expect(service.list.status()).toBe('stale');
    expect(service.detail(1).status()).toBe('stale');
    expect(service.detail(1).data()).toEqual(expectedDetail);
    expect(service.history(1).status()).toBe('stale');
    expect(service.historyRange(1).status()).toBe('stale');
    expect(service.historyVersion(1, 1).status()).toBe('stale');
    expect(service.availableNow.status()).toBe('stale');
  }

  function verifyKnownRealtimeChange(
    changeType: SpecialSelectionWsPayload['changeType'],
    selection: SpecialSelectionResponse,
  ): void {
    primeRealtimeFixtures();

    realtimeSubject.next({
      changeType,
      productId: 1,
      active: selection.active,
      selection,
    });

    expectAffectedCachesStale(selection);
    if (changeType === 'CREATE') {
      expect(comboRefInvalidate).toHaveBeenCalledTimes(1);
    } else {
      expect(comboRefInvalidate).not.toHaveBeenCalled();
    }
    expect(comboRefRefresh).not.toHaveBeenCalled();

    flushAvailableNowRefresh(selection);
    expect(service.availableNow.status()).toBe('fresh');
  }

  function verifyDelete(selection: SpecialSelectionResponse | null): void {
    primeRealtimeFixtures();
    const detail = service.detail(1);
    const history = service.history(1);
    const historyRange = service.historyRange(1);
    const historyVersion = service.historyVersion(1, 1);

    realtimeSubject.next({
      changeType: 'DELETE',
      productId: 1,
      active: false,
      selection,
    });

    expect(service.list.status()).toBe('stale');
    expect(detail.status()).toBe('stale');
    expect(detail.data()).toBeNull();
    expect(history.status()).toBe('stale');
    expect(history.data()).toBeNull();
    expect(historyRange.status()).toBe('stale');
    expect(historyRange.data()).toBeNull();
    expect(historyVersion.status()).toBe('stale');
    expect(historyVersion.data()).toBeNull();
    expect(service.detail(1)).not.toBe(detail);
    expect(service.history(1)).not.toBe(history);
    expect(service.historyRange(1)).not.toBe(historyRange);
    expect(service.historyVersion(1, 1)).not.toBe(historyVersion);
    expect(comboRefInvalidate).toHaveBeenCalledTimes(1);
    expect(comboRefRefresh).not.toHaveBeenCalled();

    flushAvailableNowRefresh();
    expect(service.availableNow.status()).toBe('fresh');
  }

  function verifyConservativeChange(payload: SpecialSelectionWsPayload): void {
    primeRealtimeFixtures();
    const detail = service.detail(1);
    const history = service.history(1);
    const historyRange = service.historyRange(1);
    const historyVersion = service.historyVersion(1, 1);

    realtimeSubject.next(payload);

    expectAffectedCachesStale(mockSelection);
    expect(service.detail(1)).toBe(detail);
    expect(service.history(1)).toBe(history);
    expect(service.historyRange(1)).toBe(historyRange);
    expect(service.historyVersion(1, 1)).toBe(historyVersion);
    expect(comboRefInvalidate).toHaveBeenCalledTimes(1);
    expect(comboRefRefresh).not.toHaveBeenCalled();

    flushAvailableNowRefresh();
    expect(service.availableNow.status()).toBe('fresh');
  }

  describe('realtime changeType handling', () => {
    it('CREATE invalidates every affected cache and applies selection data', () => {
      verifyKnownRealtimeChange('CREATE', { ...mockSelection, name: 'Menú Creado' });
    });

    it('UPDATE invalidates every affected cache and applies selection data', () => {
      verifyKnownRealtimeChange('UPDATE', { ...mockSelection, description: 'Menú actualizado' });
    });

    it('SCHEDULE_CHANGE invalidates every affected cache and applies selection data', () => {
      verifyKnownRealtimeChange('SCHEDULE_CHANGE', {
        ...mockSelection,
        schedule: [{ id: 2, dayOfWeek: 'TUESDAY', startTime: '12:00', endTime: '16:00' }],
      });
    });

    it('PRICE_CHANGE invalidates every affected cache and applies selection data', () => {
      verifyKnownRealtimeChange('PRICE_CHANGE', { ...mockSelection, basePrice: 18 });
    });

    it('DELETE with null selection resets held caches before removing them', () => {
      verifyDelete(null);
    });

    it('DELETE with non-null selection resets held caches before removing them', () => {
      verifyDelete({ ...mockSelection, name: 'Payload atrasado' });
    });

    it('REVERT invalidates every affected cache and applies selection data', () => {
      verifyKnownRealtimeChange('REVERT', {
        ...mockSelection,
        basePrice: 9.5,
        name: 'Menú v1',
      });
    });

    it('known non-DELETE change with null selection invalidates without removing caches', () => {
      primeRealtimeFixtures();
      const detail = service.detail(1);
      const history = service.history(1);
      const historyRange = service.historyRange(1);
      const historyVersion = service.historyVersion(1, 1);

      realtimeSubject.next({
        changeType: 'UPDATE',
        productId: 1,
        active: false,
        selection: null,
      });

      expectAffectedCachesStale(mockSelection);
      expect(service.detail(1)).toBe(detail);
      expect(service.history(1)).toBe(history);
      expect(service.historyRange(1)).toBe(historyRange);
      expect(service.historyVersion(1, 1)).toBe(historyVersion);
      expect(comboRefInvalidate).not.toHaveBeenCalled();
      expect(comboRefRefresh).not.toHaveBeenCalled();

      flushAvailableNowRefresh();
    });

    it('unknown changeType invalidates every affected cache conservatively', () => {
      verifyConservativeChange({
        changeType: 'UNKNOWN',
        productId: 1,
        active: true,
        selection: { ...mockSelection, name: 'Estado desconocido' },
      } as unknown as SpecialSelectionWsPayload);
    });

    it('missing changeType invalidates every affected cache conservatively', () => {
      verifyConservativeChange({
        productId: 1,
        active: true,
        selection: null,
      } as SpecialSelectionWsPayload);
    });

    it('supersedes in-flight cache loads when a realtime event arrives', () => {
      service.list.load();
      const listRequest = httpMock.expectOne('v1/special-selections');

      service.availableNow.load();
      const availableNowRequest = httpMock.expectOne('v1/special-selections/available-now');

      service.detail(1).load();
      const detailRequest = httpMock.expectOne('v1/special-selections/1');

      service.history(1).load();
      const historyRequest = httpMock.expectOne(
        'v1/special-selections/1/history?page=0&size=10',
      );

      service.historyRange(1).load();
      const historyRangeRequest = httpMock.expectOne(
        'v1/special-selections/1/history/range?from=&to=',
      );

      service.historyVersion(1, 1).load();
      const historyVersionRequest = httpMock.expectOne('v1/special-selections/1/history/1');

      const updated = { ...mockSelection, name: 'Menú en tiempo real' };
      realtimeSubject.next({
        changeType: 'UPDATE',
        productId: 1,
        active: true,
        selection: updated,
      });

      expect(listRequest.cancelled).toBe(true);
      expect(availableNowRequest.cancelled).toBe(true);
      expect(detailRequest.cancelled).toBe(true);
      expect(historyRequest.cancelled).toBe(true);
      expect(historyRangeRequest.cancelled).toBe(true);
      expect(historyVersionRequest.cancelled).toBe(true);
      expect(service.list.status()).toBe('stale');
      expect(service.detail(1).status()).toBe('stale');
      expect(service.detail(1).data()).toBeNull();
      expect(service.history(1).status()).toBe('stale');
      expect(service.historyRange(1).status()).toBe('stale');
      expect(service.historyVersion(1, 1).status()).toBe('stale');
      expect(service.availableNow.status()).toBe('loading');
      expect(comboRefInvalidate).not.toHaveBeenCalled();
      expect(comboRefRefresh).not.toHaveBeenCalled();

      flushAvailableNowRefresh(updated);
      expect(service.availableNow.data()).toEqual([updated]);

      service.list.load();
      httpMock.expectOne('v1/special-selections').flush([updated]);

      service.detail(1).load();
      httpMock.expectOne('v1/special-selections/1').flush(updated);

      service.history(1).load();
      httpMock.expectOne('v1/special-selections/1/history?page=0&size=10').flush(mockHistory);

      service.historyRange(1).load();
      httpMock.expectOne('v1/special-selections/1/history/range?from=&to=').flush({
        versions: [mockHistoryEntry],
      });

      service.historyVersion(1, 1).load();
      httpMock.expectOne('v1/special-selections/1/history/1').flush(mockHistoryEntry);

      expect(service.list.data()).toEqual([updated]);
      expect(service.detail(1).data()).toEqual(updated);
      expect(service.history(1).status()).toBe('fresh');
      expect(service.historyRange(1).status()).toBe('fresh');
      expect(service.historyVersion(1, 1).status()).toBe('fresh');
    });

    it('supersedes in-flight detail/history/range/version loads when a DELETE realtime event arrives', () => {
      service.list.load();
      const listRequest = httpMock.expectOne('v1/special-selections');

      service.availableNow.load();
      const availableNowRequest = httpMock.expectOne('v1/special-selections/available-now');

      service.detail(1).load();
      const detailRequest = httpMock.expectOne('v1/special-selections/1');

      service.history(1).load();
      const historyRequest = httpMock.expectOne(
        'v1/special-selections/1/history?page=0&size=10',
      );

      service.historyRange(1).load();
      const historyRangeRequest = httpMock.expectOne(
        'v1/special-selections/1/history/range?from=&to=',
      );

      service.historyVersion(1, 1).load();
      const historyVersionRequest = httpMock.expectOne('v1/special-selections/1/history/1');

      const detail = service.detail(1);
      const history = service.history(1);
      const historyRange = service.historyRange(1);
      const historyVersion = service.historyVersion(1, 1);

      realtimeSubject.next({
        changeType: 'DELETE',
        productId: 1,
        active: false,
        selection: null,
      });

      expect(listRequest.cancelled).toBe(true);
      expect(availableNowRequest.cancelled).toBe(true);
      expect(detailRequest.cancelled).toBe(true);
      expect(historyRequest.cancelled).toBe(true);
      expect(historyRangeRequest.cancelled).toBe(true);
      expect(historyVersionRequest.cancelled).toBe(true);

      expect(service.list.status()).toBe('stale');
      expect(detail.status()).toBe('stale');
      expect(detail.data()).toBeNull();
      expect(history.status()).toBe('stale');
      expect(history.data()).toBeNull();
      expect(historyRange.status()).toBe('stale');
      expect(historyRange.data()).toBeNull();
      expect(historyVersion.status()).toBe('stale');
      expect(historyVersion.data()).toBeNull();

      expect(service.detail(1)).not.toBe(detail);
      expect(service.history(1)).not.toBe(history);
      expect(service.historyRange(1)).not.toBe(historyRange);
      expect(service.historyVersion(1, 1)).not.toBe(historyVersion);

      expect(service.availableNow.status()).toBe('loading');
      expect(comboRefInvalidate).toHaveBeenCalledTimes(1);
      expect(comboRefRefresh).not.toHaveBeenCalled();

      flushAvailableNowRefresh();
      expect(service.availableNow.status()).toBe('fresh');

      service.detail(1).load();
      httpMock.expectOne('v1/special-selections/1').flush(mockSelection);

      service.history(1).load();
      httpMock.expectOne('v1/special-selections/1/history?page=0&size=10').flush(mockHistory);

      service.historyRange(1).load();
      httpMock.expectOne('v1/special-selections/1/history/range?from=&to=').flush({
        versions: [mockHistoryEntry],
      });

      service.historyVersion(1, 1).load();
      httpMock.expectOne('v1/special-selections/1/history/1').flush(mockHistoryEntry);

      expect(service.detail(1).data()).toEqual(mockSelection);
      expect(service.history(1).status()).toBe('fresh');
      expect(service.historyRange(1).status()).toBe('fresh');
      expect(service.historyVersion(1, 1).status()).toBe('fresh');
    });
  });

  describe('modifiedCombo$ signal', () => {
    it('emits the productId when an UPDATE event arrives', () => {
      const emissions: (number | null)[] = [];
      service.modifiedCombo$.subscribe((id) => { emissions.push(id); });

      realtimeSubject.next({
        changeType: 'UPDATE',
        productId: 7,
        active: true,
        selection: { ...mockSelection, id: 7, name: 'Combo actualizado' },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 7, name: 'Combo actualizado' });

      expect(emissions).toEqual([null, 7]);
    });

    it('emits the productId when a SCHEDULE_CHANGE event arrives', () => {
      const emissions: (number | null)[] = [];
      service.modifiedCombo$.subscribe((id) => { emissions.push(id); });

      realtimeSubject.next({
        changeType: 'SCHEDULE_CHANGE',
        productId: 11,
        active: true,
        selection: { ...mockSelection, id: 11 },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 11 });

      expect(emissions).toEqual([null, 11]);
    });

    it('emits the productId when a PRICE_CHANGE event arrives', () => {
      const emissions: (number | null)[] = [];
      service.modifiedCombo$.subscribe((id) => { emissions.push(id); });

      realtimeSubject.next({
        changeType: 'PRICE_CHANGE',
        productId: 13,
        active: true,
        selection: { ...mockSelection, id: 13, basePrice: 20 },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 13, basePrice: 20 });

      expect(emissions).toEqual([null, 13]);
    });

    it('emits the productId when a REVERT event arrives', () => {
      const emissions: (number | null)[] = [];
      service.modifiedCombo$.subscribe((id) => { emissions.push(id); });

      realtimeSubject.next({
        changeType: 'REVERT',
        productId: 17,
        active: true,
        selection: { ...mockSelection, id: 17, basePrice: 9.5 },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 17, basePrice: 9.5 });

      expect(emissions).toEqual([null, 17]);
    });

    it('does NOT emit when a CREATE event arrives', () => {
      const emissions: (number | null)[] = [];
      service.modifiedCombo$.subscribe((id) => { emissions.push(id); });

      realtimeSubject.next({
        changeType: 'CREATE',
        productId: 23,
        active: true,
        selection: { ...mockSelection, id: 23, name: 'Combo creado' },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 23, name: 'Combo creado' });

      expect(emissions).toEqual([null]);
    });

    it('does NOT emit when a DELETE event arrives', () => {
      const emissions: (number | null)[] = [];
      service.modifiedCombo$.subscribe((id) => { emissions.push(id); });

      realtimeSubject.next({
        changeType: 'DELETE',
        productId: 29,
        active: false,
        selection: null,
      });
      flushAvailableNowRefresh();

      expect(emissions).toEqual([null]);
    });

    it('replays the last value to late subscribers (BehaviorSubject semantics)', () => {
      realtimeSubject.next({
        changeType: 'UPDATE',
        productId: 31,
        active: true,
        selection: { ...mockSelection, id: 31 },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 31 });

      const lateEmissions: (number | null)[] = [];
      service.modifiedCombo$.subscribe((id) => { lateEmissions.push(id); });

      expect(lateEmissions).toEqual([31]);
    });

    it('only emits the latest productId when several modification events fire in sequence', () => {
      const emissions: (number | null)[] = [];
      service.modifiedCombo$.subscribe((id) => { emissions.push(id); });

      realtimeSubject.next({
        changeType: 'UPDATE',
        productId: 41,
        active: true,
        selection: { ...mockSelection, id: 41 },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 41 });

      realtimeSubject.next({
        changeType: 'PRICE_CHANGE',
        productId: 42,
        active: true,
        selection: { ...mockSelection, id: 42 },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 42 });

      realtimeSubject.next({
        changeType: 'CREATE',
        productId: 43,
        active: true,
        selection: { ...mockSelection, id: 43 },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 43 });

      realtimeSubject.next({
        changeType: 'REVERT',
        productId: 44,
        active: true,
        selection: { ...mockSelection, id: 44 },
      });
      flushAvailableNowRefresh({ ...mockSelection, id: 44 });

      realtimeSubject.next({
        changeType: 'DELETE',
        productId: 45,
        active: false,
        selection: null,
      });
      flushAvailableNowRefresh();

      expect(emissions).toEqual([null, 41, 42, 44]);
    });
  });
});

describe('SpecialSelectionsCacheService realtime source collapse', () => {
  let realtimeSource: Subject<SpecialSelectionWsPayload>;
  let sourceSubscriptions: number;
  let topicSubscribeCalls: number;
  let realtime: SpecialSelectionsRealtime;
  let cache: SpecialSelectionsCacheService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    realtimeSource = new Subject<SpecialSelectionWsPayload>();
    sourceSubscriptions = 0;
    topicSubscribeCalls = 0;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SpecialSelections,
        SpecialSelectionsRealtime,
        SpecialSelectionsCacheService,
        ComboReferenceCache,
        {
          provide: WebSocket,
          useValue: {
            connect: vi.fn(),
            subscribeToTopic: vi.fn().mockImplementation((topic: string) => {
              if (topic === '/topic/special-selections/updated') {
                topicSubscribeCalls += 1;
                return new Observable<SpecialSelectionWsPayload>((subscriber) => {
                  sourceSubscriptions += 1;
                  const inner = realtimeSource.subscribe(subscriber);
                  return () => {
                    inner.unsubscribe();
                  };
                });
              }
              return new Subject<SpecialSelectionWsPayload>().asObservable();
            }),
          },
        },
        {
          provide: Auth,
          useValue: { getToken: vi.fn().mockReturnValue('test-token') },
        },
      ],
    });

    realtime = TestBed.inject(SpecialSelectionsRealtime);
    cache = TestBed.inject(SpecialSelectionsCacheService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushAvailableNow(): void {
    const req = httpMock.expectOne('v1/special-selections/available-now');
    req.flush([]);
  }

  it('registers the realtime topic exactly once even when cache and a manual consumer both subscribe', () => {
    const manualEmissions: SpecialSelectionWsPayload[] = [];
    realtime.updates$.subscribe((value) => { manualEmissions.push(value); });

    const event: SpecialSelectionWsPayload = {
      changeType: 'UPDATE',
      productId: 99,
      active: true,
      selection: null,
    };

    realtimeSource.next(event);
    flushAvailableNow();

    expect(topicSubscribeCalls).toBe(1);
    expect(sourceSubscriptions).toBe(1);
    expect(manualEmissions).toEqual([event]);
    expect(cache.modifiedCombo$).toBeDefined();
  });

  it('keeps a single source subscription when several components and the cache service subscribe concurrently', () => {
    const firstConsumer: SpecialSelectionWsPayload[] = [];
    const secondConsumer: SpecialSelectionWsPayload[] = [];
    const thirdConsumer: SpecialSelectionWsPayload[] = [];

    realtime.updates$.subscribe((value) => { firstConsumer.push(value); });
    realtime.updates$.subscribe((value) => { secondConsumer.push(value); });
    realtime.updates$.subscribe((value) => { thirdConsumer.push(value); });

    const event: SpecialSelectionWsPayload = {
      changeType: 'SCHEDULE_CHANGE',
      productId: 100,
      active: true,
      selection: null,
    };
    realtimeSource.next(event);
    flushAvailableNow();

    expect(topicSubscribeCalls).toBe(1);
    expect(sourceSubscriptions).toBe(1);
    expect(firstConsumer).toEqual([event]);
    expect(secondConsumer).toEqual([event]);
    expect(thirdConsumer).toEqual([event]);
  });

  it('does not re-subscribe to the STOMP topic when a new consumer subscribes after the cache service has already subscribed', () => {
    const lateEmissions: SpecialSelectionWsPayload[] = [];

    realtimeSource.next({
      changeType: 'UPDATE',
      productId: 101,
      active: true,
      selection: null,
    });
    flushAvailableNow();
    expect(topicSubscribeCalls).toBe(1);

    realtime.updates$.subscribe((value) => { lateEmissions.push(value); });

    realtimeSource.next({
      changeType: 'PRICE_CHANGE',
      productId: 102,
      active: true,
      selection: null,
    });
    flushAvailableNow();

    expect(topicSubscribeCalls).toBe(1);
    expect(sourceSubscriptions).toBe(1);
    expect(lateEmissions.length).toBe(1);
    expect(lateEmissions[0].productId).toBe(102);
  });
});
