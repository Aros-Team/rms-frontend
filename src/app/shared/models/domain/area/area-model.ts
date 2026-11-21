import type { AreaTypeValue } from '@app/shared/models/dto/areas/area';

export interface Area {
    id: number,
    name: string,
    type?: AreaTypeValue,
}
