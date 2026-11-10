/**
 * Tests for the response-envelope interceptor.
 *
 * Feature: Unwraps the backend's `{"data": <payload>}` envelope exactly once at
 * the HTTP boundary so services can keep reading flat payloads.
 * Contract:
 *  - wrapped object `{data:{…}}` → inner object
 *  - wrapped paged payload `{data:{content:[]}}` → `{content:[]}`
 *  - flat/unwrapped body (rollback) → unchanged, byte for byte
 *  - `{data, meta}` / `{data, pagination}` → `data` returned, siblings dropped
 *  - `{data:null}` → `null`
 *  - `204 No Content` / empty body → stays `null`
 *  - array body → untouched (never mistaken for an envelope)
 *  - `Blob` body → untouched (downloads keep working)
 *  - error response → untouched: error body and status arrive unchanged
 *
 * Approach: TestBed with the real interceptor inside the HttpClient chain and
 * HttpTestingController flushing the EXACT live payloads; assert the emitted
 * body identity/shape, not just "no crash".
 */
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import { envelopeInterceptor } from './envelope';

describe('envelopeInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([envelopeInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  function get(url: string): { flush: (body: unknown) => void; received: () => unknown } {
    let received: unknown;
    http.get(url).subscribe((value) => {
      received = value;
    });
    return {
      flush: (body: unknown) => {
        httpMock.expectOne(url).flush(body);
      },
      received: () => received,
    };
  }

  it('unwraps a wrapped object payload', () => {
    const call = get('/v1/products/1');

    call.flush({ data: { id: 1, name: 'Café Americano' } });

    expect(call.received()).toEqual({ id: 1, name: 'Café Americano' });
  });

  it('unwraps a wrapped Spring HATEOAS page to the bare content envelope', () => {
    const call = get('/v1/products');

    call.flush({ data: { content: [1, 2, 3], page: { number: 0, totalPages: 1 } } });

    expect(call.received()).toEqual({ content: [1, 2, 3], page: { number: 0, totalPages: 1 } });
  });

  it('passes a flat (already unwrapped) body through unchanged when the envelope is rolled back', () => {
    const flat = { id: 7, name: 'Flat payload' };
    const call = get('/v1/supplies/7');

    call.flush(flat);

    expect(call.received()).toBe(flat);
  });

  it('returns data when the envelope carries sibling meta keys', () => {
    const call = get('/v1/orders');

    call.flush({ data: { items: ['a', 'b'] }, meta: { requestId: 'x' } });

    expect(call.received()).toEqual({ items: ['a', 'b'] });
  });

  it('returns data when the envelope carries a sibling pagination block', () => {
    const call = get('/v1/orders?page=0');

    call.flush({ data: { items: [1, 2] }, pagination: { page: 0, totalPages: 1 } });

    expect(call.received()).toEqual({ items: [1, 2] });
  });

  it('unwraps an explicit null data payload to null', () => {
    const call = get('/v1/products/999');

    call.flush({ data: null });

    expect(call.received()).toBeNull();
  });

  it('keeps a 204 No Content body as null', () => {
    const call = get('/v1/products/1');

    httpMock.expectOne('/v1/products/1').flush(null, { status: 204, statusText: 'No Content' });

    expect(call.received()).toBeNull();
  });

  it('leaves an array body untouched', () => {
    const rest = [{ id: 1 }, { id: 2 }];
    const call = get('/v1/categories');

    call.flush(rest);

    expect(call.received()).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('leaves a Blob body untouched so downloads keep working', () => {
    const blob = new Blob(['report'], { type: 'text/csv' });
    let received: Blob | undefined;
    http
      .get('/v1/reports/export', { responseType: 'blob' })
      .subscribe((value) => (received = value));

    httpMock
      .expectOne('/v1/reports/export')
      .flush(blob, { status: 200, statusText: 'OK' });

    expect(received).toBe(blob);
  });

  it('leaves error responses untouched: status and RFC-7807 body arrive as sent', () => {
    let error: HttpErrorResponse | undefined;
    http.get('/v1/orders').subscribe({ error: (err: HttpErrorResponse) => (error = err) });

    const applicationError = {
      detail: 'Credenciales inválidas',
      instance: '/api/auth/login',
      status: 401,
      title: 'Unauthorized',
    };
    httpMock
      .expectOne('/v1/orders')
      .flush(applicationError, { status: 401, statusText: 'Unauthorized' });

    expect(error?.status).toBe(401);
    expect(error?.error).toEqual(applicationError);
  });

  it('leaves a bodyless 401 untouched', () => {
    let error: HttpErrorResponse | undefined;
    http.get('/v1/orders').subscribe({ error: (err: HttpErrorResponse) => (error = err) });

    httpMock
      .expectOne('/v1/orders')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(error?.status).toBe(401);
    expect(error?.error).toBeNull();
  });
});
