import type { AreaActivityValue } from '@app/shared/models/dto/areas/area';

export interface AreaRequest {
  name: string;
  activities: AreaActivityValue[];
  exclusive: boolean;
}
