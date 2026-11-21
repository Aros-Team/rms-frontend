import { Shift } from './shift';

export interface CreateScheduleRequest {
  name: string;
  description?: string;
  shifts: Omit<Shift, 'id'>[];
}
