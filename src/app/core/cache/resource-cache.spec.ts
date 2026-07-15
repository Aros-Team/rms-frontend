import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';

import { ResourceCache } from './resource-cache';

describe('ResourceCache', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;

  interface Sample {
    id: number;
    label: string;
  }

  const freshSample: Sample = { id: 1, label: 'fresh' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('in-flight cancellation', () => {
    it('invalidate() cancels the in-flight request, keeps prior data, and marks stale', () => {
      const cache = new ResourceCache<Sample>(
        () => httpClient.get<Sample>('v1/sample'),
        { ttlMs: 60_000, staleWhileRevalidate: true },
      );

      cache.load();
      httpMock.expectOne('v1/sample').flush(freshSample);
      expect(cache.data()).toEqual(freshSample);
      expect(cache.status()).toBe('fresh');

      cache.load();
      const inflight = httpMock.expectOne('v1/sample');
      expect(inflight.cancelled).toBe(false);

      cache.invalidate();

      expect(inflight.cancelled).toBe(true);
      expect(cache.status()).toBe('stale');
      expect(cache.data()).toEqual(freshSample);
    });

    it('reset() cancels the in-flight request, clears data, and marks stale', () => {
      const cache = new ResourceCache<Sample>(
        () => httpClient.get<Sample>('v1/sample'),
        { ttlMs: 60_000, staleWhileRevalidate: true },
      );

      cache.load();
      httpMock.expectOne('v1/sample').flush(freshSample);
      expect(cache.hasData()).toBe(true);

      cache.load();
      const inflight = httpMock.expectOne('v1/sample');

      cache.reset();

      expect(inflight.cancelled).toBe(true);
      expect(cache.status()).toBe('stale');
      expect(cache.data()).toBeNull();
      expect(cache.hasData()).toBe(false);
    });

    it('refresh() cancels the in-flight request and starts a new fetch with a new version', () => {
      const cache = new ResourceCache<Sample>(
        () => httpClient.get<Sample>('v1/sample'),
        { ttlMs: 60_000, staleWhileRevalidate: true },
      );

      cache.load();
      httpMock.expectOne('v1/sample').flush(freshSample);

      cache.load();
      const inflight = httpMock.expectOne('v1/sample');

      cache.refresh();

      expect(inflight.cancelled).toBe(true);
      expect(cache.status()).toBe('stale');
      expect(cache.data()).toEqual(freshSample);

      const next = httpMock.expectOne('v1/sample');
      expect(next.cancelled).toBe(false);
      next.flush({ id: 2, label: 'refreshed' });

      expect(cache.status()).toBe('fresh');
      expect(cache.data()).toEqual({ id: 2, label: 'refreshed' });
    });
  });

  describe('late response handling', () => {
    it('ignores a late response from a superseded fetch when invalidate() runs mid-flight', () => {
      const cache = new ResourceCache<Sample>(
        () => httpClient.get<Sample>('v1/sample'),
        { ttlMs: 60_000, staleWhileRevalidate: true },
      );

      cache.load();
      httpMock.expectOne('v1/sample').flush(freshSample);

      cache.load();
      const inflight = httpMock.expectOne('v1/sample');

      cache.invalidate();

      expect(inflight.cancelled).toBe(true);
      expect(cache.data()).toEqual(freshSample);

      cache.load();
      const replacement = httpMock.expectOne('v1/sample');
      replacement.flush({ id: 99, label: 'replacement' });

      expect(cache.data()).toEqual({ id: 99, label: 'replacement' });
      expect(cache.status()).toBe('fresh');
    });

    it('ignores a late response from a reset fetch even if the upstream observable still emits', () => {
      const subject = new Subject<Sample>();
      const cache = new ResourceCache<Sample>(
        () => subject.asObservable(),
        { ttlMs: 60_000, staleWhileRevalidate: true },
      );

      cache.load();
      expect(cache.status()).toBe('loading');

      cache.reset();

      expect(cache.data()).toBeNull();
      expect(cache.status()).toBe('stale');

      subject.next({ id: 42, label: 'late leak' });

      expect(cache.data()).toBeNull();
      expect(cache.hasData()).toBe(false);
      expect(cache.status()).toBe('stale');
    });

    it('ignores a late response from an invalidated fetch even if the upstream observable still emits', () => {
      const subject = new Subject<Sample>();
      const cache = new ResourceCache<Sample>(
        () => subject.asObservable(),
        { ttlMs: 60_000, staleWhileRevalidate: true },
      );

      cache.load();
      subject.next({ id: 1, label: 'first' });
      expect(cache.data()).toEqual({ id: 1, label: 'first' });
      expect(cache.status()).toBe('fresh');

      cache.load();
      expect(cache.status()).toBe('stale');

      cache.invalidate();
      expect(cache.status()).toBe('stale');
      expect(cache.data()).toEqual({ id: 1, label: 'first' });

      subject.next({ id: 99, label: 'late leak' });

      expect(cache.data()).toEqual({ id: 1, label: 'first' });
      expect(cache.status()).toBe('stale');
    });
  });

  describe('version behavior on reset', () => {
    it('reset() followed by load() produces a fresh request and accepts its response', () => {
      const cache = new ResourceCache<Sample>(
        () => httpClient.get<Sample>('v1/sample'),
        { ttlMs: 60_000, staleWhileRevalidate: true },
      );

      cache.load();
      httpMock.expectOne('v1/sample').flush(freshSample);

      cache.reset();
      cache.load();

      const replacement = httpMock.expectOne('v1/sample');
      expect(replacement.cancelled).toBe(false);
      replacement.flush({ id: 7, label: 'post-reset' });

      expect(cache.data()).toEqual({ id: 7, label: 'post-reset' });
      expect(cache.status()).toBe('fresh');
    });

    it('multiple consecutive reset() calls during in-flight requests all cancel without restoring data', () => {
      const cache = new ResourceCache<Sample>(
        () => httpClient.get<Sample>('v1/sample'),
        { ttlMs: 60_000, staleWhileRevalidate: true },
      );

      cache.load();
      httpMock.expectOne('v1/sample').flush(freshSample);

      cache.load();
      const first = httpMock.expectOne('v1/sample');
      cache.reset();
      expect(first.cancelled).toBe(true);

      cache.load();
      const second = httpMock.expectOne('v1/sample');
      cache.reset();
      expect(second.cancelled).toBe(true);

      cache.load();
      const third = httpMock.expectOne('v1/sample');
      cache.reset();
      expect(third.cancelled).toBe(true);

      expect(cache.data()).toBeNull();
      expect(cache.hasData()).toBe(false);
      expect(cache.status()).toBe('stale');
    });
  });
});