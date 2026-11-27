import type { AreaActivityValue } from '@app/shared/models/dto/areas/area';

export interface AreaSimpleResponse {
  id: number;
  name: string;
  activities: AreaActivityValue[];
  enabled: boolean;
  exclusive?: boolean;
}
