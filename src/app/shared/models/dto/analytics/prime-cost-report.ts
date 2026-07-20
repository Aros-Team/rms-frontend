import { Money } from './money';
import { DataCompleteness } from './data-completeness';
import { Period } from './period';

export type CogsCategory = 'FOOD' | 'BEVERAGE' | 'ALCOHOL' | 'OTHER';
export type LaborArea = 'FOH' | 'BOH' | 'OTHER';
export const COGS_CATEGORIES: readonly CogsCategory[] = ['FOOD', 'BEVERAGE', 'ALCOHOL', 'OTHER'] as const;
export const LABOR_AREAS: readonly LaborArea[] = ['FOH', 'BOH', 'OTHER'] as const;

export interface PrimeCostCogsBreakdownRow {
  category: CogsCategory;
  amount: Money;
  pct: number;
}
export interface PrimeCostLaborBreakdownRow {
  area: LaborArea;
  amount: Money;
  pct: number;
}
export interface PrimeCostPeriod {
  key: string;
  netSales: Money;
  grossSales: Money;
  discounts?: Money;
  comped?: Money;
  cogs: { total: Money; byCategory: PrimeCostCogsBreakdownRow[] };
  labor: { total: Money; byArea: PrimeCostLaborBreakdownRow[] };
  primeCost: Money;
  primeCostPct: number;
  margins?: { grossProfitPct?: number; netProfitPct?: number };
  dataCompleteness: DataCompleteness;
}
export interface PrimeCostReport {
  period: Period;
  series: PrimeCostPeriod[];
  dataCompleteness: DataCompleteness;
  notes?: string[];
}