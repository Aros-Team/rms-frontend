import { Injectable, computed, signal } from '@angular/core';
import { TimeBucket } from '@app/shared/models/dto/analytics/time-bucket';

const BUCKETS_DEFAULT: TimeBucket = 'monthly';

function lastNMonthsKey(n: number, now: Date = new Date()): { from: string; to: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const toDate = new Date(Date.UTC(y, m, 1));
  const fromDate = new Date(Date.UTC(y, m - (n - 1), 1));
  const fmt = (d: Date) =>
    `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return { from: fmt(fromDate), to: fmt(toDate) };
}

function lastNDaysKey(n: number, now: Date = new Date()): { from: string; to: string } {
  const toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - (n - 1));
  const fmt = (d: Date) =>
    `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { from: fmt(fromDate), to: fmt(toDate) };
}

function lastNWeeksKey(n: number, now: Date = new Date()): { from: string; to: string } {
  const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = current.getUTCDay() || 7;
  const monday = new Date(current);
  monday.setUTCDate(current.getUTCDate() - (dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fromDate = new Date(monday);
  fromDate.setUTCDate(monday.getUTCDate() - (n - 1) * 7);
  const toIsoWeek = (d: Date): string => {
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${String(target.getUTCFullYear())}-W${String(weekNum).padStart(2, '0')}`;
  };
  return { from: toIsoWeek(fromDate), to: toIsoWeek(sunday) };
}

function lastNYearsKey(n: number, now: Date = new Date()): { from: string; to: string } {
  const to = String(now.getUTCFullYear());
  const from = String(now.getUTCFullYear() - (n - 1));
  return { from, to };
}

function defaultRangeFor(bucket: TimeBucket, now: Date = new Date()): { from: string; to: string } {
  switch (bucket) {
    case 'daily':   return lastNDaysKey(30, now);
    case 'weekly':  return lastNWeeksKey(12, now);
    case 'monthly': return lastNMonthsKey(6, now);
    case 'yearly':  return lastNYearsKey(3, now);
  }
}

export interface PeriodSelection {
  bucket: TimeBucket;
  from: string;
  to: string;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsPeriodState {
  private readonly defaults = defaultRangeFor(BUCKETS_DEFAULT);
  readonly bucket = signal<TimeBucket>(BUCKETS_DEFAULT);
  readonly from = signal<string>(this.defaults.from);
  readonly to = signal<string>(this.defaults.to);
  readonly period = computed<PeriodSelection>(() => ({
    bucket: this.bucket(),
    from: this.from(),
    to: this.to(),
  }));

  setBucket(bucket: TimeBucket): void {
    if (this.bucket() === bucket) return;
    this.bucket.set(bucket);
    const refreshed = defaultRangeFor(bucket);
    this.from.set(refreshed.from);
    this.to.set(refreshed.to);
  }

  setRange(from: string, to: string): void {
    this.from.set(from);
    this.to.set(to);
  }

  reset(): void {
    const refreshed = defaultRangeFor(BUCKETS_DEFAULT);
    this.bucket.set(BUCKETS_DEFAULT);
    this.from.set(refreshed.from);
    this.to.set(refreshed.to);
  }
}