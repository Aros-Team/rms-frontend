import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { Logging } from '@app/core/services/logging/logging';
import { WorkerSchedule } from '@app/core/services/schedules/worker-schedule';
import type {
  WorkerScheduleResponse,
  WorkerScheduleShift,
} from '@app/shared/models/dto/schedules/worker-schedule-response';
import {
  DAY_LABELS,
  DAY_SHORT_LABELS,
  DAY_ORDER,
  dayOfWeekOfDate,
  describeUpcomingShift,
  findUpcomingShift,
  formatMinutes,
  isSameLocalDay,
  shiftMinutes,
  startOfWeek,
  weekDates,
} from '@app/core/services/schedules/schedule-planning';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsCard } from '@app/shared/ui/card/card';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsSection } from '@app/shared/ui/section/section';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

interface DayView {
  readonly dayOfWeek: keyof typeof DAY_LABELS;
  readonly date: Date;
  readonly shifts: readonly WorkerScheduleShift[];
  readonly today: boolean;
}

const DAY_FORMATTER = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const RANGE_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Worker "Mi horario".
 *
 * Feature: the next shift front and centre, the current/selected week with
 * dates, and an honest attendance note.
 *
 * Contract:
 *  - the API returns a recurring seven-day week with no dates; the view adds
 *    the dates of the selected week for orientation only;
 *  - "Próximo turno" is computed from the real clock and searches a full week
 *    ahead, so a Sunday-night shift is not lost on a Monday;
 *  - clock-in/out is **not** rendered: the API only writes `IN` at login and
 *    exposes no clock endpoints. The card states the limitation instead of
 *    faking a clock-out (P3-BE-RL-11);
 *  - loading, empty, error and no-permission states are explicit.
 */
@Component({
  selector: 'app-my-schedule',
  imports: [
    RmsBadge,
    RmsButton,
    RmsCard,
    RmsEmptyState,
    RmsIconButton,
    RmsPageHeader,
    RmsSection,
    RmsSkeleton,
  ],
  templateUrl: './my-schedule.html',
  styleUrl: './my-schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySchedule implements OnInit {
  private workerScheduleService = inject(WorkerSchedule);
  private logger = inject(Logging);
  private destroyRef = inject(DestroyRef);

  readonly scheduleData = signal<WorkerScheduleResponse | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly forbidden = signal(false);

  readonly weekAnchor = signal(new Date());
  readonly now = signal(new Date());

  readonly dayLabels = DAY_LABELS;
  readonly dayShortLabels = DAY_SHORT_LABELS;
  readonly formatMinutes = formatMinutes;

  readonly weekStart = computed(() => startOfWeek(this.weekAnchor()));
  readonly isCurrentWeek = computed(() =>
    isSameLocalDay(this.weekStart(), startOfWeek(this.now())),
  );
  readonly weekLabel = computed(() => {
    const dates = weekDates(this.weekAnchor());
    return `${RANGE_FORMATTER.format(dates[0])} – ${RANGE_FORMATTER.format(dates[6])}`;
  });

  readonly days = computed<readonly DayView[]>(() => {
    const data = this.scheduleData();
    const dates = weekDates(this.weekAnchor());
    const byDay = new Map(
      (data?.days ?? []).map((day) => [day.dayOfWeek as keyof typeof DAY_LABELS, day]),
    );
    return DAY_ORDER.map((dayOfWeek, index) => ({
      dayOfWeek,
      date: dates[index],
      shifts: byDay.get(dayOfWeek)?.shifts ?? [],
      today: isSameLocalDay(dates[index], this.now()),
    }));
  });

  readonly totalShifts = computed(() =>
    this.days().reduce((total, day) => total + day.shifts.length, 0),
  );
  readonly totalMinutes = computed(() =>
    this.days().reduce(
      (total, day) =>
        total +
        day.shifts.reduce(
          (dayTotal, shift) => dayTotal + shiftMinutes(shift.startTime, shift.endTime),
          0,
        ),
      0,
    ),
  );

  readonly upcoming = computed(() => {
    const data = this.scheduleData();
    return data === null ? null : findUpcomingShift(data, this.now());
  });
  readonly upcomingCountdown = computed(() => {
    const shift = this.upcoming();
    return shift === null ? '' : describeUpcomingShift(shift, this.now());
  });

  constructor() {
    const timer = setInterval(() => {
      this.now.set(new Date());
    }, 30_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
    });
  }

  ngOnInit(): void {
    this.loadSchedule();
  }

  loadSchedule(): void {
    this.loading.set(true);
    this.error.set(null);
    this.forbidden.set(false);
    this.workerScheduleService.getMySchedule().subscribe({
      next: (data) => {
        this.scheduleData.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load the worker schedule', err);
        this.forbidden.set(err.status === 403);
        this.error.set(
          err.status === 403
            ? 'Tu cuenta no tiene permiso para consultar el horario.'
            : 'No se pudo cargar tu horario. Revisa la conexión e inténtalo de nuevo.',
        );
        this.loading.set(false);
      },
    });
  }

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
    this.weekAnchor.set(
      new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + days),
    );
  }

  dayNumber(date: Date): string {
    return DAY_FORMATTER.format(date);
  }

  shiftHours(shift: WorkerScheduleShift): string {
    return formatMinutes(shiftMinutes(shift.startTime, shift.endTime));
  }

  upcomingDate(shiftDate: Date): string {
    return FULL_DATE_FORMATTER.format(shiftDate);
  }

  weekDay(dayOfWeek: string): string {
    return Object.hasOwn(DAY_LABELS, dayOfWeek)
      ? DAY_LABELS[dayOfWeek as keyof typeof DAY_LABELS]
      : dayOfWeek;
  }

  shortDay(dayOfWeek: string): string {
    return Object.hasOwn(DAY_SHORT_LABELS, dayOfWeek)
      ? DAY_SHORT_LABELS[dayOfWeek as keyof typeof DAY_SHORT_LABELS]
      : dayOfWeek;
  }

  /** Exposed for the template: the day of the upcoming shift, capitalised. */
  upcomingDayName(): string {
    const shift = this.upcoming();
    return shift === null ? '' : DAY_LABELS[dayOfWeekOfDate(shift.date)];
  }
}
