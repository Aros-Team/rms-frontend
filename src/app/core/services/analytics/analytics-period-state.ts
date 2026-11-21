import { Injectable, computed, signal } from '@angular/core';

function lastNMonthsKey(n: number, now: Date = new Date()): { from: string; to: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const toDate = new Date(Date.UTC(y, m, 1));
  const fromDate = new Date(Date.UTC(y, m - (n - 1), 1));
  const fmt = (d: Date) =>
    `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return { from: fmt(fromDate), to: fmt(toDate) };
}

export interface PeriodSelection {
  from: string;
  to: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsPeriodState {
  private readonly defaults = lastNMonthsKey(6);
  readonly from = signal<string>(this.defaults.from);
  readonly to = signal<string>(this.defaults.to);
  readonly period = computed<PeriodSelection>(() => ({
    from: this.from(),
    to: this.to(),
  }));

  setRange(from: string, to: string): void {
    this.from.set(from);
    this.to.set(to);
  }

  reset(): void {
    const refreshed = lastNMonthsKey(6);
    this.from.set(refreshed.from);
    this.to.set(refreshed.to);
  }
}
