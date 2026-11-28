/**
 * Tests for the Supply HTTP service.
 *
 * Feature: CRUD operations for supply items via HTTP.
 * Contract: Makes correct GET/POST/PUT/DELETE requests with proper URLs and bodies.
 * Approach: Use HttpTestingController to intercept requests, assert method, URL, and body.
 */
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { Supply } from './supply';
import { PaginatedSuppliesResponse } from './supply';
import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { SupplyCategoryResponse } from '@app/shared/models/dto/supplies/supply-category-response';
import { SupplyResponse } from '@app/shared/models/dto/supplies/supply-response';

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
    unitCost: { amount: '12000.00', currency: 'COP' },
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Supply],
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
      service.getSupplyVariants().subscribe((value) => {
        emitted = value;
      });

      const req = httpMock.expectOne(
        (r) => r.url === 'v1/supplies/variants' && r.params.get('size') === '100',
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
      service.getSupplyVariants().subscribe((value) => {
        emitted = value;
      });

      const req = httpMock.expectOne(
        (r) => r.url === 'v1/supplies/variants' && r.params.get('size') === '100',
      );
      req.flush({});

      expect(emitted).toEqual([]);
    });
  });

  describe('getSupplyVariantsPaginated', () => {
    it('flattens nested page metadata into flat paginated response', () => {
      let emitted: PaginatedSuppliesResponse | undefined;
      service.getSupplyVariantsPaginated(1, 6).subscribe((value) => {
        emitted = value;
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'v1/supplies/variants' &&
          r.params.get('page') === '1' &&
          r.params.get('size') === '6',
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
      service.getSupplyVariantsPaginated(1, 6).subscribe((value) => {
        emitted = value;
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'v1/supplies/variants' &&
          r.params.get('page') === '1' &&
          r.params.get('size') === '6',
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

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'v1/supplies/variants' &&
          r.params.get('page') === '0' &&
          r.params.get('size') === '20',
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getSupplies', () => {
    it('unwraps the Spring Page envelope instead of returning the raw object', () => {
      let emitted: SupplyResponse[] | undefined;
      service.getSupplies().subscribe((value) => {
        emitted = value;
      });

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'v1/supplies' && r.params.get('page') === '0' && r.params.get('size') === '100',
      );
      expect(req.request.method).toBe('GET');

      req.flush({
        content: [{ id: 1, name: 'Carne de res', categoryId: 3, categoryName: 'Carnes' }],
        page: { size: 100, number: 0, totalElements: 1, totalPages: 1 },
      });

      expect(emitted).toEqual([
        { id: 1, name: 'Carne de res', categoryId: 3, categoryName: 'Carnes' },
      ]);
    });

    it('walks past the first page when the catalog is larger than the API cap', () => {
      let emitted: SupplyVariantResponse[] | undefined;
      service.getSupplyVariants().subscribe((value) => {
        emitted = value;
      });

      const firstPage = Array.from({ length: 100 }, (_, index) => ({
        ...mockVariant,
        id: index + 1,
      }));
      httpMock
        .expectOne((r) => r.url === 'v1/supplies/variants' && r.params.get('page') === '0')
        .flush({
          content: firstPage,
          page: { size: 100, number: 0, totalElements: 101, totalPages: 2 },
        });

      httpMock
        .expectOne((r) => r.url === 'v1/supplies/variants' && r.params.get('page') === '1')
        .flush({
          content: [{ ...mockVariant, id: 101 }],
          page: { size: 100, number: 1, totalElements: 101, totalPages: 2 },
        });

      expect(emitted).toHaveLength(101);
      expect(emitted?.at(-1)?.id).toBe(101);
    });
  });

  describe('getCategories', () => {
    it('requests supply categories and emits the response', () => {
      let emitted: SupplyCategoryResponse[] | undefined;
      service.getCategories().subscribe((value) => {
        emitted = value;
      });

      const req = httpMock.expectOne('v1/supplies/categories');
      expect(req.request.method).toBe('GET');

      req.flush([{ id: 1, name: 'Proteínas' }]);

      expect(emitted).toEqual([{ id: 1, name: 'Proteínas' }]);
    });
  });

  describe('createCategory', () => {
    it('posts the new category and emits the created response', () => {
      let emitted: SupplyCategoryResponse | undefined;
      service.createCategory({ name: 'Lácteos' }).subscribe((value) => {
        emitted = value;
      });

      const req = httpMock.expectOne('v1/supplies/categories');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Lácteos' });

      req.flush({ id: 2, name: 'Lácteos' });

      expect(emitted).toEqual({ id: 2, name: 'Lácteos' });
    });
  });
});
