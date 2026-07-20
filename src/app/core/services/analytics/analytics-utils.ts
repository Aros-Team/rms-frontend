import { TimeBucket } from '@app/shared/models/dto/analytics/time-bucket';

const RE_DAILY = /^\d{4}-\d{2}-\d{2}$/;
const RE_WEEKLY = /^\d{4}-W\d{2}$/;
const RE_MONTHLY = /^\d{4}-\d{2}$/;
const RE_YEARLY = /^\d{4}$/;

export function isValidPeriodKey(key: string, bucket: TimeBucket): boolean {
  switch (bucket) {
    case 'daily':
      return RE_DAILY.test(key) && !Number.isNaN(Date.parse(key));
    case 'weekly':
      return RE_WEEKLY.test(key);
    case 'monthly':
      return RE_MONTHLY.test(key);
    case 'yearly':
      return RE_YEARLY.test(key);
  }
}

export function isValidRange(from: string, to: string, bucket: TimeBucket): boolean {
  if (!isValidPeriodKey(from, bucket) || !isValidPeriodKey(to, bucket)) return false;
  return comparePeriodKeys(from, to, bucket) <= 0;
}

export function comparePeriodKeys(a: string, b: string, bucket: TimeBucket): number {
  switch (bucket) {
    case 'daily':
      return Date.parse(a) - Date.parse(b);
    case 'monthly':
      return a.localeCompare(b);
    case 'yearly':
      return a.localeCompare(b);
    case 'weekly': {
      const [ya, wa] = a.split('-W');
      const [yb, wb] = b.split('-W');
      const yc = Number(ya) - Number(yb);
      return yc !== 0 ? yc : Number(wa) - Number(wb);
    }
  }
}

export function defaultPeriod(now: Date = new Date()): {
  bucket: TimeBucket;
  from: string;
  to: string;
} {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const toKey = `${String(y)}-${m}`;
  const start = new Date(Date.UTC(y, now.getUTCMonth() - 5, 1));
  const fromKey = `${String(start.getUTCFullYear())}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  return { bucket: 'monthly', from: fromKey, to: toKey };
}

export function titleForKey(key: string, bucket: TimeBucket, locale = 'es-CO'): string {
  const fmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  switch (bucket) {
    case 'daily':
      return fmt.format(new Date(key));
    case 'monthly': {
      const [y, m] = key.split('-');
      const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(d);
    }
    case 'yearly':
      return key;
    case 'weekly':
      return key.replace('-W', ' · semana ');
  }
}
