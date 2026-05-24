import { Shift } from './shift.model';

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  shifts: Omit<Shift, 'id'>[];
}
