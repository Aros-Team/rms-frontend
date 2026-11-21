/** Time buckets accepted by the API analytics endpoints (`daily|weekly|monthly|yearly`). */
export type TimeBucket = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const TIME_BUCKETS: readonly TimeBucket[] = ['daily', 'weekly', 'monthly', 'yearly'] as const;
