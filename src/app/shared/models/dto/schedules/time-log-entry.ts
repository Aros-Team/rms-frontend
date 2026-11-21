export interface TimeLogEntry {
  id: number;
  workerId: number;
  timestamp: string;
  type: 'IN';
  withinShift: boolean;
  relatedShiftId: number | null;
}
