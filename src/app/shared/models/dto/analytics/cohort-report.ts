import { Money } from './money';
import { DataCompleteness } from './data-completeness';
import { Period } from './period';

export type FingerprintStrategy = 'PHONE' | 'PHONE_OR_TABLE' | 'TABLE_ONLY';

export interface CohortReport {
  period: Period;
  newClients: number;
  recurringClients: number;
  totalOrders: number;
  recurringRatePct: number;
  averageTicketPerOrder: Money;
  averageTicketPerCover: Money;
  fingerprintStrategy: FingerprintStrategy;
  dataCompleteness: DataCompleteness;
  notes?: string[];
}