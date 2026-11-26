import { ChangeDetectionStrategy, Component } from '@angular/core';

import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { TimeLogsPanel } from './time-logs-panel/time-logs-panel';

/**
 * Attendance route (`/admin/team/attendance`).
 *
 * Feature: promotes the clock read out of the schedules page into its own
 * destination, so attendance is a sibling of Horarios instead of a tab nested
 * inside it.
 *
 * Contract:
 *  - this page owns the route H1; the panel keeps its own section heading;
 *  - filtering, grouping and exception handling stay in `TimeLogsPanel`.
 */
@Component({
  selector: 'app-attendance-page',
  imports: [RmsPageHeader, TimeLogsPanel],
  templateUrl: './attendance-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendancePage {
  readonly title = 'Asistencia';
  readonly subtitle = 'Marcajes de entrada y salida por trabajador y día.';
}
