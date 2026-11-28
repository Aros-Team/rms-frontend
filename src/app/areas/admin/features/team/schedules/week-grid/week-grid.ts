import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { SettingsApi } from '@app/core/services/settings/settings-api';
import { Worker } from '@app/core/services/workers/worker';
import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type { CreateScheduleRequest } from '@app/shared/models/dto/schedules/create-schedule-request';
import type { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule';
import type { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import type { OpeningHoursDay } from '@app/shared/models/dto/settings/settings';
import type { DayOfWeek } from '@app/shared/models/dto/schedules/shift';
import {
  DAY_LABELS,
  DAY_ORDER,
  LEGAL_WEEKLY_HOURS,
  MAX_WEEKLY_HOURS,
  buildCoverage,
  buildWorkerWeek,
  detectAssignmentConflicts,
  detectScheduleUpdateConflicts,
  findCoverageGaps,
  findWeekOverlaps,
  isHourOpen,
  formatMinutes,
  isSameLocalDay,
  scheduleMinutes,
  startOfWeek,
  timeToMinutes,
  weekDates,
  type AssignmentConflictReport,
  type OpeningDay,
  type PlannedShift,
  type ScheduleUpdateConflictReport,
  type WorkerScheduleContext,
  type WorkerWeek,
} from '@app/core/services/schedules/schedule-planning';
import {
  LATEST_SHIFT_MINUTE,
  MIN_SHIFT_MINUTES,
  deltaPxToMinutes,
  isRangeWithin,
  minutesToTime,
  moveShift,
  rangeToPercent,
  resizeEnd,
  resizeStart,
  type MinuteRange,
  type MinutesBounds,
} from '@app/core/services/schedules/shift-interaction';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';

import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsField } from '@app/shared/ui/field/field';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSelect } from '@app/shared/ui/select/select';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

