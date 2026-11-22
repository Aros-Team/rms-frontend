import { DataCompleteness } from './data-completeness';
import { Money } from './money';
import { Period } from './period';

/** Fingerprint strategy reported by the cohort service. */
export type CohortFingerprintStrategy = 'PHONE' | 'PHONE_OR_TABLE' | 'TABLE_ONLY';

/** One bucket key inside the requested cohort range. */
export interface CohortWindow {
  key: string;
  newClients: number;
  recurringClients: number;
  totalOrders: number;
  recurringRatePct: number;
}

/**
 * Wire shape of `GET /api/v1/analytics/cohort`.
 *
 * A "client" is an order visit identified by a phone/table fingerprint; this
 * module never invents a customer table. `cohorts[]` carries one row per bucket
 * key so the UI can render a retention chart and table.
 */
export interface CohortReport {
  period: Period;
  newClients: number;
  recurringClients: number;
  totalOrders: number;
  recurringRatePct: number;
  averageTicketPerOrder: Money;
  averageTicketPerCover: Money;
  fingerprintStrategy: CohortFingerprintStrategy;
  cohortWindowDays: number;
  cohorts: CohortWindow[];
  dataCompleteness: DataCompleteness;
  notes?: string[];
}
