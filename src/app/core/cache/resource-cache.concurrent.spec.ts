/**
 * Tests for concurrent access patterns of ResourceCache.
 *
 * Feature: Thread-safety of cache load/invalidate/reset under rapid successive calls.
 * Contract: Concurrent loads don't duplicate requests; rapid reset/invalidate sequences are safe.
 * Approach: Create cache with controlled observables, trigger concurrent operations, assert state.
 */
import { describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';

import { ResourceCache } from './resource-cache/resource-cache';

// These tests guard against the bug where the AnalyticsCache service constructor
// ran an `effect()` that called `invalidate()` on every cache, which cancelled
// the in-flight HTTP request before the response arrived. The page rendered
// a frozen empty state because the component never received data.
describe('ResourceCache — concurrent request behavior (regression for the frozen analytics bug)', () => {
  it('load() does NOT cancel an in-flight request — the response still updates the cache', () => {
    const subject = new Subject<string>();
    const fetchFn = vi.fn(() => subject.asObservable());
    const cache = new ResourceCache<string>(fetchFn, { ttlMs: 60_000, staleWhileRevalidate: true });

    cache.load();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(cache.isLoading()).toBe(true);

    // Calling load() again while a request is in flight must be a no-op
    // (no new request, no cancel of the existing one).
    cache.load();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // The original request still resolves and updates the cache.
    subject.next('payload');
    subject.complete();
    expect(cache.data()).toBe('payload');
    expect(cache.isLoading()).toBe(false);
  });

  it('invalidate() DOES cancel an in-flight request — this is why the original effect() was wrong', () => {
    const subject = new Subject<string>();
    const fetchFn = vi.fn(() => subject.asObservable());
    const cache = new ResourceCache<string>(fetchFn, { ttlMs: 60_000, staleWhileRevalidate: true });

    cache.load();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // invalidate() kills the active request — the subscriber would never receive
    // its next callback. This is what the analytics effect() was doing wrong.
    cache.invalidate();
    subject.next('payload');
    subject.complete();
    expect(cache.data()).toBeNull();
  });

  it('load() called from a component effect() during initialization still resolves the response', () => {
    // This is the exact pattern the analytics components use:
    //   constructor() {
    //     effect(() => {
    //       this.period.period();
    //       this.cache.primeCost.load();
    //     });
    //   }
    // The effect runs once on the first microtask. Both the effect and the
    // constructor-driven load must coexist without losing the response.
    const subject = new Subject<string>();
    const fetchFn = vi.fn(() => subject.asObservable());
    const cache = new ResourceCache<string>(fetchFn, { ttlMs: 60_000, staleWhileRevalidate: true });

    // Simulate "constructor calls load, then effect runs load again"
    cache.load();
    cache.load();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    subject.next('first-payload');
    subject.complete();

    expect(cache.data()).toBe('first-payload');
    expect(cache.isLoading()).toBe(false);
  });
});
