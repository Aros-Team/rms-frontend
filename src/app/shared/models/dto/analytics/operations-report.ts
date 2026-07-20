import { Money } from './money';
import { DataCompleteness } from './data-completeness';
import { Period } from './period';

export type DayPart = 'LUNCH' | 'DINNER' | 'OTHER';
export const DAY_PARTS: readonly DayPart[] = ['LUNCH', 'DINNER', 'OTHER'] as const;

export interface OperationsRevPash {
  value: Money;
  totalNetSales: Money;
  totalAvailableSeatHours: number;
}
export interface OperationsTableTurnoverByDayPart {
  dayPart: DayPart;
  turns: number;
  covers: number;
  tables: number;
}
export interface OperationsTableTurnover {
  overall: number;
  byDayPart: OperationsTableTurnoverByDayPart[];
}
export interface OperationsReport {
  period: Period;
  revPash: OperationsRevPash;
  tableTurnover: OperationsTableTurnover;
  avgOccupancyMinutes: number;
  dataCompleteness: DataCompleteness;
  notes?: string[];
}