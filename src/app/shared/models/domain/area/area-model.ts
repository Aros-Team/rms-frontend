import type { AreaActivityValue } from '@app/shared/models/dto/areas/area';

export interface Area {
  id: number;
  name: string;
  activities?: AreaActivityValue[];
  /** An exclusive area cannot be combined with other areas. */
  exclusive?: boolean;
}
