import { MetricValue } from './metric-value';

export type AlertSeverity = 'RED' | 'YELLOW' | 'INFO';
export type AlertStatus = 'OPEN' | 'READ' | 'DISMISSED';
export type AlertType =
  | 'FOOD_COST_DEVIATION'
  | 'LABOR_COST_DEVIATION'
  | 'SALES_DROP_YOY'
  | 'LOW_MARGIN_SKU_SPIKE'
  | 'REVPASH_DROP';

export const ALERT_SEVERITIES: readonly AlertSeverity[] = ['RED', 'YELLOW', 'INFO'] as const;
export const ALERT_STATUSES: readonly AlertStatus[] = ['OPEN', 'READ', 'DISMISSED'] as const;
export const ALERT_TYPES: readonly AlertType[] = [
  'FOOD_COST_DEVIATION',
  'LABOR_COST_DEVIATION',
  'SALES_DROP_YOY',
  'LOW_MARGIN_SKU_SPIKE',
  'REVPASH_DROP',
] as const;

export interface Alert {
  id: number;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  metric: string;
  baseline?: MetricValue;
  current: MetricValue;
  deviationPct: number;
  period: string;
  detectedAt: string;
  status: AlertStatus;
}
export interface AlertsPageMeta {
  limit: number;
  offset: number;
  total: number;
}
export interface AlertsPage {
  items: Alert[];
  page: AlertsPageMeta;
}