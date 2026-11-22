import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';

import { Area } from '@app/core/services/areas/area';
import { Logging } from '@app/core/services/logging/logging';
import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Schedule } from '@app/core/services/schedules/schedule';
import { Worker } from '@app/core/services/workers/worker';
import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type { CreateScheduleRequest } from '@app/shared/models/dto/schedules/create-schedule-request';
import type { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule';
import type { DayOfWeek } from '@app/shared/models/dto/schedules/shift';
import type { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import {
  DAY_LABELS,
  DAY_ORDER,
  DAY_SHORT_LABELS,
  formatMinutes,
  scheduleMinutes,
  timeToMinutes,
} from '@app/core/services/schedules/schedule-planning';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';

import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsField } from '@app/shared/ui/field/field';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSelect } from '@app/shared/ui/select/select';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

/** One assigned shift group: worker + days + time range. */
interface IndividualShift {
  readonly scheduleId: number;
  readonly schedule: ScheduleModel;
  readonly workerId: number;
  readonly workerName: string;
  readonly areaNames: readonly string[];
  readonly days: readonly DayOfWeek[];
  /** Distinct time ranges (seed shifts can contain two per day). */
  readonly ranges: readonly string[];
  readonly startTime: string;
  readonly endTime: string;
  readonly minutes: number;
}

const ERROR_TRANSLATIONS = new Map<string, string>([
  ['Shift overlap detected', 'Ese trabajador ya tiene un turno que se solapa.'],
  ['Schedule name already exists', 'Ya existe un turno con ese nombre. Intenta de nuevo.'],
  ['Cannot delete schedule with active assignments', 'El turno todavía está asignado.'],
]);

/**
 * `Turnos`: individual per-worker shifts.
 *
 * The API models a schedule as a named group of weekly shifts and assigns the
 * whole group to a worker. This screen hides that plumbing: the admin picks a
 * worker, the days and the hours, and the planner creates the group and the
 * assignment in one step. Editing recreates the pair (the API has no partial
 * assignment update); deleting removes the assignment before the group.
 *
 * The weekly grid remains the read-only distribution view.
 */
