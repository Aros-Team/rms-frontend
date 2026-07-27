import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { Analytics } from './analytics';
import { urlInterceptor } from '@app/core/interceptors/url-interceptor/url-interceptor';
import { jwtInterceptor } from '@app/core/interceptors/jwt/jwt';
import { errorInterceptor } from '@app/core/interceptors/error/error';

// These tests guard against the api/api/... double-prefix bug (the original 404).
// They verify that the final URL has /api/v1/... and NOT /api/api/v1/... regardless of
// which environment file (production or development) is active.
describe('Analytics service — full interceptor chain (regression for the api/api/... double-prefix bug)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([urlInterceptor, jwtInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        Analytics,
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reaches /api/v1/analytics/prime-cost (no /api/api/... double prefix)', () => {
    TestBed.inject(Analytics).getPrimeCost('monthly', '2026-01', '2026-07').subscribe();

    const req = httpMock.expectOne((r) => /\/api\/v1\/analytics\/prime-cost(\?|$)/.test(r.url));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('bucket')).toBe('monthly');
    expect(req.request.params.get('from')).toBe('2026-01');
    expect(req.request.params.get('to')).toBe('2026-07');
    // The bug: apiUrl already had "/api" and the service URL had "api/v1/..." -> /api/api/v1/...
    expect(req.request.url).not.toContain('/api/api/');
    req.flush({});
  });

  it('reaches /api/v1/analytics/menu-engineering (no double prefix)', () => {
    TestBed.inject(Analytics).getMenuEngineering('monthly', '2026-01', '2026-07').subscribe();

    const req = httpMock.expectOne(
      (r) => /\/api\/v1\/analytics\/menu-engineering(\?|$)/.test(r.url),
    );
    expect(req.request.url).not.toContain('/api/api/');
    req.flush({});
  });

  it('does NOT issue a request to /api/api/v1/... (the original double-prefix bug)', () => {
    TestBed.inject(Analytics).getPrimeCost('monthly', '2026-01', '2026-07').subscribe();

    const doublePrefixed = httpMock.match((r) => r.url.includes('/api/api/'));
    expect(doublePrefixed).toHaveLength(0);
    const req = httpMock.expectOne((r) => r.url.includes('/api/v1/analytics/prime-cost'));
    req.flush({});
  });
});
