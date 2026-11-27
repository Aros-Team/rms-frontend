import { Area } from '@models/domain/area/area-model';

export interface UserInfo {
  id: number;
  name: string;
  document: string;
  email: string;
  phone?: string;
  address?: string;
  role: 'ADMIN' | 'WORKER';
  areas: Area[];
  /** Explicit activities assigned per area (worker assignments). */
  areaActivities?: { areaId: number; activities: string[] }[];
}
