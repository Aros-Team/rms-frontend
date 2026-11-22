import { DataCompleteness } from './data-completeness';
import { Money } from './money';
import { Period } from './period';

/**
 * Wire shape of `GET /api/v1/analytics/operations`.
 *
 * Mirrors `OperationsReportResponse` in the backend lane: RevPASH, covers,
 * table turnover (overall and per day part) and the labor share of net sales.
 * `dayPart` is an open string because the backend reads it from
 * `analytics_config` (`LUNCH` / `DINNER` / `OTHER` today).
 */
export interface OperationsRevPash {
  value: Money;
  totalNetSales: Money;
  totalAvailableSeatHours: number;
}

export interface OperationsDayPartTurnover {
  dayPart: string;
  turns: number;
  covers: number;
  tables: number;
}

export interface OperationsTableTurnover {
  overall: number;
  byDayPart: OperationsDayPartTurnover[];
}

export interface OperationsLabor {
  totalCost: Money;
  sharePct: number;
}

export interface OperationsReport {
  period: Period;
  revPash: OperationsRevPash;
  tableTurnover: OperationsTableTurnover;
  labor: OperationsLabor;
  covers: number;
  orders: number;
  avgOccupancyMinutes: number;
  totalOccupiedSeatMinutes: number;
  dataCompleteness: DataCompleteness;
  notes?: string[];
}
