export interface WorkerScheduleResponse {
  days: WorkerScheduleDay[];
}

export interface WorkerScheduleDay {
  dayOfWeek: string;
  shifts: WorkerScheduleShift[];
}

export interface WorkerScheduleShift {
  scheduleName: string;
  startTime: string;
  endTime: string;
}
