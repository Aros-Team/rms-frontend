import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { Logging } from '@app/core/services/logging/logging';
import { TimeLog } from '@app/core/services/schedules/time-log';
import { Worker } from '@app/core/services/workers/worker';
import type { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry';
import type { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import {
  DAY_LABELS,
  dayOfWeekOfDate,
  endOfLocalDayIso,
  formatMinutes,
  localIsoDate,
  startOfLocalDayIso,
  summarizeTimeLogs,
  type TimeLogDaySummary,
  type TimeLogSession,
} from '@app/core/services/schedules/schedule-planning';
import { formatIsoDate } from '@app/shared/lib/date-format/date-format';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsCheckbox } from '@app/shared/ui/checkbox/checkbox';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsField } from '@app/shared/ui/field/field';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsSelect } from '@app/shared/ui/select/select';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

const PAGE_SIZE = 20;
const TIME_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Admin time-log panel.
 *
 * Feature: filter the existing `GET /v1/admin/time-logs` by worker, date range
 * and within-shift, then group the events into worker/day sessions with hours
 * and exceptions.
 *
 * Contract:
 *  - the endpoint takes ISO-8601 **instants**, not `LocalDate`; the panel
 *    converts the local date inputs to local-day boundaries;
 *  - `withinShift=true` is forwarded when the toggle is on; leaving it off
 *    keeps the full range (`withinShift=false` means "outside a shift", not
 *    "all", so it is not sent by this panel);
 *  - hours come only from a closed IN/OUT pair. An open session is an
 *    exception, not an assumed 8 h day;
 *  - this is the admin clock *read*; workers write their own marks from
 *    "Mi horario".
 */
