import { Shift } from './shift.model';

export interface Schedule {
  id: number;
  name: string;
  description?: string;
  shifts: Shift[];
}
