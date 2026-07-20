import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { Analytics } from './analytics';
import { AlertsPage } from '@app/shared/models/dto/analytics/alert';

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
    it('GETs api/v1/analytics/prime-cost with bucket/from/to query params', () => {
      service.getPrimeCost('monthly', '2026-01', '2026-07').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'api/v1/analytics/prime-cost' &&
          r.params.get('bucket') === 'monthly' &&
          r.params.get('from') === '2026-01' &&
          r.params.get('to') === '2026-07',
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getMenuEngineering', () => {
    it('GETs api/v1/analytics/menu-engineering without categoryId when omitted', () => {
      service.getMenuEngineering('monthly', '2026-01', '2026-07').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'api/v1/analytics/menu-engineering' &&
          r.params.get('bucket') === 'monthly' &&
          r.params.get('from') === '2026-01' &&
          r.params.get('to') === '2026-07',
      );
      expect(req.request.params.has('categoryId')).toBe(false);
      req.flush({});
    });

    it('GETs api/v1/analytics/menu-engineering with categoryId when provided', () => {
      service.getMenuEngineering('monthly', '2026-01', '2026-07', 42).subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'api/v1/analytics/menu-engineering' &&
          r.params.get('categoryId') === '42',
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('listAlerts', () => {
    it('GETs api/v1/analytics/alerts with default limit=50 offset=0 when no filters', () => {
      service.listAlerts().subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'api/v1/analytics/alerts' &&
          r.params.get('limit') === '50' &&
          r.params.get('offset') === '0',
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('status')).toBe(false);
      expect(req.request.params.has('severity')).toBe(false);
      req.flush({ items: [], page: { limit: 50, offset: 0, total: 0 } } satisfies AlertsPage);
    });

    it('forwards status, severity, limit and offset as query params', () => {
      service
        .listAlerts({ status: 'OPEN', severity: 'RED', limit: 10, offset: 20 })
        .subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url === 'api/v1/analytics/alerts' &&
          r.params.get('status') === 'OPEN' &&
          r.params.get('severity') === 'RED' &&
          r.params.get('limit') === '10' &&
          r.params.get('offset') === '20',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ items: [], page: { limit: 10, offset: 20, total: 0 } });
    });
  });

  describe('markAlertRead', () => {
    it('PATCHes api/v1/analytics/alerts/{id}/read with empty body', () => {
      service.markAlertRead(17).subscribe();

      const req = httpMock.expectOne('api/v1/analytics/alerts/17/read');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush(null);
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