@Component({
  selector: 'app-time-logs-panel',
  imports: [
    FormsModule,
    RmsBadge,
    RmsButton,
    RmsCheckbox,
    RmsEmptyState,
    RmsField,
    RmsIconButton,
    RmsSelect,
    RmsSkeleton,
  ],
  templateUrl: './time-logs-panel.html',
  styleUrl: './time-logs-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeLogsPanel implements OnInit {
  private timeLogService = inject(TimeLog);
  private workerService = inject(Worker);
  private logger = inject(Logging);

  readonly workers = signal<readonly WorkerResponse[]>([]);
  readonly logs = signal<readonly TimeLogEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly forbidden = signal(false);

  readonly workerFilter = signal('ALL');
  readonly withinShift = signal(false);
  readonly fromDate = signal(localIsoDate(new Date()));
  readonly toDate = signal(localIsoDate(new Date()));
  readonly page = signal(0);

  readonly formatMinutes = formatMinutes;

  readonly workerOptions = computed(() => [
    { label: 'Todos los trabajadores', value: 'ALL' },
    ...this.workers().flatMap((worker) =>
      worker.id === undefined ? [] : [{ label: worker.name, value: String(worker.id) }],
    ),
  ]);

  readonly workerNames = computed(() => {
    const names = new Map<number, string>();
    for (const worker of this.workers()) {
      if (worker.id !== undefined) {
        names.set(worker.id, worker.name);
      }
    }
    return names;
  });

  readonly summaries = computed(() => summarizeTimeLogs(this.logs()));
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.summaries().length / PAGE_SIZE)),
  );
  readonly pagedSummaries = computed(() => {
    const start = this.page() * PAGE_SIZE;
    return this.summaries().slice(start, start + PAGE_SIZE);
  });
  readonly totalMinutes = computed(() =>
    this.summaries().reduce((total, summary) => total + summary.minutes, 0),
  );
  readonly sessionCount = computed(() =>
    this.summaries().reduce((total, summary) => total + summary.sessions.length, 0),
  );
  readonly openSessions = computed(() =>
    this.summaries().reduce((total, summary) => total + summary.openSessions, 0),
  );
  readonly exceptionCount = computed(() =>
    this.summaries().reduce((total, summary) => total + summary.exceptions.length, 0),
  );

  ngOnInit(): void {
    this.workerService.getWorkers().subscribe({
      next: (workers) => {
        this.workers.set(workers);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load workers for the time-log filters', err);
      },
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.forbidden.set(false);

    const from = this.parseDate(this.fromDate());
    const to = this.parseDate(this.toDate());
    if (from === null || to === null) {
      this.loading.set(false);
      this.error.set('Escoge una fecha inicial y una fecha final válidas.');
      return;
    }
    if (this.fromDate() > this.toDate()) {
      this.loading.set(false);
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }

    const workerId = this.workerFilter() === 'ALL' ? undefined : Number(this.workerFilter());
    this.timeLogService
      .getTimeLogs({
        ...(workerId !== undefined ? { workerId } : {}),
        from: startOfLocalDayIso(from),
        to: endOfLocalDayIso(to),
        ...(this.withinShift() ? { withinShift: true } : {}),
      })
      .subscribe({
        next: (logs) => {
          this.logs.set(logs);
          this.page.set(0);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Failed to load time logs', err);
          this.forbidden.set(err.status === 403);
          this.error.set(this.translateError(err));
          this.loading.set(false);
        },
      });
  }

  applyFilters(): void {
    this.page.set(0);
    this.load();
  }

  onFromChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.fromDate.set(target.value);
  }

  onToChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.toDate.set(target.value);
  }

  clearFilters(): void {
    this.workerFilter.set('ALL');
    this.withinShift.set(false);
    const today = localIsoDate(new Date());
    this.fromDate.set(today);
    this.toDate.set(today);
    this.page.set(0);
    this.load();
  }

  previousPage(): void {
    this.page.update((page) => Math.max(0, page - 1));
  }

  nextPage(): void {
    this.page.update((page) => Math.min(this.totalPages() - 1, page + 1));
  }

  workerLabel(workerId: number): string {
    return this.workerNames().get(workerId) ?? `Trabajador #${String(workerId)}`;
  }

  dayLabel(summary: TimeLogDaySummary): string {
    return DAY_LABELS[dayOfWeekOfDate(summary.date)];
  }

  dateLabel(summary: TimeLogDaySummary): string {
    return formatIsoDate(summary.dateIso);
  }

  clockTime(session: TimeLogSession, edge: 'in' | 'out'): string {
    const value = edge === 'in' ? session.clockIn : session.clockOut;
    return value === null ? '—' : TIME_FORMATTER.format(value);
  }

  firstClockIn(summary: TimeLogDaySummary): string {
    const first = summary.sessions.at(0);
    return first === undefined ? '—' : this.clockTime(first, 'in');
  }

  lastClockOut(summary: TimeLogDaySummary): string {
    for (let index = summary.sessions.length - 1; index >= 0; index -= 1) {
      const session = summary.sessions.at(index);
      if (session === undefined) {
        continue;
      }
      if (session.clockOut !== null) {
        return this.clockTime(session, 'out');
      }
    }
    return 'Sin salida';
  }

  hasExceptions(summary: TimeLogDaySummary): boolean {
    return summary.exceptions.length > 0;
  }

  /** `HH:mm` deltas of split sessions, e.g. "11:00–15:00 · 18:00–23:00". */
  sessionDetail(summary: TimeLogDaySummary): string {
    return summary.sessions
      .map((session) =>
        session.clockOut === null
          ? `${this.clockTime(session, 'in')} (abierta)`
          : `${this.clockTime(session, 'in')}–${this.clockTime(session, 'out')}`,
      )
      .join(' · ');
  }

  private parseDate(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match === null) {
      return null;
    }
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private translateError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Solo administración puede consultar los registros de asistencia.';
    }
    const detail = extractProblemDetail(err);
    if (detail !== null) {
      return detail;
    }
    if (err.status === 0) {
      return 'No se pudo contactar al servidor. Revisa la conexión e inténtalo de nuevo.';
    }
    if (err.status >= 500) {
      return 'La API no pudo leer los registros del rango. Revisa la conexión e inténtalo de nuevo; si persiste, consulta el registro del servidor.';
    }
    return 'No se pudieron cargar los registros de asistencia.';
  }
}