@Component({
  selector: 'app-shift-planner',
  templateUrl: './shift-planner.html',
  styleUrl: './shift-planner.css',
  imports: [
    FormsModule,
    RmsButton,
    RmsDialog,
    RmsEmptyState,
    RmsField,
    RmsIconButton,
    RmsInput,
    RmsSelect,
    RmsSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShiftPlanner implements OnInit {
  private scheduleService = inject(Schedule);
  private assignmentService = inject(ScheduleAssignment);
  private workerService = inject(Worker);
  private areaService = inject(Area);
  private logger = inject(Logging);

  @Output() readonly changed = new EventEmitter<void>();

  readonly rows = signal<readonly IndividualShift[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly forbidden = signal(false);
  readonly notice = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly search = signal('');

  readonly dialogVisible = signal(false);
  readonly editing = signal<IndividualShift | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly pendingDelete = signal<IndividualShift | null>(null);
  readonly editingMultiRange = computed(() => (this.editing()?.ranges.length ?? 0) > 1);
  readonly deleting = signal(false);

  readonly workerId = signal<number | null>(null);
  readonly selectedDays = signal<readonly DayOfWeek[]>([]);
  readonly startTime = signal('08:00');
  readonly endTime = signal('16:00');

  readonly dayOrder = DAY_ORDER;
  readonly dayLabels = DAY_LABELS;
  readonly dayShortLabels = DAY_SHORT_LABELS;
  readonly formatMinutes = formatMinutes;

  private schedules: readonly ScheduleModel[] = [];
  private readonly workers = signal<readonly WorkerResponse[]>([]);
  private areas: readonly AreaResponse[] = [];
  private assignments: ReadonlyMap<number, readonly number[]> = new Map();

  readonly workerOptions = computed(() =>
    this.workers()
      .flatMap((worker) =>
        worker.id === undefined
          ? []
          : [{ label: `${worker.name} · ${worker.document}`, value: worker.id }],
      )
      .sort((left, right) => left.label.localeCompare(right.label, 'es')),
  );

  readonly filteredRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (term.length === 0) return this.rows();
    return this.rows().filter((row) => row.workerName.toLowerCase().includes(term));
  });

  readonly totalWeeklyMinutes = computed(() =>
    this.filteredRows().reduce((total, row) => total + row.minutes, 0),
  );

  ngOnInit(): void {
    this.load();
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
          this.schedules = data.schedules;
          this.workers.set(data.workers);
          this.areas = data.areas;
          this.assignments = data.assignments;
          this.rows.set(this.buildRows());
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Failed to load the individual shifts', err);
          this.forbidden.set(err.status === 403);
          this.loadError.set(this.translateError(err, 'No se pudieron cargar los turnos.'));
          this.loading.set(false);
        },
      });
  }

  openCreate(): void {
    this.editing.set(null);
    this.workerId.set(null);
    this.selectedDays.set([]);
    this.startTime.set('08:00');
    this.endTime.set('16:00');
    this.formError.set(null);
    this.dialogVisible.set(true);
  }

  openEdit(row: IndividualShift): void {
    this.editing.set(row);
    this.workerId.set(row.workerId);
    this.selectedDays.set([...row.days]);
    this.startTime.set(row.startTime);
    this.endTime.set(row.endTime);
    this.formError.set(null);
    this.dialogVisible.set(true);
  }

  toggleDay(day: DayOfWeek): void {
    this.selectedDays.update((days) =>
      days.includes(day) ? days.filter((candidate) => candidate !== day) : [...days, day],
    );
  }

  isDaySelected(day: DayOfWeek): boolean {
    return this.selectedDays().includes(day);
  }

  save(): void {
    this.formError.set(null);
    const workerId = this.workerId();
    const days = [...this.selectedDays()].sort(
      (left, right) => DAY_ORDER.indexOf(left) - DAY_ORDER.indexOf(right),
    );
    const start = this.startTime();
    const end = this.endTime();
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    if (workerId === null) {
      this.formError.set('Selecciona un trabajador.');
      return;
    }
    if (days.length === 0) {
      this.formError.set('Selecciona al menos un día.');
      return;
    }
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      this.formError.set('La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    const worker = this.workers().find((candidate) => candidate.id === workerId);
    if (worker === undefined) {
      this.formError.set('El trabajador ya no está disponible.');
      return;
    }

    const request: CreateScheduleRequest = {
      name: this.uniqueName(worker.name, start, end),
      description: 'Turno individual',
      shifts: days.map((dayOfWeek) => ({ dayOfWeek, startTime: start, endTime: end })),
    };

    this.saving.set(true);
    const editing = this.editing();

    const replace$ =
      editing === null
        ? this.createAndAssign(request, workerId)
        : this.assignmentService.removeAssignment(editing.workerId, editing.scheduleId).pipe(
            switchMap(() => this.scheduleService.delete(editing.scheduleId)),
            switchMap(() => this.createAndAssign(request, workerId)),
          );

    replace$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.notice.set(
          editing === null ? 'Turno creado y asignado.' : 'Turno actualizado.',
        );
        this.load();
        this.changed.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to save the individual shift', err);
        this.saving.set(false);
        this.formError.set(this.translateError(err, 'No se pudo guardar el turno.'));
      },
    });
  }

  requestDelete(row: IndividualShift): void {
    this.actionError.set(null);
    this.pendingDelete.set(row);
  }

  confirmDelete(): void {
    const row = this.pendingDelete();
    if (row === null) return;
    this.deleting.set(true);
    this.assignmentService
      .removeAssignment(row.workerId, row.scheduleId)
      .pipe(switchMap(() => this.scheduleService.delete(row.scheduleId)))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.notice.set('Turno eliminado.');
          this.load();
          this.changed.emit();
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Failed to delete the individual shift', err);
          this.deleting.set(false);
          this.pendingDelete.set(null);
          this.actionError.set(this.translateError(err, 'No se pudo eliminar el turno.'));
        },
      });
  }

  dismissNotice(): void {
    this.notice.set(null);
  }

  dismissError(): void {
    this.actionError.set(null);
  }

  private createAndAssign(
    request: CreateScheduleRequest,
    workerId: number,
  ): Observable<unknown> {
    return this.scheduleService.create(request).pipe(
      switchMap((schedule) =>
        this.assignmentService.assign(workerId, schedule.id).pipe(
          catchError((error: unknown) =>
            this.scheduleService.delete(schedule.id).pipe(
              switchMap(() => throwError(() => error)),
            ),
          ),
        ),
      ),
    );
  }

  private buildRows(): readonly IndividualShift[] {
    const schedulesById = new Map(this.schedules.map((schedule) => [schedule.id, schedule]));
    const areasById = new Map(this.areas.map((area) => [area.id, area]));

    return this.workers()
      .flatMap((worker) => {
        if (worker.id === undefined) return [];
        const workerId = worker.id;
        const areaNames = (worker.assignedAreas ?? []).flatMap((id) => {
          const area = areasById.get(id);
          return area === undefined ? [] : [area.name];
        });
        return (this.assignments.get(workerId) ?? []).flatMap((scheduleId) => {
          const schedule = schedulesById.get(scheduleId);
          if (schedule === undefined || schedule.shifts.length === 0) return [];
          const first = schedule.shifts[0];
          const ranges = Array.from(
            new Set(schedule.shifts.map((shift) => `${shift.startTime}–${shift.endTime}`)),
          );
          return [
            {
              scheduleId,
              schedule,
              workerId,
              workerName: worker.name,
              areaNames,
              days: DAY_ORDER.filter((day) =>
                schedule.shifts.some((shift) => shift.dayOfWeek === day),
              ),
              ranges,
              startTime: first.startTime,
              endTime: first.endTime,
              minutes: scheduleMinutes(schedule),
            },
          ];
        });
      })
      .sort(
        (left, right) =>
          left.workerName.localeCompare(right.workerName, 'es') ||
          left.startTime.localeCompare(right.startTime),
      );
  }

  private loadAssignments(
    workers: readonly WorkerResponse[],
  ): Observable<ReadonlyMap<number, readonly number[]>> {
    const calls: Observable<readonly [number, readonly number[]]>[] = workers.flatMap((worker) => {
      if (worker.id === undefined) return [];
      const workerId = worker.id;
      return [
        this.assignmentService.getAssignments(workerId).pipe(
          catchError(() => of<readonly number[]>([])),
          map((ids) => [workerId, ids] as const),
        ),
      ];
    });
    return forkJoin(calls).pipe(map((entries) => new Map(entries)));
  }

  private uniqueName(workerName: string, start: string, end: string): string {
    return `Turno ${workerName} ${start}-${end} ${String(Date.now())}`;
  }

  private translateError(error: HttpErrorResponse, fallback: string): string {
    const detail = extractProblemDetail(error);
    if (detail !== null) {
      for (const [needle, message] of ERROR_TRANSLATIONS) {
        if (detail.toLowerCase().includes(needle.toLowerCase())) return message;
      }
      return detail;
    }
    return fallback;
  }
}
