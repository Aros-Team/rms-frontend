import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { Area } from '@app/core/services/areas/area';
import { Logging } from '@app/core/services/logging/logging';
import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Schedule } from '@app/core/services/schedules/schedule';
import { Worker } from '@app/core/services/workers/worker';
import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule';
import type { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import {
  DAY_LABELS,
  LEGAL_WEEKLY_HOURS,
  MAX_WEEKLY_HOURS,
  buildWorkerWeek,
  detectAssignmentConflicts,
  findWeekOverlaps,
  formatMinutes,
  isSameLocalDay,
  scheduleMinutes,
  startOfWeek,
  weekDates,
  type AssignmentConflictReport,
  type PlannedShift,
  type WorkerWeek,
} from '@app/core/services/schedules/schedule-planning';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSelect } from '@app/shared/ui/select/select';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

interface WorkerRowView {
  readonly worker: WorkerResponse;
  readonly workerId: number;
  readonly areaLabels: readonly string[];
  readonly schedules: readonly ScheduleModel[];
  readonly week: WorkerWeek;
  readonly overlapKeys: ReadonlySet<string>;
  readonly overlapMessages: readonly string[];
  readonly overLegal: boolean;
  readonly overMax: boolean;
}

interface PendingRemoval {
  readonly worker: WorkerResponse;
  readonly schedule: ScheduleModel;
}

interface RemovalDrag {
  readonly worker: WorkerResponse;
  readonly schedule: ScheduleModel;
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });
const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat('es-CO', { day: 'numeric' });
const RANGE_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const ASSIGNMENT_ERRORS = new Map<string, string>([
  ['Shift overlap detected', 'El turno se solapa con un horario ya asignado al trabajador.'],
]);

/**
 * Admin weekly schedule grid.
 *
 * Feature: workers as rows, Monday→Sunday as columns, the shifts of every
 * assigned template as blocks, week navigation, filters and assignment
 * add/remove with drag-and-drop **and** a keyboard dialog.
 *
 * Contract:
 *  - the API assigns a whole schedule to a worker; dropping a template on a
 *    row therefore assigns every day of that template, and the drop target is
 *    the worker (not a single day);
 *  - four rules run before the request: missing area, double booking, overlap
 *    and the hard weekly cap. Legal weekly hours and long days are warnings.
 *    A blocked request never touches the network;
 *  - assignment is optimistic and rolls back the exact id on error;
 *  - every outcome leaves persistent inline feedback (`role="status"` or
 *    `role="alert"`), and no control is a dead end.
 */
