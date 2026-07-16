import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { HttpErrorResponse } from '@angular/common/http';
import { SpecialSelections } from './special-selections';
import { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';

describe('SpecialSelections service', () => {
  let service: SpecialSelections;
  let httpMock: HttpTestingController;

  const mockSelection: SpecialSelectionResponse = {
    id: 7,
    name: 'Combo Almuerzo',
    description: 'Sopa + plato fuerte',
    basePrice: 12.5,
    active: true,
    preparationAreaId: 1,
    selectionType: 'SPECIAL_SELECTION',
    baseRecipeEnabled: false,
    schedulingRequired: true,
    groups: [
      {
        id: 1,
        categoryId: 2,
        categoryName: 'Sopas',
        displayOrder: 1,
        required: true,
        minSelections: 1,
        maxSelections: 1,
        productIds: [10, 11],
      },
    ],
    additions: [],
    questions: [],
    schedule: [],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SpecialSelections,
      ],
    });

    service = TestBed.inject(SpecialSelections);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getById hits GET v1/special-selections/{id}', () => {
    service.getById(7).subscribe(res => {
      expect(res.id).toBe(7);
    });

    const req = httpMock.expectOne('v1/special-selections/7');
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    req.flush(mockSelection);
  });

  it('list hits GET v1/special-selections', () => {
    service.list().subscribe();

    const req = httpMock.expectOne('v1/special-selections');
    expect(req.request.method).toBe('GET');
    req.flush([mockSelection]);
  });

  it('availableNow hits GET v1/special-selections/available-now', () => {
    service.availableNow().subscribe();

    const req = httpMock.expectOne('v1/special-selections/available-now');
    expect(req.request.method).toBe('GET');
    req.flush([mockSelection]);
  });

  it('create POSTs SpecialSelectionRequest to v1/special-selections', () => {
    const payload: SpecialSelectionRequest = {
      name: 'Combo Almuerzo',
      description: 'Sopa + plato fuerte',
      basePrice: 12.5,
      active: true,
      areaId: 1,
      baseRecipeEnabled: false,
      schedulingRequired: true,
      groups: [
        {
          id: null,
          categoryId: 2,
          displayOrder: 1,
          required: true,
          minSelections: 1,
          maxSelections: 1,
          productIds: [10, 11],
        },
      ],
      additions: [],
      questions: [],
      schedule: [],
    };

    service.create(payload).subscribe();

    const req = httpMock.expectOne('v1/special-selections');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockSelection);
  });

  it('update PUTs SpecialSelectionRequest to v1/special-selections/{id}', () => {
    const payload: SpecialSelectionRequest = {
      name: 'Combo Almuerzo',
      description: 'Sopa + plato fuerte',
      basePrice: 13.0,
      active: true,
      areaId: 1,
      baseRecipeEnabled: false,
      schedulingRequired: true,
      groups: [
        {
          id: 1,
          categoryId: 2,
          displayOrder: 1,
          required: true,
          minSelections: 1,
          maxSelections: 1,
          productIds: [10, 11, 12],
        },
      ],
      additions: [],
      questions: [],
      schedule: [],
    };

    service.update(7, payload).subscribe();

    const req = httpMock.expectOne('v1/special-selections/7');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(mockSelection);
  });

  it('delete DELETEs v1/special-selections/{id}', () => {
    service.delete(7).subscribe();

    const req = httpMock.expectOne('v1/special-selections/7');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('suggestPrice POSTs { marginPercent } to v1/special-selections/{id}/suggest-price', () => {
    const response = {
      suggestedPrice: 15.5,
      totalCost: 10.85,
      marginPercent: 30,
      breakdown: [{ productId: 10, name: 'Lentejas', cost: 1.2 }],
    };

    service.suggestPrice(7, { marginPercent: 30 }).subscribe(res => {
      expect(res.breakdown[0].productId).toBe(10);
    });

    const req = httpMock.expectOne('v1/special-selections/7/suggest-price');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ marginPercent: 30 });
    req.flush(response);
  });

  it('suggestPrice propagates 422 HttpErrorResponse with missingVariants', () => {
    const missingVariants = [42, 87];

    service.suggestPrice(7, { marginPercent: 30 }).subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(422);
        const body = err.error as { missingVariants: number[]; message: string };
        expect(body.missingVariants).toEqual([42, 87]);
      },
    });

    const req = httpMock.expectOne('v1/special-selections/7/suggest-price');
    expect(req.request.method).toBe('POST');
    req.flush(
      { status: 422, message: 'missing unit_cost', missingVariants },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
  });
});