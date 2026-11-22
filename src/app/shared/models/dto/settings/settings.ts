/**
 * Wire types for the typed settings API (`/api/v1/settings`), the legacy
 * configuration groups (`/api/v1/config`) and the admin user list
 * (`/api/v1/users`).
 *
 * The success envelope (`{ "data": … }`) is unwrapped once by the envelope
 * interceptor, so these interfaces describe the inner payload only. Every
 * failure arrives as RFC 7807 `application/problem+json`; see
 * `core/services/settings/problem-detail.ts`.
 */
import type { MoneyDto } from '@models/dto/common/money';

/** Costing strategy used by the product cost engine (`LaborCostMode`). */
export type LaborCostMode = 'AUTO' | 'REAL' | 'STANDARD';

/** User role (`UserRole`). */
export type UserRoleValue = 'ADMIN' | 'WORKER';

/**
 * User status (`UserStatus`). Only `ACTIVE` and `INACTIVE` are accepted by the
 * status PATCH; `PENDING` and `ERROR` are read-only observations.
 */
export type UserStatusValue = 'PENDING' | 'ERROR' | 'ACTIVE' | 'INACTIVE';

/** `BusinessProfileResponse` / `BusinessProfileRequest`. */
export interface BusinessProfile {
  restaurantName: string;
  legalName: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  /** IANA zone, e.g. `America/Bogota`. */
  timezone: string;
  /** BCP 47 tag, e.g. `es-CO`. */
  locale: string;
}

/** `CurrencySettingsResponse`. */
export interface CurrencySettings {
  /** ISO 4217 alphabetic code. */
  code: string;
  displayName: string;
  symbol: string;
  defaultFractionDigits: number;
}

/** `CurrencySettingsRequest`. */
export interface CurrencySettingsRequest {
  code: string;
}

/** `LaborSettingsResponse`. */
export interface LaborSettings {
  mode: LaborCostMode;
  standardHourlyRate: MoneyDto;
  defaultExpectedHoursPerMonth: number;
}

/**
 * `LaborSettingsRequest`. The backend takes a raw `BigDecimal` for the rate and
 * wraps it in the active currency; the response comes back as `MoneyDto`.
 */
export interface LaborSettingsRequest {
  mode: LaborCostMode;
  standardHourlyRate: number;
  defaultExpectedHoursPerMonth: number;
}

/** `NotificationSettingsRequest`, used for both directions. */
export interface NotificationSettings {
  kitchenSoundEnabled: boolean;
  kitchenHapticsEnabled: boolean;
  lowStockAlertsEnabled: boolean;
  orderAlertsEnabled: boolean;
  dailySummaryEnabled: boolean;
}

/** `ConfigEntryResponse`. */
export interface ConfigEntry {
  id: number;
  key: string;
  value: string;
  description: string | null;
  groupId: number;
  sortOrder: number;
  updatedAt: string;
}

/** `ConfigGroupResponse` with its entries. */
export interface ConfigGroup {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  entries: ConfigEntry[];
}

/** `ConfigGroupRequest` (create or rename/reorder). */
export interface ConfigGroupRequest {
  name?: string | null;
  description?: string | null;
  sortOrder?: number | null;
}

/** `ConfigEntryRequest`; the bulk PUT upserts by key. */
export interface ConfigEntryRequest {
  key: string;
  value: string;
  groupId?: number | null;
  sortOrder?: number | null;
}

/** `ConfigEntryUpdateRequest`; every field is optional. */
export interface ConfigEntryUpdateRequest {
  value?: string | null;
  description?: string | null;
  groupId?: number | null;
  sortOrder?: number | null;
}

/**
 * `UserSummaryResponse`. Never carries password material; areas are ids that
 * must be joined against `/api/v1/areas`.
 */
export interface UserSummary {
  id: number;
  document: string;
  name: string;
  email: string;
  phone: string;
  role: UserRoleValue;
  status: UserStatusValue;
  areaIds: number[];
}

/** `UserRoleUpdateRequest`. */
export interface UserRoleUpdateRequest {
  role: UserRoleValue;
}

/** `UserAreasUpdateRequest`; an empty set removes every area. */
export interface UserAreasUpdateRequest {
  areaIds: number[];
}

/** `UserStatusUpdateRequest`. */
export interface UserStatusUpdateRequest {
  status: 'ACTIVE' | 'INACTIVE';
}

export type WeekdayName =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

/** `OpeningHoursResponse.Day`: one weekday window. */
export interface OpeningHoursDay {
  dayOfWeek: WeekdayName;
  closed: boolean;
  /** `HH:mm` when open, `null` when closed. */
  openTime: string | null;
  /** `HH:mm` when open, `null` when closed. */
  closeTime: string | null;
}

/** `OpeningHoursResponse`. */
export interface OpeningHours {
  days: OpeningHoursDay[];
}

/** Weekday key of the active business day, Monday-first index. */
export const WEEKDAY_ORDER: readonly WeekdayName[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const WEEKDAY_LABELS: Readonly<Record<WeekdayName, string>> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};
