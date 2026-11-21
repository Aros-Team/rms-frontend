export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface Shift {
  id?: number;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}
