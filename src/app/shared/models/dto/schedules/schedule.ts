import { Shift } from './shift';

export interface Schedule {
  id: number;
  name: string;
  description?: string;
  shifts: Shift[];
}
