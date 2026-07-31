import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { Supply } from './supply';
import { PaginatedSuppliesResponse } from './supply';
import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';

describe('Supply service', () => {
  let service: Supply;
  let httpMock: HttpTestingController;

  const mockVariant: SupplyVariantResponse = {
    id: 1,
    supplyId: 10,
    supplyName: 'Carne de res',
    categoryId: 3,
    categoryName: 'Carnes',
    unitId: 2,
    unitAbbreviation: 'kg',
    quantity: 1,
    stockBodega: 5,
    stockCocina: 2,
    unitCost: 12000,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        Supply,
      ],
    });

    service = TestBed.inject(Supply);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getSupplyVariants', () => {
    it('requests max size and unwraps content from paged response', () => {
      let emitted: SupplyVariantResponse[] | undefined;
      service.getSupplyVariants().subscribe(value => {
        emitted = value;
      });

      const req = httpMock.expectOne(r =>
        r.url === 'v1/supplies/variants' &&
        r.params.get('size') === '100'
      );
      expect(req.request.method).toBe('GET');

      req.flush({
        content: [mockVariant],
        page: { size: 100, number: 0, totalElements: 1, totalPages: 1 },
      });

      expect(emitted).toEqual([mockVariant]);
    });

    it('falls back to empty array when content is missing', () => {
      let emitted: SupplyVariantResponse[] | undefined;
      service.getSupplyVariants().subscribe(value => {
        emitted = value;
      });

      const req = httpMock.expectOne(r =>
        r.url === 'v1/supplies/variants' &&
        r.params.get('size') === '100'
      );
      req.flush({});

      expect(emitted).toEqual([]);
    });
  });

  describe('getSupplyVariantsPaginated', () => {
    it('flattens nested page metadata into flat paginated response', () => {
      let emitted: PaginatedSuppliesResponse | undefined;
      service.getSupplyVariantsPaginated(1, 6).subscribe(value => {
        emitted = value;
      });

      const req = httpMock.expectOne(r =>
        r.url === 'v1/supplies/variants' &&
        r.params.get('page') === '1' &&
        r.params.get('size') === '6'
      );
      expect(req.request.method).toBe('GET');

      req.flush({
        content: [mockVariant],
        page: { size: 6, number: 1, totalElements: 42, totalPages: 7 },
      });

      expect(emitted).toEqual({
        content: [mockVariant],
        totalElements: 42,
        totalPages: 7,
        page: 1,
        size: 6,
      });
    });

    it('falls back to empty defaults when page metadata is missing', () => {
      let emitted: PaginatedSuppliesResponse | undefined;
      service.getSupplyVariantsPaginated(1, 6).subscribe(value => {
        emitted = value;
      });

      const req = httpMock.expectOne(r =>
        r.url === 'v1/supplies/variants' &&
        r.params.get('page') === '1' &&
        r.params.get('size') === '6'
      );
      req.flush({});

      expect(emitted).toEqual({
        content: [],
        totalElements: 0,
        totalPages: 0,
        page: 0,
        size: 0,
      });
    });

    it('omits params when not passed', () => {
      service.getSupplyVariantsPaginated().subscribe();

      const req = httpMock.expectOne(r =>
        r.url === 'v1/supplies/variants' &&
        r.params.get('page') === '0' &&
        r.params.get('size') === '20'
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });
});
