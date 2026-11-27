/**
 * Activities that can be performed in a physical area.
 * Keep in sync with `core/area/domain/AreaActivity.java`.
 */
export type AreaActivityValue = 'PREPARATION' | 'SERVE' | 'CASH';

export interface AreaRequest {
  name: string;
  activities: AreaActivityValue[];
  /** An exclusive area cannot be combined with other areas. */
  exclusive: boolean;
}

export interface AreaResponse {
  id: number;
  name: string;
  activities: AreaActivityValue[];
  enabled: boolean;
  /** An exclusive area cannot be combined with other areas. */
  exclusive: boolean;
}

export type AreaTypeValue = AreaActivityValue;
