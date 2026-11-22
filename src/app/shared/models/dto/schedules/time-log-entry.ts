export interface TimeLogEntry {
  id: number;
  workerId: number;
  timestamp: string;
  /**
   * Target contract after P3-BE-RL-11: a session pairs an `IN` with an `OUT`.
   * The running build only writes `IN` (on login); seeded data already carries
   * `OUT` rows, which that build cannot decode yet.
   */
  type: 'IN' | 'OUT';
  withinShift: boolean;
  relatedShiftId: number | null;
}
