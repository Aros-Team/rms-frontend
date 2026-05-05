import { signal, computed, type Signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface CacheConfig {
  ttlMs: number;
  staleWhileRevalidate: boolean;
}

export interface CacheEntry<T> {
  data: T | null;
  timestamp: number;
  status: 'fresh' | 'stale' | 'loading';
  error?: Error;
}

export class ResourceCache<T> {
  private readonly entry = signal<CacheEntry<T>>({
    data: null,
    timestamp: 0,
    status: 'stale'
  });

  private readonly _config: CacheConfig;
  private fetchFn: () => Observable<T>;
  private isLoadingFlag = false;

  readonly data: Signal<T | null> = computed(() => this.entry().data);
  readonly status: Signal<'fresh' | 'stale' | 'loading'> = computed(() => this.entry().status);
  readonly error: Signal<Error | undefined> = computed(() => this.entry().error);
  readonly isLoading: Signal<boolean> = computed(() => this.entry().status === 'loading');
  readonly hasData: Signal<boolean> = computed(() => this.entry().data !== null);

  constructor(
    fetchFn: () => Observable<T>,
    config: Partial<CacheConfig> = {}
  ) {
    this.fetchFn = fetchFn;
    this._config = {
      ttlMs: 5 * 60 * 1000,
      staleWhileRevalidate: true,
      ...config
    };
  }

  load(): void {
    if (this.isLoadingFlag) return;

    const current = this.entry();
    
    if (this._config.staleWhileRevalidate && current.data !== null) {
      this.entry.set({ ...current, status: 'stale' });
      this.fetchFresh();
    } else {
      this.entry.set({ data: null, timestamp: 0, status: 'loading' });
      this.fetchFresh();
    }
  }

  loadIfStale(): void {
    const current = this.entry();
    if (current.status === 'loading') return;
    
    if (current.status === 'stale' || !current.data || this.isExpired(current)) {
      this.load();
    }
  }

  refresh(): void {
    this.entry.update(current => ({ ...current, status: 'stale' }));
    this.load();
  }

  invalidate(): void {
    const current = this.entry();
    if (current.data !== null) {
      this.entry.set({ ...current, status: 'stale' });
    }
  }

  /**
   * Applies a pure transform function to the cached data without triggering
   * an HTTP fetch. Useful for applying real-time WebSocket updates in-place.
   * No-op if there is no data in cache yet.
   */
  patchData(updater: (current: T) => T): void {
    const current = this.entry();
    if (current.data === null) return;
    this.entry.set({ ...current, data: updater(current.data) });
  }

  reset(): void {
    this.entry.set({ data: null, timestamp: 0, status: 'stale' });
  }

  private fetchFresh(): void {
    this.isLoadingFlag = true;
    
    this.fetchFn().subscribe({
      next: (data) => {
        this.entry.set({
          data,
          timestamp: Date.now(),
          status: 'fresh'
        });
        this.isLoadingFlag = false;
      },
      error: (err) => {
        const current = this.entry();
        this.entry.set({
          ...current,
          status: 'stale',
          error: err instanceof Error ? err : new Error(String(err))
        });
        this.isLoadingFlag = false;
      }
    });
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this._config.ttlMs;
  }
}
