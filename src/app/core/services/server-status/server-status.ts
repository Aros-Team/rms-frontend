import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export type ServerStatusValue = 'online' | 'offline' | 'checking';

@Injectable({ providedIn: 'root' })
export class ServerStatus {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  private statusSignal = signal<ServerStatusValue>('checking');
  private lastCheckSignal = signal<Date | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly status = computed(() => this.statusSignal());
  readonly lastCheck = computed(() => this.lastCheckSignal());
  readonly isOnline = computed(() => this.statusSignal() === 'online');
  readonly isOffline = computed(() => this.statusSignal() === 'offline');
  readonly isChecking = computed(() => this.statusSignal() === 'checking');

  constructor() {
    this.destroyRef.onDestroy(() => { clearTimeout(this.timer); });
    this.check();
  }

  reportSuccess(): void {
    if (this.statusSignal() !== 'online') {
      this.statusSignal.set('online');
      this.lastCheckSignal.set(new Date());
    }
  }

  reportNetworkError(): void {
    if (this.statusSignal() !== 'offline') {
      this.statusSignal.set('offline');
      this.lastCheckSignal.set(new Date());
    }
  }

  check(): void {
    if (this.statusSignal() === 'checking') return;
    clearTimeout(this.timer);
    this.statusSignal.set('checking');
    this.ping().subscribe({
      next: (isUp) => {
        this.statusSignal.set(isUp ? 'online' : 'offline');
        this.lastCheckSignal.set(new Date());
        this.scheduleNext();
      },
      error: () => {
        this.statusSignal.set('offline');
        this.lastCheckSignal.set(new Date());
        this.scheduleNext();
      }
    });
  }

  private ping() {
    const baseUrl = environment.apiUrl.replace('/api', '');
    return this.http.get<{ status: string }>(`${baseUrl}/health`).pipe(
      map(response => response.status === 'UP'),
      catchError(() => { return of(false); })
    );
  }

  private scheduleNext(): void {
    clearTimeout(this.timer);
    const delay = this.statusSignal() === 'offline' ? 15000 : 30000;
    this.timer = setTimeout(() => { this.check(); }, delay);
  }
}