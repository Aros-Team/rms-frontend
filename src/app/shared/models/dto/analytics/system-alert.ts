import { TimeBucket } from './time-bucket';

/** Severity of a variance alert. */
export type AlertSeverity = 'RED' | 'YELLOW' | 'INFO';

/** Lifecycle status of a variance alert. */
export type AlertStatus = 'OPEN' | 'READ' | 'DISMISSED';

/** Rule that produced the alert (open string: the backend owns the enum). */
export type AlertType = string;

/**
 * Wire shape of one alert row in `AlertsPageResponse`.
 *
 * `baseline`, `current` and `deviationPct` are raw decimal numbers (the
 * contract uses a bare amount string for metrics, not a `MoneyDto`).
 */
export interface SystemAlert {
  id: number;
  severity: AlertSeverity;
  type: AlertType;
  message: string;
  metric: string;
  baseline: number | null;
  current: number | null;
  deviationPct: number | null;
  period: string;
  bucket: string;
  detectedAt: string;
  status: AlertStatus;
}

export interface AlertsPageInfo {
  limit: number;
  offset: number;
  total: number;
}

export interface AlertsPage {
  items: SystemAlert[];
  page: AlertsPageInfo;
}

/** Filters accepted by `GET /api/v1/analytics/alerts`. */
export interface AlertsQuery {
  status?: AlertStatus;
  severity?: AlertSeverity;
  bucket?: TimeBucket;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
