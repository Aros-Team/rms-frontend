import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { Analytics } from './analytics';

describe('Analytics service', () => {
  let service: Analytics;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Analytics],
    });

    service = TestBed.inject(Analytics);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getPrimeCost', () => {
    it('GETs v1/analytics/prime-cost with bucket=monthly/from/to query params', () => {
      service.getPrimeCost('2026-01', '2026-07').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'v1/analytics/prime-cost' &&
          r.params.get('bucket') === 'monthly' &&
          r.params.get('from') === '2026-01' &&
          r.params.get('to') === '2026-07',
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getMenuEngineering', () => {
    it('GETs v1/analytics/menu-engineering without categoryId when omitted', () => {
      service.getMenuEngineering('2026-01', '2026-07').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'v1/analytics/menu-engineering' &&
          r.params.get('bucket') === 'monthly' &&
          r.params.get('from') === '2026-01' &&
          r.params.get('to') === '2026-07',
      );
      expect(req.request.params.has('categoryId')).toBe(false);
      req.flush({});
    });

    it('GETs v1/analytics/menu-engineering with categoryId when provided', () => {
      service.getMenuEngineering('2026-01', '2026-07', 42).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'v1/analytics/menu-engineering' &&
          r.params.get('categoryId') === '42',
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getTopSellingProducts (legacy)', () => {
    it('GETs v1/products/top-selling without params', () => {
      service.getTopSellingProducts().subscribe();

      const req = httpMock.expectOne((r) => r.url === 'v1/products/top-selling');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });
  });
});
