const RE_MONTHLY = /^\d{4}-\d{2}$/;

export function isValidPeriodKey(key: string): boolean {
  return RE_MONTHLY.test(key);
}

export function isValidRange(from: string, to: string): boolean {
  if (!isValidPeriodKey(from) || !isValidPeriodKey(to)) return false;
  return comparePeriodKeys(from, to) <= 0;
}

export function comparePeriodKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function defaultPeriod(now: Date = new Date()): {
  from: string;
  to: string;
} {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const toKey = `${String(y)}-${m}`;
  const start = new Date(Date.UTC(y, now.getUTCMonth() - 5, 1));
  const fromKey = `${String(start.getUTCFullYear())}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  return { from: fromKey, to: toKey };
}

export function titleForKey(key: string, locale = 'es-CO'): string {
  const [y, m] = key.split('-');
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(d);
}
