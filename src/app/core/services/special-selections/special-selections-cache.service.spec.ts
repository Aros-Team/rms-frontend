import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { HttpErrorResponse } from '@angular/common/http';
import { SpecialSelectionsCacheService } from './special-selections-cache.service';
import { SpecialSelections } from './special-selections';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';

describe('SpecialSelectionsCacheService', () => {
  let service: SpecialSelectionsCacheService;
  let httpMock: HttpTestingController;
  let wsMock: Partial<WebSocket>;

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

  beforeEach(() => {
    wsMock = {
      subscribeToTopic: vi.fn().mockReturnValue({
        pipe: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SpecialSelectionsCacheService,
        SpecialSelections,
        { provide: WebSocket, useValue: wsMock as WebSocket },
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
    // Prime a detail cache
    service.detail(1).load();
    httpMock.expectOne('v1/special-selections/1').flush(mockSelection);

    service.delete(1).subscribe();
    const req = httpMock.expectOne('v1/special-selections/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    // Detail cache should be gone — loading again triggers new fetch
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
      breakdown: [{ optionId: 10, name: 'Lentejas', cost: 1.20 }],
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
    req.flush({ content: [], totalElements: 0, totalPages: 0, size: 10, number: 0, first: true, last: true });
    expect(cache.data()?.content).toEqual([]);
  });

  it('invalidateAll marks all caches stale', () => {
    // Prime caches
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
});
