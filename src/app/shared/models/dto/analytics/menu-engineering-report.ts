import { Money } from './money';
import { DataCompleteness } from './data-completeness';
import { Period } from './period';

export type MenuQuadrant = 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';
export const MENU_QUADRANTS: readonly MenuQuadrant[] = ['STAR', 'PLOWHORSE', 'PUZZLE', 'DOG'] as const;

export interface MenuEngineeringMedian {
  volume: number;
  margin: Money;
}
export interface MenuEngineeringItem {
  productId: number;
  productName: string;
  categoryId: number | null;
  categoryName: string | null;
  unitsSold: number;
  revenue: Money;
  recipeCost: Money;
  grossProfitPerUnit: Money;
  totalContribution: Money;
  quadrant: MenuQuadrant;
}
export interface MenuEngineeringCacheStatus {
  lastRefreshedAt: string;
  sourceVersion: string;
  ttlSeconds: number;
}
export interface MenuEngineeringReport {
  period: Period;
  median: MenuEngineeringMedian;
  items: MenuEngineeringItem[];
  cacheStatus: MenuEngineeringCacheStatus;
  dataCompleteness: DataCompleteness;
  notes?: string[];
}