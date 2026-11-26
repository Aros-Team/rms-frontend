import type { AreaTypeValue } from '@app/shared/models/dto/areas/area';

export interface AreaRequest {
  name: string;
  type: AreaTypeValue;
  exclusive: boolean;
}
