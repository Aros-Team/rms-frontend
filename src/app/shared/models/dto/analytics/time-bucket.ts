export type TimeBucket = 'daily' | 'weekly' | 'monthly' | 'yearly';
export const TIME_BUCKETS: readonly TimeBucket[] = ['daily', 'weekly', 'monthly', 'yearly'] as const;