@Component({
  selector: 'app-week-grid',
  imports: [
    FormsModule,
    RmsBadge,
    RmsButton,
    RmsDialog,
    RmsEmptyState,
    RmsIconButton,
    RmsInput,
    RmsSelect,
    RmsSkeleton,
  ],
  templateUrl: './week-grid.html',
  styleUrl: './week-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekGrid implements OnInit, OnChanges {
  private scheduleService = inject(Schedule);
  private assignmentService = inject(ScheduleAssignment);
  private workerService = inject(Worker);
  private areaService = inject(Area);
  private logger = inject(Logging);

  /** Bumped by the parent after a template is created or deleted. */
  @Input() refreshToken = 0;
  @Output() readonly createSchedule = new EventEmitter<void>();
  @Output() readonly openTimeLogs = new EventEmitter<void>();

  readonly schedules = signal<readonly ScheduleModel[]>([]);
  readonly workers = signal<readonly WorkerResponse[]>([]);
  readonly areas = signal<readonly AreaResponse[]>([]);
  readonly assignments = signal<ReadonlyMap<number, readonly number[]>>(new Map());
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly forbidden = signal(false);

  readonly notice = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly weekAnchor = signal(new Date());
  readonly areaFilter = signal('ALL');
  readonly search = signal('');

  readonly draggedScheduleId = signal<number | null>(null);
  readonly draggedRemoval = signal<RemovalDrag | null>(null);
  readonly dragOverWorkerId = signal<number | null>(null);

  readonly assignmentDialogWorker = signal<WorkerResponse | null>(null);
  readonly paletteSchedule = signal<ScheduleModel | null>(null);
  readonly pendingRemoval = signal<PendingRemoval | null>(null);

  readonly savingWorkerId = signal<number | null>(null);
  readonly savingScheduleId = signal<number | null>(null);

  readonly legalWeeklyHours = LEGAL_WEEKLY_HOURS;
  readonly maxWeeklyHours = MAX_WEEKLY_HOURS;
  readonly formatMinutes = formatMinutes;

  readonly weekStart = computed(() => startOfWeek(this.weekAnchor()));
  readonly dates = computed(() => weekDates(this.weekAnchor()));
  readonly isCurrentWeek = computed(() =>
    isSameLocalDay(this.weekStart(), startOfWeek(new Date())),
  );
  readonly weekRangeLabel = computed(() => {
    const dates = this.dates();
    return `${RANGE_FORMATTER.format(dates[0])} – ${RANGE_FORMATTER.format(dates[6])}`;
  });

  readonly areaOptions = computed(() => [
    { label: 'Todas las áreas', value: 'ALL' },
    ...this.areas().map((area) => ({ label: area.name, value: String(area.id) })),
  ]);

  readonly rows = computed<readonly WorkerRowView[]>(() => {
    const schedulesById = new Map(this.schedules().map((schedule) => [schedule.id, schedule]));
    const areasById = new Map(this.areas().map((area) => [area.id, area]));

    return this.workers().flatMap((worker) => {
      if (worker.id === undefined) {
        return [];
      }
      const scheduleIds = this.assignments().get(worker.id) ?? [];
      const assigned = scheduleIds.flatMap((id) => {
        const schedule = schedulesById.get(id);
        return schedule === undefined ? [] : [schedule];
      });
      const week = buildWorkerWeek(assigned);
      const overlaps = findWeekOverlaps(week);
      return [
        {
          worker,
          workerId: worker.id,
          areaLabels: (worker.assignedAreas ?? []).flatMap((id) => {
            const area = areasById.get(id);
            return area === undefined ? [] : [area.name];
          }),
          schedules: assigned,
          week,
          overlapKeys: overlaps.keys,
          overlapMessages: overlaps.messages,
          overLegal: week.weeklyMinutes > LEGAL_WEEKLY_HOURS * 60,
          overMax: week.weeklyMinutes > MAX_WEEKLY_HOURS * 60,
        },
      ];
    });
  });

  readonly filteredRows = computed<readonly WorkerRowView[]>(() => {
    const area = this.areaFilter();
    const term = this.search().trim().toLowerCase();
    return this.rows().filter((row) => {
      const matchesArea =
        area === 'ALL' || (row.worker.assignedAreas ?? []).some((id) => String(id) === area);
      if (!matchesArea) {
        return false;
      }
      if (term.length === 0) {
        return true;
      }
      return [row.worker.name, row.worker.email, row.worker.document].some((value) =>
        value.toLowerCase().includes(term),
      );
    });
  });

  readonly conflictMessages = computed<readonly string[]>(() => {
    const messages: string[] = [];
    for (const row of this.rows()) {
      messages.push(...row.overlapMessages);
      if (row.overMax) {
        messages.push(
          `${row.worker.name} tiene ${formatMinutes(row.week.weeklyMinutes)} semanales, sobre el máximo de ${String(MAX_WEEKLY_HOURS)} h.`,
        );
      }
    }
    return Array.from(new Set(messages));
  });

  readonly totalWeeklyMinutes = computed(() =>
    this.filteredRows().reduce((total, row) => total + row.week.weeklyMinutes, 0),
  );

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (Object.hasOwn(changes, 'refreshToken') && !changes['refreshToken'].firstChange) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.forbidden.set(false);

    forkJoin({
      schedules: this.scheduleService.getAll(),
      workers: this.workerService.getWorkers(),
      areas: this.areaService.getAreas(),
    })
      .pipe(
        switchMap((data) =>
          this.loadAssignments(data.workers).pipe(map((assignments) => ({ ...data, assignments }))),
        ),
      )
      .subscribe({
        next: (data) => {
          this.schedules.set(data.schedules);
          this.workers.set(data.workers);
          this.areas.set(data.areas);
          this.assignments.set(data.assignments);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Failed to load the schedule week', err);
          this.forbidden.set(err.status === 403);
          this.loadError.set(this.translateError(err, 'No se pudo cargar la semana.'));
          this.loading.set(false);
        },
      });
  }

  private loadAssignments(
    workers: readonly WorkerResponse[],
  ): Observable<ReadonlyMap<number, readonly number[]>> {
    const calls: Observable<readonly [number, readonly number[]]>[] = workers.flatMap((worker) => {
      if (worker.id === undefined) {
        return [];
      }
      const workerId = worker.id;
      return [
        this.assignmentService.getAssignments(workerId).pipe(
          catchError(() => of<readonly number[]>([])),
          map((ids) => [workerId, ids] as const),
        ),
      ];
    });

    if (calls.length === 0) {
      return of(new Map<number, readonly number[]>());
    }
    return forkJoin(calls).pipe(map((entries) => new Map(entries)));
  }

  // ---- Week navigation ---------------------------------------------------

  previousWeek(): void {
    this.shiftWeek(-7);
  }

  nextWeek(): void {
    this.shiftWeek(7);
  }

  goToToday(): void {
    this.weekAnchor.set(new Date());
  }

  private shiftWeek(days: number): void {
    const anchor = this.weekAnchor();
    const next = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + days);
    this.weekAnchor.set(next);
  }

  weekday(date: Date): string {
    return WEEKDAY_FORMATTER.format(date).replace('.', '');
  }

  dayNumber(date: Date): string {
    return DAY_NUMBER_FORMATTER.format(date);
  }

  isToday(date: Date): boolean {
    return isSameLocalDay(date, new Date());
  }

  dayLabel(day: PlannedShift['dayOfWeek']): string {
    return DAY_LABELS[day];
  }

  scheduleHours(schedule: ScheduleModel): string {
    return formatMinutes(scheduleMinutes(schedule));
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.search.set(target.value);
  }

  clearFilters(): void {
    this.areaFilter.set('ALL');
    this.search.set('');
  }

  // ---- Assignment --------------------------------------------------------

  assignedSchedules(worker: WorkerResponse): readonly ScheduleModel[] {
    if (worker.id === undefined) {
      return [];
    }
    const ids = this.assignments().get(worker.id) ?? [];
    const schedulesById = new Map(this.schedules().map((schedule) => [schedule.id, schedule]));
    return ids.flatMap((id) => {
      const schedule = schedulesById.get(id);
      return schedule === undefined ? [] : [schedule];
    });
  }

  isAssigned(worker: WorkerResponse, schedule: ScheduleModel): boolean {
    return this.assignedSchedules(worker).some((assigned) => assigned.id === schedule.id);
  }

  conflictFor(worker: WorkerResponse, schedule: ScheduleModel): AssignmentConflictReport {
    return detectAssignmentConflicts({
      workerName: worker.name,
      workerAreaIds: worker.assignedAreas,
      assignedSchedules: this.assignedSchedules(worker),
      candidate: schedule,
    });
  }

  blockingReason(worker: WorkerResponse, schedule: ScheduleModel): string {
    return this.conflictFor(worker, schedule).blocking[0] ?? '';
  }

  canAssign(worker: WorkerResponse, schedule: ScheduleModel): boolean {
    return !this.isAssigned(worker, schedule) && this.blockingReason(worker, schedule).length === 0;
  }

  openWorkerDialog(worker: WorkerResponse): void {
    this.actionError.set(null);
    this.assignmentDialogWorker.set(worker);
  }

  closeWorkerDialog(): void {
    if (this.savingWorkerId() !== null) {
      return;
    }
    this.assignmentDialogWorker.set(null);
  }

  openPaletteDialog(schedule: ScheduleModel): void {
    this.actionError.set(null);
    this.paletteSchedule.set(schedule);
  }

  closePaletteDialog(): void {
    if (this.savingWorkerId() !== null) {
      return;
    }
    this.paletteSchedule.set(null);
  }

  assignFromWorkerDialog(worker: WorkerResponse, schedule: ScheduleModel): void {
    if (this.attemptAssign(worker, schedule)) {
      this.assignmentDialogWorker.set(null);
    }
  }

  assignFromPaletteDialog(worker: WorkerResponse, schedule: ScheduleModel): void {
    if (this.attemptAssign(worker, schedule)) {
      this.paletteSchedule.set(null);
    }
  }

  /** Runs the four rules, then applies the assignment optimistically. */
  attemptAssign(worker: WorkerResponse, schedule: ScheduleModel): boolean {
    const workerId = worker.id;
    if (workerId === undefined) {
      return false;
    }
    if (this.savingWorkerId() !== null) {
      this.actionError.set('Espera a que termine la operación anterior.');
      return false;
    }
    const report = this.conflictFor(worker, schedule);
    if (report.blocking.length > 0) {
      this.notice.set(null);
      this.actionError.set(report.blocking.join(' '));
      return false;
    }
    if (this.isAssigned(worker, schedule)) {
      this.notice.set(`«${schedule.name}» ya está asignado a ${worker.name}.`);
      return false;
    }

    const previous = this.assignments().get(workerId) ?? [];
    this.setWorkerAssignments(workerId, [...previous, schedule.id]);
    this.savingWorkerId.set(workerId);
    this.savingScheduleId.set(schedule.id);
    this.actionError.set(null);

    this.assignmentService.assign(workerId, schedule.id).subscribe({
      next: () => {
        this.savingWorkerId.set(null);
        this.savingScheduleId.set(null);
        const warning =
          report.warnings.length > 0 ? ` ${report.warnings.join(' ')}` : '';
        this.notice.set(`«${schedule.name}» asignado a ${worker.name}.${warning}`);
      },
      error: (err: HttpErrorResponse) => {
        this.savingWorkerId.set(null);
        this.savingScheduleId.set(null);
        const current = this.assignments().get(workerId) ?? [];
        this.setWorkerAssignments(
          workerId,
          current.filter((id) => id !== schedule.id),
        );
        this.actionError.set(
          this.translateError(
            err,
            `No se pudo asignar «${schedule.name}» a ${worker.name}. La semana volvió al estado anterior.`,
          ),
        );
      },
    });
    return true;
  }

  removeShift(worker: WorkerResponse, shift: PlannedShift): void {
    const schedule = this.schedules().find((candidate) => candidate.id === shift.scheduleId);
    if (schedule === undefined) {
      return;
    }
    this.requestRemoval(worker, schedule);
  }

  requestRemoval(worker: WorkerResponse, schedule: ScheduleModel): void {
    this.actionError.set(null);
    this.assignmentDialogWorker.set(null);
    this.paletteSchedule.set(null);
    this.pendingRemoval.set({ worker, schedule });
  }

  cancelRemoval(): void {
    if (this.savingWorkerId() !== null) {
      return;
    }
    this.pendingRemoval.set(null);
  }

  confirmRemoval(): void {
    const pending = this.pendingRemoval();
    if (pending?.worker.id === undefined) {
      return;
    }
    const workerId = pending.worker.id;
    if (this.savingWorkerId() !== null) {
      return;
    }

    const previous = this.assignments().get(workerId) ?? [];
    this.setWorkerAssignments(
      workerId,
      previous.filter((id) => id !== pending.schedule.id),
    );
    this.savingWorkerId.set(workerId);
    this.savingScheduleId.set(pending.schedule.id);
    this.pendingRemoval.set(null);
    this.actionError.set(null);

    this.assignmentService.removeAssignment(workerId, pending.schedule.id).subscribe({
      next: () => {
        this.savingWorkerId.set(null);
        this.savingScheduleId.set(null);
        this.notice.set(`«${pending.schedule.name}» quitado de ${pending.worker.name}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.savingWorkerId.set(null);
        this.savingScheduleId.set(null);
        const current = this.assignments().get(workerId) ?? [];
        if (!current.includes(pending.schedule.id)) {
          this.setWorkerAssignments(workerId, [...current, pending.schedule.id]);
        }
        this.actionError.set(
          this.translateError(
            err,
            `No se pudo quitar «${pending.schedule.name}». La semana volvió al estado anterior.`,
          ),
        );
      },
    });
  }

  removalShiftCount(schedule: ScheduleModel | null | undefined): number {
    return schedule?.shifts.length ?? 0;
  }

  removalHours(schedule: ScheduleModel | null | undefined): string {
    return schedule === null || schedule === undefined ? '0 h' : formatMinutes(scheduleMinutes(schedule));
  }

  dismissNotice(): void {
    this.notice.set(null);
  }

  dismissError(): void {
    this.actionError.set(null);
  }

  // ---- Drag and drop -----------------------------------------------------

  onDragStart(event: DragEvent, schedule: ScheduleModel): void {
    this.draggedScheduleId.set(schedule.id);
    this.draggedRemoval.set(null);
    this.actionError.set(null);
    if (event.dataTransfer !== null) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', String(schedule.id));
    }
  }

  onDragEnd(): void {
    this.draggedScheduleId.set(null);
    this.draggedRemoval.set(null);
    this.dragOverWorkerId.set(null);
  }

  onShiftDragStart(event: DragEvent, worker: WorkerResponse, shift: PlannedShift): void {
    const schedule = this.schedules().find((candidate) => candidate.id === shift.scheduleId);
    if (schedule === undefined) {
      return;
    }
    this.draggedRemoval.set({ worker, schedule });
    this.draggedScheduleId.set(null);
    this.actionError.set(null);
    if (event.dataTransfer !== null) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', `remove:${String(schedule.id)}`);
    }
  }

  onShiftDragEnd(): void {
    this.draggedRemoval.set(null);
    this.dragOverWorkerId.set(null);
  }

  onRemovalDragOver(event: DragEvent): void {
    if (this.draggedRemoval() === null) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  dropRemoval(event: DragEvent): void {
    event.preventDefault();
    const pending = this.draggedRemoval();
    this.draggedRemoval.set(null);
    if (pending !== null) {
      this.requestRemoval(pending.worker, pending.schedule);
    }
  }

  onDragOver(event: DragEvent, worker: WorkerResponse): void {
    if (this.draggedScheduleId() === null || worker.id === undefined) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragOverWorkerId.set(worker.id);
  }

  onDragLeave(event: DragEvent, worker: WorkerResponse): void {
    const current = event.currentTarget;
    const related = event.relatedTarget;
    if (current instanceof Node && related instanceof Node && current.contains(related)) {
      return;
    }
    if (worker.id !== undefined && this.dragOverWorkerId() === worker.id) {
      this.dragOverWorkerId.set(null);
    }
  }

  onDrop(event: DragEvent, worker: WorkerResponse): void {
    event.preventDefault();
    if (this.draggedRemoval() !== null) {
      this.draggedRemoval.set(null);
      this.dragOverWorkerId.set(null);
      return;
    }
    const raw = event.dataTransfer?.getData('text/plain') ?? '';
    const scheduleId = Number(raw);
    this.draggedScheduleId.set(null);
    this.dragOverWorkerId.set(null);
    if (!Number.isFinite(scheduleId)) {
      return;
    }
    const schedule = this.schedules().find((candidate) => candidate.id === scheduleId);
    if (schedule === undefined) {
      return;
    }
    this.attemptAssign(worker, schedule);
  }

  private setWorkerAssignments(workerId: number, ids: readonly number[]): void {
    const next = new Map(this.assignments());
    next.set(workerId, ids);
    this.assignments.set(next);
  }

  private translateError(err: HttpErrorResponse, fallback: string): string {
    if (err.status === 403) {
      return 'No tienes permiso para administrar horarios.';
    }
    const detail = extractProblemDetail(err);
    if (detail !== null) {
      return ASSIGNMENT_ERRORS.get(detail) ?? detail;
    }
    if (err.status === 0) {
      return 'No se pudo contactar al servidor. Revisa la conexión e inténtalo de nuevo.';
    }
    return fallback;
  }
}
