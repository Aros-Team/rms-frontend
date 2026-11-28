/**
 * Tests for the Analytics HTTP service.
 *
 * Feature: typed clients for the five analytics modules, alerts mark-read,
 * refresh and the top-selling ranking.
 * Contract: every request hits `v1/...` with the documented query params.
 * Approach: HttpTestingController asserts method, URL and params.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Analytics } from './analytics';

describe('Analytics service', () => {
  let service: Analytics;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), Analytics],
    });
    service = TestBed.inject(Analytics);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GETs prime cost with bucket/from/to', () => {
    service.getPrimeCost('monthly', '2026-06', '2026-11').subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === 'v1/analytics/prime-cost' &&
        r.params.get('bucket') === 'monthly' &&
        r.params.get('from') === '2026-06' &&
        r.params.get('to') === '2026-11',
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('GETs menu engineering with an optional categoryId', () => {
    service.getMenuEngineering('monthly', '2026-06', '2026-11', 42).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === 'v1/analytics/menu-engineering' && r.params.get('categoryId') === '42',
    );
    req.flush({});
  });

  it('GETs operations and cohort with the period', () => {
    service.getOperations('weekly', '2026-W40', '2026-W47').subscribe();
    const operations = httpMock.expectOne((r) => r.url === 'v1/analytics/operations');
    expect(operations.request.params.get('bucket')).toBe('weekly');
    expect(operations.request.params.get('from')).toBe('2026-W40');
    operations.flush({});

    service.getCohort('daily', '2026-11-01', '2026-11-21').subscribe();
    const cohort = httpMock.expectOne((r) => r.url === 'v1/analytics/cohort');
    expect(cohort.request.params.get('bucket')).toBe('daily');
    cohort.flush({});
  });

  it('GETs alerts with filters and paging, adding defaults', () => {
    service.getAlerts({ status: 'OPEN', severity: 'RED', limit: 10, offset: 20 }).subscribe();
    const req = httpMock.expectOne((r) => r.url === 'v1/analytics/alerts');
    expect(req.request.params.get('status')).toBe('OPEN');
    expect(req.request.params.get('severity')).toBe('RED');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('offset')).toBe('20');
    expect(req.request.params.has('bucket')).toBe(false);
    req.flush({ items: [], page: { limit: 10, offset: 20, total: 0 } });
  });

  it('PATCHes the mark-read endpoint and accepts a 204', () => {
    service.markAlertRead(17).subscribe();
    const req = httpMock.expectOne('v1/analytics/alerts/17/read');
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
  });

  it('POSTs the refresh endpoint with months', () => {
    service.refreshAnalytics(6).subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === 'v1/analytics/refresh' && r.params.get('months') === '6',
    );
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('GETs the real top-selling ranking with date range and limit', () => {
    service.getTopSellingProducts('2026-11-01', '2026-11-21', 3).subscribe();
    const req = httpMock.expectOne(
      (r) =>
        r.url === 'v1/products/top-selling' &&
        r.params.get('from') === '2026-11-01' &&
        r.params.get('to') === '2026-11-21' &&
        r.params.get('limit') === '3',
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
