import type { AreaTypeValue } from '@app/shared/models/dto/areas/area';

export interface AreaSimpleResponse {
  id: number;
  name: string;
  type: AreaTypeValue;
  enabled: boolean;
  exclusive?: boolean;
}