interface WorkerRowView {
  readonly worker: WorkerResponse;
  readonly workerId: number;
  readonly areaLabels: readonly string[];
  readonly role: string;
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

interface TimelineBar {
  readonly key: string;
  readonly scheduleId: number;
  readonly scheduleName: string;
  readonly shiftId?: number;
  readonly dayOfWeek: DayOfWeek;
  readonly workerId: number;
  readonly workerName: string;
  readonly imageUrl?: string | null;
  readonly role: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly affectedWorkers: number;
  readonly left: number;
  readonly width: number;
  readonly top: number;
}

interface TimelineDay {
  readonly dayOfWeek: DayOfWeek;
  readonly label: string;
  readonly date: Date;
  readonly closed: boolean;
  readonly bars: readonly TimelineBar[];
  readonly trackHeight: number;
  readonly workerCount: number;
  readonly minutes: number;
}

interface RemovalDrag {
  readonly worker: WorkerResponse;
  readonly schedule: ScheduleModel;
}

type ShiftInteractionMode = 'move' | 'resize-start' | 'resize-end';

interface ShiftInteraction {
  readonly mode: ShiftInteractionMode;
  readonly bar: TimelineBar;
  readonly pointerId: number;
  readonly originClientX: number;
  readonly trackWidth: number;
  readonly windowStart: number;
  readonly windowMinutes: number;
  readonly bounds: MinutesBounds;
  readonly original: MinuteRange;
  readonly active: boolean;
  readonly preview: MinuteRange | null;
  readonly valid: boolean;
  readonly reason: string | null;
}

interface ShiftPreview {
  readonly key: string;
  readonly left: number;
  readonly width: number;
  readonly label: string;
  readonly valid: boolean;
  readonly reason: string | null;
}

/** Pointer movement before a press becomes a drag instead of a click. */
const DRAG_THRESHOLD_PX = 5;

/** How long a success toast stays visible. */
const NOTICE_TIMEOUT_MS = 4000;

/** Errors need a little longer, but still disappear on their own. */
const ERROR_TIMEOUT_MS = 8000;

const SHIFT_UPDATE_ERRORS: readonly (readonly [string, string])[] = [
  ['startTime debe ser anterior a endTime', 'La hora de fin debe ser posterior a la de inicio.'],
  [
    'Shift overlap detected',
    'El turno se solapa con otro horario asignado a un trabajador de esta plantilla.',
  ],
  [
    'los turnos no deben superponerse',
    'La plantilla dejaría dos turnos superpuestos. Ajusta la hora de inicio o de fin.',
  ],
  [
    'por encima del tope',
    'El cambio supera el máximo de 42 h semanales de algún trabajador asignado.',
  ],
  ['superpone con el turno existente', 'El turno se solapa con otro horario del mismo trabajador.'],
];

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

/** Fallback role derived from the area when the worker has no explicit job title. */
function deriveRole(areaLabels: readonly string[]): string {
  const areas = areaLabels.map((area) => area.toLowerCase());
  if (areas.some((area) => area.includes('cocina'))) {
    return 'Cocinero';
  }
  if (areas.some((area) => area.includes('caja'))) {
    return 'Cajero';
  }
  if (areas.some((area) => area.includes('servicio'))) {
    return 'Mesero';
  }
  return 'Sin rol';
}

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
    RmsButton,
    RmsDialog,
    RmsEmptyState,
    RmsField,
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
  private settingsApi = inject(SettingsApi);
  private areaService = inject(Area);
  private logger = inject(Logging);
  private destroyRef = inject(DestroyRef);

  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearNoticeTimer();
      this.clearErrorTimer();
    });
  }

  /** Bumped by the parent after a template is created or deleted. */
  @Input() refreshToken = 0;
  @Output() readonly createSchedule = new EventEmitter<void>();
  @Output() readonly openTimeLogs = new EventEmitter<void>();

  readonly schedules = signal<readonly ScheduleModel[]>([]);
  readonly openingHours = signal<readonly OpeningHoursDay[]>([]);
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

  /** Active drag/resize gesture. Null means no gesture is in progress. */
  readonly interaction = signal<ShiftInteraction | null>(null);
  /** Template being edited in the click dialog. */
  readonly editingShift = signal<TimelineBar | null>(null);
  readonly editingStartTime = signal('08:00');
  readonly editingEndTime = signal('16:00');
  readonly editingError = signal<string | null>(null);
  readonly savingTemplateId = signal<number | null>(null);

  private suppressClickKey: string | null = null;

  readonly legalWeeklyHours = LEGAL_WEEKLY_HOURS;
  readonly maxWeeklyHours = MAX_WEEKLY_HOURS;
  readonly formatMinutes = formatMinutes;

  readonly weekStart = computed(() => startOfWeek(this.weekAnchor()));
  readonly dates = computed(() => weekDates(this.weekAnchor()));

  /** Workers assigned to each template, shown when a shared shift is edited. */
  readonly affectedWorkersBySchedule = computed<ReadonlyMap<number, number>>(() => {
    const counts = new Map<number, number>();
    for (const ids of this.assignments().values()) {
      for (const id of new Set(ids)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  });

  /** Hour window of the calendar: the weekly opening hours, or the shifts as fallback. */
  readonly timelineRange = computed(() => {
    const openings = Object.values(this.openingsByDay()).filter((day) => !day.closed);
    if (openings.length > 0) {
      return {
        start: Math.min(...openings.map((day) => day.openHour)),
        end: Math.max(...openings.map((day) => day.closeHour)),
      };
    }
    let start = 23;
    let end = 0;
    for (const row of this.filteredRows()) {
      for (const day of row.week.days) {
        for (const shift of day.shifts) {
          const from = timeToMinutes(shift.startTime);
          const to = timeToMinutes(shift.endTime);
          if (from === null || to === null || to <= from) continue;
          start = Math.min(start, Math.floor(from / 60));
          end = Math.max(end, Math.ceil(to / 60));
        }
      }
    }
    return end > start ? { start, end } : { start: 8, end: 22 };
  });

  readonly timelineHours = computed(() => {
    const range = this.timelineRange();
    return Array.from({ length: range.end - range.start }, (_, index) => range.start + index);
  });

  /** Weekly calendar: one horizontal lane set per day, bars spanning their hours. */
  readonly timelineDays = computed<readonly TimelineDay[]>(() => {
    const range = this.timelineRange();
    const windowStart = range.start * 60;
    const windowMinutes = Math.max(1, (range.end - range.start) * 60);
    const dates = this.dates();

    return DAY_ORDER.map((dayOfWeek, index) => {
      const opening = this.openingsByDay()[dayOfWeek];
      const closed = opening?.closed === true;
      const shifts = (closed ? [] : this.filteredRows())
        .flatMap((row) => {
          const day = row.week.days.find((candidate) => candidate.dayOfWeek === dayOfWeek);
          return (day?.shifts ?? []).map((shift) => ({ row, shift }));
        })
        .filter(({ shift }) => shift.minutes > 0)
        .sort(
          (left, right) =>
            (timeToMinutes(left.shift.startTime) ?? 0) -
            (timeToMinutes(right.shift.startTime) ?? 0),
        );

      const laneEnds: number[] = [];
      const bars: TimelineBar[] = [];
      for (const { row, shift } of shifts) {
        const from = timeToMinutes(shift.startTime);
        const to = timeToMinutes(shift.endTime);
        if (from === null || to === null || to <= from) continue;
        const visibleFrom = Math.max(from, windowStart);
        const visibleTo = Math.min(to, windowStart + windowMinutes);
        if (visibleTo <= visibleFrom) continue;

        let lane = laneEnds.findIndex((end) => end <= from);
        if (lane < 0) {
          lane = laneEnds.length;
          laneEnds.push(to);
        } else {
          laneEnds[lane] = to;
        }

        const role = row.role;

        bars.push({
          key: `${String(row.workerId)}-${shift.key}`,
          scheduleId: shift.scheduleId,
          scheduleName: shift.scheduleName,
          ...(shift.shiftId !== undefined ? { shiftId: shift.shiftId } : {}),
          dayOfWeek: shift.dayOfWeek,
          workerId: row.workerId,
          workerName: row.worker.name,
          imageUrl: row.worker.imageUrl,
          role,
          startTime: shift.startTime,
          endTime: shift.endTime,
          startMinutes: from,
          endMinutes: to,
          affectedWorkers: this.affectedWorkersBySchedule().get(shift.scheduleId) ?? 1,
          left: ((visibleFrom - windowStart) / windowMinutes) * 100,
          width: ((visibleTo - visibleFrom) / windowMinutes) * 100,
          top: lane * 36 + 6,
        });
      }

      const minutes = shifts.reduce((total, entry) => total + entry.shift.minutes, 0);
      return {
        dayOfWeek,
        label: DAY_LABELS[dayOfWeek],
        date: dates[index],
        closed,
        bars: closed ? [] : bars,
        trackHeight: Math.max(1, laneEnds.length) * 36 + 12,
        workerCount: new Set(shifts.map((entry) => entry.row.workerId)).size,
        minutes,
      };
    });
  });

  /** Preview geometry of the shift under the pointer, or null. */
  readonly activePreview = computed<ShiftPreview | null>(() => {
    const interaction = this.interaction();
    if (interaction === null || !interaction.active || interaction.preview === null) {
      return null;
    }
    const range = interaction.preview;
    const geometry = rangeToPercent(range, interaction.windowStart, interaction.windowMinutes);
    return {
      key: interaction.bar.key,
      left: geometry.left,
      width: geometry.width,
      label: `${minutesToTime(range.start)}–${minutesToTime(range.end)}`,
      valid: interaction.valid,
      reason: interaction.reason,
    };
  });

  readonly editingAffectedWorkers = computed(() => {
    const bar = this.editingShift();
    return bar === null ? 0 : (this.affectedWorkersBySchedule().get(bar.scheduleId) ?? 1);
  });

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
      const areaLabels = (worker.assignedAreas ?? []).flatMap((id) => {
        const area = areasById.get(id);
        return area === undefined ? [] : [area.name];
      });
      const jobTitle = worker.jobTitle?.trim() ?? '';
      return [
        {
          worker,
          workerId: worker.id,
          areaLabels,
          role: jobTitle !== '' ? jobTitle : deriveRole(areaLabels),
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

  /** Opening windows indexed by weekday, parsed to hours. */
  readonly openingsByDay = computed<Partial<Record<DayOfWeek, OpeningDay>>>(() => {
    const map: Partial<Record<DayOfWeek, OpeningDay>> = {};
    for (const day of this.openingHours()) {
      map[day.dayOfWeek] = {
        closed: day.closed,
        openHour: Number(day.openTime?.slice(0, 2) ?? 0),
        closeHour: Number(day.closeTime?.slice(0, 2) ?? 24),
      };
    }
    return map;
  });

  /** Workers per day/hour for the filtered rows, bounded by the opening window. */
  readonly coverage = computed(() => {
    const openings = Object.values(this.openingsByDay()).filter((day) => !day.closed);
    const start = openings.length > 0 ? Math.min(...openings.map((day) => day.openHour)) : 6;
    const end = openings.length > 0 ? Math.max(...openings.map((day) => day.closeHour)) : 24;
    return buildCoverage(
      this.filteredRows().map((row) => row.week),
      start,
      end,
    );
  });

  /** Open day/hour pairs without a scheduled worker. */
  readonly coverageGaps = computed(() => findCoverageGaps(this.coverage(), this.openingsByDay()));

  isOpenHour(day: DayOfWeek, hour: number): boolean {
    const opening = this.openingsByDay()[day];
    // Without configured hours the matrix keeps the old shift-derived behaviour.
    if (opening === undefined) return true;
    return isHourOpen(opening, hour);
  }

  dayClosed(day: DayOfWeek): boolean {
    return this.openingsByDay()[day]?.closed === true;
  }

  coverageTone(count: number): string {
    if (count <= 0) return '';
    if (count >= 3) return 'week-grid__cov--high';
    if (count === 2) return 'week-grid__cov--mid';
    return 'week-grid__cov--low';
  }

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
      opening: this.settingsApi
        .getOpeningHours()
        .pipe(catchError(() => of({ days: [] as OpeningHoursDay[] }))),
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
          this.openingHours.set(data.opening.days);
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

  // ---- Graphical shift editing --------------------------------------------

  /** Left percentage of a bar, using the live preview while it is dragged. */
  barLeft(bar: TimelineBar): number {
    const preview = this.activePreview();
    return preview !== null && preview.key === bar.key ? preview.left : bar.left;
  }

  /** Width percentage of a bar, using the live preview while it is dragged. */
  barWidth(bar: TimelineBar): number {
    const preview = this.activePreview();
    return preview !== null && preview.key === bar.key ? preview.width : bar.width;
  }

  isActiveBar(bar: TimelineBar): boolean {
    return this.activePreview()?.key === bar.key;
  }

  /** Live times while the bar is being dragged, otherwise the saved range. */
  barTimeLabel(bar: TimelineBar): string {
    const preview = this.activePreview();
    return preview !== null && preview.key === bar.key
      ? preview.label
      : `${bar.startTime}–${bar.endTime}`;
  }

  activeBarInvalid(): boolean {
    return this.activePreview()?.valid === false;
  }

  onBarPointerDown(event: PointerEvent, bar: TimelineBar): void {
    if (event.button !== 0 || this.interaction() !== null || this.savingTemplateId() !== null) {
      return;
    }
    const barElement = event.currentTarget;
    if (!(barElement instanceof HTMLElement)) {
      return;
    }
    const track = barElement.closest('.week-grid__track');
    if (!(track instanceof HTMLElement)) {
      return;
    }
    const trackWidth = track.getBoundingClientRect().width;
    if (trackWidth <= 0) {
      return;
    }

    const handle =
      event.target instanceof Element ? event.target.closest('[data-shift-handle]') : null;
    const handleKind = handle?.getAttribute('data-shift-handle');
    const mode: ShiftInteractionMode =
      handleKind === 'start' ? 'resize-start' : handleKind === 'end' ? 'resize-end' : 'move';

    const timeline = this.timelineRange();
    const windowStart = timeline.start * 60;
    const windowMinutes = Math.max(1, (timeline.end - timeline.start) * 60);
    const bounds: MinutesBounds = {
      min: windowStart,
      max: Math.min(windowStart + windowMinutes, LATEST_SHIFT_MINUTE),
    };

    event.preventDefault();
    barElement.setPointerCapture(event.pointerId);
    this.suppressClickKey = null;
    this.actionError.set(null);
    this.interaction.set({
      mode,
      bar,
      pointerId: event.pointerId,
      originClientX: event.clientX,
      trackWidth,
      windowStart,
      windowMinutes,
      bounds,
      original: { start: bar.startMinutes, end: bar.endMinutes },
      active: false,
      preview: null,
      valid: true,
      reason: null,
    });
  }

  onBarPointerMove(event: PointerEvent): void {
    const interaction = this.interaction();
    if (interaction === null || interaction.pointerId !== event.pointerId) {
      return;
    }
    const deltaPx = event.clientX - interaction.originClientX;
    if (!interaction.active && Math.abs(deltaPx) < DRAG_THRESHOLD_PX) {
      return;
    }

    event.preventDefault();
    const deltaMinutes = deltaPxToMinutes(
      deltaPx,
      interaction.trackWidth,
      interaction.windowMinutes,
    );
    const preview = this.proposedRange(interaction, deltaMinutes);

    if (preview === null) {
      this.interaction.set({
        ...interaction,
        active: true,
        preview: null,
        valid: false,
        reason: 'El turno no cabe dentro del horario visible.',
      });
      return;
    }

    const reason = this.proposalError(interaction.bar, preview);
    this.interaction.set({
      ...interaction,
      active: true,
      preview,
      valid: reason === null,
      reason,
    });
  }

  onBarPointerUp(event: PointerEvent): void {
    const interaction = this.interaction();
    if (interaction === null || interaction.pointerId !== event.pointerId) {
      return;
    }
    this.releaseCapture(event.currentTarget, event.pointerId);

    if (!interaction.active) {
      this.interaction.set(null);
      return;
    }

    // A completed gesture must not also open the edit dialog.
    this.suppressClickKey = interaction.bar.key;

    if (interaction.valid && interaction.preview !== null) {
      this.commitRange(interaction.bar, interaction.preview);
    } else {
      this.interaction.set(null);
      this.showError(interaction.reason ?? 'No se pudo mover el turno.');
    }
  }

  onBarPointerCancel(event: PointerEvent): void {
    const interaction = this.interaction();
    if (interaction === null || interaction.pointerId !== event.pointerId) {
      return;
    }
    this.releaseCapture(event.currentTarget, event.pointerId);
    this.interaction.set(null);
  }

  /** Escape during a gesture restores the original times without feedback noise. */
  cancelInteraction(): void {
    const interaction = this.interaction();
    if (interaction === null) {
      return;
    }
    if (interaction.active) {
      // The pointer release after Escape must not be read as a click.
      this.suppressClickKey = interaction.bar.key;
    }
    this.interaction.set(null);
  }

  onBarClick(bar: TimelineBar): void {
    if (this.suppressClickKey === bar.key) {
      this.suppressClickKey = null;
      return;
    }
    this.openShiftEditor(bar);
  }

  onBarKeydown(event: Event, bar: TimelineBar): void {
    event.preventDefault();
    this.openShiftEditor(bar);
  }

  openShiftEditor(bar: TimelineBar): void {
    const schedule = this.schedules().find((candidate) => candidate.id === bar.scheduleId);
    if (schedule === undefined || this.savingTemplateId() !== null) {
      return;
    }
    this.editingShift.set(bar);
    this.editingStartTime.set(bar.startTime.slice(0, 5));
    this.editingEndTime.set(bar.endTime.slice(0, 5));
    this.editingError.set(null);
    this.actionError.set(null);
  }

  closeShiftEditor(): void {
    if (this.savingTemplateId() !== null) {
      return;
    }
    this.editingShift.set(null);
    this.editingError.set(null);
  }

  onEditorVisibleChange(visible: boolean): void {
    if (!visible) {
      this.closeShiftEditor();
    }
  }

  saveShiftEditor(): void {
    const bar = this.editingShift();
    if (bar === null || this.savingTemplateId() !== null) {
      return;
    }
    const start = timeToMinutes(this.editingStartTime());
    const end = timeToMinutes(this.editingEndTime());
    if (start === null || end === null) {
      this.editingError.set('Indica una hora de inicio y de fin válidas.');
      return;
    }
    const range: MinuteRange = { start, end };
    const reason = this.proposalError(bar, range);
    if (reason !== null) {
      this.editingError.set(reason);
      return;
    }
    this.editingError.set(null);
    this.commitRange(bar, range, () => {
      this.editingShift.set(null);
    });
  }

  private proposedRange(interaction: ShiftInteraction, deltaMinutes: number): MinuteRange | null {
    if (interaction.mode === 'resize-start') {
      return resizeStart(interaction.original, deltaMinutes, interaction.bounds, MIN_SHIFT_MINUTES);
    }
    if (interaction.mode === 'resize-end') {
      return resizeEnd(interaction.original, deltaMinutes, interaction.bounds, MIN_SHIFT_MINUTES);
    }
    return moveShift(interaction.original, deltaMinutes, interaction.bounds);
  }

  private proposalError(bar: TimelineBar, range: MinuteRange): string | null {
    const bounds = this.shiftBounds();
    if (range.end <= range.start) {
      return 'La hora de fin debe ser posterior a la de inicio.';
    }
    if (!isRangeWithin(range, bounds, MIN_SHIFT_MINUTES)) {
      return `El turno debe durar al menos ${String(MIN_SHIFT_MINUTES)} min y quedar dentro del horario visible.`;
    }

    const schedule = this.schedules().find((candidate) => candidate.id === bar.scheduleId);
    if (schedule === undefined) {
      return 'El turno ya no está disponible.';
    }

    const report: ScheduleUpdateConflictReport = detectScheduleUpdateConflicts({
      updatedSchedule: this.templateWithRange(schedule, bar, range),
      assignedWorkers: this.assignedWorkerContexts(schedule.id),
    });
    return report.blocking[0] ?? null;
  }

  private shiftBounds(): MinutesBounds {
    const timeline = this.timelineRange();
    const min = timeline.start * 60;
    return { min, max: Math.min(timeline.end * 60, LATEST_SHIFT_MINUTE) };
  }

  private assignedWorkerContexts(scheduleId: number): readonly WorkerScheduleContext[] {
    const workersById = new Map(this.workers().map((worker) => [worker.id, worker]));
    const schedulesById = new Map(this.schedules().map((schedule) => [schedule.id, schedule]));
    const contexts: WorkerScheduleContext[] = [];

    for (const [workerId, scheduleIds] of this.assignments()) {
      if (!scheduleIds.includes(scheduleId)) {
        continue;
      }
      const otherSchedules = scheduleIds.flatMap((id) => {
        if (id === scheduleId) {
          return [];
        }
        const schedule = schedulesById.get(id);
        return schedule === undefined ? [] : [schedule];
      });
      contexts.push({
        workerName: workersById.get(workerId)?.name ?? `Trabajador ${String(workerId)}`,
        otherSchedules,
      });
    }
    return contexts;
  }

  private templateWithRange(
    schedule: ScheduleModel,
    bar: TimelineBar,
    range: MinuteRange,
  ): ScheduleModel {
    return {
      ...schedule,
      shifts: schedule.shifts.map((shift) =>
        this.matchesBarShift(shift, bar)
          ? {
              ...shift,
              startTime: minutesToTime(range.start),
              endTime: minutesToTime(range.end),
            }
          : shift,
      ),
    };
  }

  private matchesBarShift(shift: ScheduleModel['shifts'][number], bar: TimelineBar): boolean {
    if (bar.shiftId !== undefined) {
      return shift.id === bar.shiftId;
    }
    return (
      shift.dayOfWeek === bar.dayOfWeek &&
      shift.startTime === bar.startTime &&
      shift.endTime === bar.endTime
    );
  }

  /**
   * Applies the change optimistically, sends the complete template through the
   * existing PUT, then replaces it with the server copy. Any failure restores
   * the exact previous list, so no half-edited week survives an error.
   */
  private commitRange(bar: TimelineBar, range: MinuteRange, onSuccess?: () => void): void {
    const schedule = this.schedules().find((candidate) => candidate.id === bar.scheduleId);
    if (schedule === undefined) {
      return;
    }
    const previous = this.schedules();
    const optimistic = this.templateWithRange(schedule, bar, range);
    const payload: CreateScheduleRequest = {
      name: optimistic.name,
      description: optimistic.description,
      shifts: optimistic.shifts.map((shift) => ({
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        endTime: shift.endTime,
      })),
    };
    const affectedWorkers = this.affectedWorkersBySchedule().get(schedule.id) ?? 1;

    this.interaction.set(null);
    this.schedules.set(
      previous.map((candidate) => (candidate.id === schedule.id ? optimistic : candidate)),
    );
    this.savingTemplateId.set(schedule.id);
    this.actionError.set(null);

    this.scheduleService.update(schedule.id, payload).subscribe({
      next: (updated) => {
        this.schedules.set(
          this.schedules().map((candidate) => (candidate.id === updated.id ? updated : candidate)),
        );
        this.savingTemplateId.set(null);
        const shared =
          affectedWorkers > 1 ? ` Se aplicó a ${String(affectedWorkers)} trabajadores.` : '';
        this.showNotice(`Horario «${updated.name}» actualizado.${shared}`);
        onSuccess?.();
      },
      error: (err: HttpErrorResponse) => {
        this.schedules.set(previous);
        this.savingTemplateId.set(null);
        const message = this.translateError(
          err,
          `No se pudo actualizar «${schedule.name}». La semana volvió al estado anterior.`,
        );
        this.showError(message);
        if (this.editingShift() !== null) {
          this.editingError.set(message);
        }
      },
    });
  }

  private releaseCapture(target: EventTarget | null, pointerId: number): void {
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const guard = target as unknown as {
      hasPointerCapture?: (id: number) => boolean;
    };
    if (guard.hasPointerCapture?.call(target, pointerId)) {
      target.releasePointerCapture(pointerId);
    }
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
      this.showError('Espera a que termine la operación anterior.');
      return false;
    }
    const report = this.conflictFor(worker, schedule);
    if (report.blocking.length > 0) {
      this.notice.set(null);
      this.showError(report.blocking.join(' '));
      return false;
    }
    if (this.isAssigned(worker, schedule)) {
      this.showNotice(`«${schedule.name}» ya está asignado a ${worker.name}.`);
      return false;
    }

    const previous = this.assignments().get(workerId) ?? [];
    this.setWorkerAssignments(workerId, [...previous, schedule.id]);
    this.savingWorkerId.set(workerId);
    this.savingScheduleId.set(schedule.id);
    this.actionError.set(null);

    this.assignmentService.assign(workerId, schedule.id).subscribe({
      next: (result) => {
        this.savingWorkerId.set(null);
        this.savingScheduleId.set(null);
        const serverWarning = result.warning?.trim() ?? '';
        // The server is authoritative for the 42 h rule; only append local
        // warnings that it does not cover (for example a >12 h day).
        const localWarnings = report.warnings.filter(
          (warning) => serverWarning.length === 0 || !warning.includes('semanales'),
        );
        const warning = [serverWarning, ...localWarnings].filter(Boolean).join(' ');
        const suffix = warning.length > 0 ? ` ${warning}` : '';
        this.showNotice(`«${schedule.name}» asignado a ${worker.name}.${suffix}`);
      },
      error: (err: HttpErrorResponse) => {
        this.savingWorkerId.set(null);
        this.savingScheduleId.set(null);
        const current = this.assignments().get(workerId) ?? [];
        this.setWorkerAssignments(
          workerId,
          current.filter((id) => id !== schedule.id),
        );
        this.showError(
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
        this.showNotice(`«${pending.schedule.name}» quitado de ${pending.worker.name}.`);
      },
      error: (err: HttpErrorResponse) => {
        this.savingWorkerId.set(null);
        this.savingScheduleId.set(null);
        const current = this.assignments().get(workerId) ?? [];
        if (!current.includes(pending.schedule.id)) {
          this.setWorkerAssignments(workerId, [...current, pending.schedule.id]);
        }
        this.showError(
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
    return schedule === null || schedule === undefined
      ? '0 h'
      : formatMinutes(scheduleMinutes(schedule));
  }

  private showNotice(message: string): void {
    this.clearNoticeTimer();
    this.notice.set(message);
    this.noticeTimer = setTimeout(() => {
      this.notice.set(null);
      this.noticeTimer = null;
    }, NOTICE_TIMEOUT_MS);
  }

  private clearNoticeTimer(): void {
    if (this.noticeTimer !== null) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
  }

  private showError(message: string): void {
    this.clearErrorTimer();
    this.actionError.set(message);
    this.errorTimer = setTimeout(() => {
      this.actionError.set(null);
      this.errorTimer = null;
    }, ERROR_TIMEOUT_MS);
  }

  private clearErrorTimer(): void {
    if (this.errorTimer !== null) {
      clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
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
      const exact = ASSIGNMENT_ERRORS.get(detail);
      if (exact !== undefined) {
        return exact;
      }
      for (const [needle, message] of SHIFT_UPDATE_ERRORS) {
        if (detail.toLowerCase().includes(needle.toLowerCase())) {
          return message;
        }
      }
      return detail;
    }
    if (err.status === 0) {
      return 'No se pudo contactar al servidor. Revisa la conexión e inténtalo de nuevo.';
    }
    return fallback;
  }
}
