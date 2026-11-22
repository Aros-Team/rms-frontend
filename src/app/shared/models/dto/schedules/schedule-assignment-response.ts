/**
 * Result of assigning a schedule to a worker.
 *
 * The backend computes the resulting weekly hours and returns a non-blocking
 * `warning` when they exceed the 48 h legal reference. Above the 66 h hard cap
 * the request is rejected with 409, so this body is only returned for accepted
 * assignments. `warning` is `null` at or below 48 h.
 */
export interface ScheduleAssignmentResponse {
  workerId: number;
  scheduleId: number;
  weeklyHours: number;
  legalWeeklyHours: number;
  hardWeeklyCapHours: number;
  warning: string | null;
}
