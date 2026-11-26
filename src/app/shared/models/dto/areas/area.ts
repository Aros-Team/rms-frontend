/**
 * Values accepted by the API's `AreaType` enum (`AreaController`).
 * Keep in sync with `core/area/domain/AreaType.java`.
 */
export type AreaTypeValue = 'KITCHEN' | 'SERVICE' | 'BAR' | 'GRILL' | 'CASH';

export interface AreaRequest {
  name: string;
  type: AreaTypeValue;
  /** An exclusive area cannot be combined with other areas. */
  exclusive: boolean;
}

export interface AreaResponse {
  id: number;
  name: string;
  type: AreaTypeValue;
  enabled: boolean;
  /** An exclusive area cannot be combined with other areas. */
  exclusive: boolean;
}
