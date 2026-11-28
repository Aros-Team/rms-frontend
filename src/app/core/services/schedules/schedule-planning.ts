/**
 * Pure planning logic for the schedules module.
 *
 * Feature: one place that turns the schedule contract (`schedules` + worker
 * assignments + time logs) into the shapes the admin weekly grid and the
 * worker "Mi horario" screen need: per-day shift blocks, weekly hours,
 * conflict reports, the next shift and per-day attendance summaries.
 *
 * Contract:
 *  - no HTTP and no Angular: every function is deterministic and unit tested;
 *  - a worker "week" is the union of the shifts of the schedules assigned to
 *    them (the API assigns a whole schedule, never an individual shift);
 *  - the API has no dates on an assignment, so the grid is a recurring week:
 *    `weekDates()` only drives labels and "today" highlighting;
 *  - time logs pair `IN`/`OUT` events per worker and local day. The running
 *    API build only records `IN`; `OUT` rows are part of the seeded contract
 *    but need the P3-BE-RL-11 build to decode. The pairer is written against
 *    the target contract and reports open/odd sessions as exceptions instead
 *    of inventing a clock-out.
 */

import type { DayOfWeek, Shift } from '@app/shared/models/dto/schedules/shift';
import type { Schedule } from '@app/shared/models/dto/schedules/schedule';
import type { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry';
import type { WorkerScheduleResponse } from '@app/shared/models/dto/schedules/worker-schedule-response';

/** Monday-first day order used by every schedule surface. */
export const DAY_ORDER: readonly DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const DAY_LABELS: Readonly<Record<DayOfWeek, string>> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

export const DAY_SHORT_LABELS: Readonly<Record<DayOfWeek, string>> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

/**
 * Hard weekly ceiling used by the client before it posts an assignment.
 *
 * Colombian law caps the ordinary week at 42 h; the API rejects anything
 * above that, so the client blocks it before touching the network.
 */
export const MAX_WEEKLY_HOURS = 42;

/** Legal weekly limit; assignments above it are rejected by the API. */
export const LEGAL_WEEKLY_HOURS = 42;

/** A single day above this is flagged as a warning. */
export const MAX_DAILY_HOURS = 12;

/** Minutes in a shift, or `0` for a malformed or non-positive range. */
export function shiftMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return 0;
  }
  return end - start;
}

/** `HH:mm` → minutes since midnight, or `null` when malformed. */
export function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (match === null) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** `270` → `4 h 30 min`; `0` → `0 h`. */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0 h';
  }
  const whole = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (rest === 0) {
    return `${String(whole)} h`;
  }
  return `${String(whole)} h ${String(rest)} min`;
}

/** Hours rounded to two decimals for `aria-label` / summaries. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** Stable key for one shift instance inside a worker week. */
export function shiftKey(scheduleId: number, shift: Shift): string {
  const suffix =
    shift.id !== undefined
      ? String(shift.id)
      : `${shift.dayOfWeek}-${shift.startTime}-${shift.endTime}`;
  return `${String(scheduleId)}-${suffix}`;
}

export interface PlannedShift {
  readonly key: string;
  readonly scheduleId: number;
  readonly scheduleName: string;
  readonly shiftId?: number;
  readonly dayOfWeek: DayOfWeek;
  readonly startTime: string;
  readonly endTime: string;
  readonly minutes: number;
}

export interface WorkerWeekDay {
  readonly dayOfWeek: DayOfWeek;
  readonly shifts: readonly PlannedShift[];
  readonly minutes: number;
}

interface MutableWeekDay {
  dayOfWeek: DayOfWeek;
  shifts: PlannedShift[];
  minutes: number;
}

export interface WorkerWeek {
  readonly days: readonly WorkerWeekDay[];
  readonly weeklyMinutes: number;
  readonly longestDayMinutes: number;
}

/** Expands the shifts of a schedule into planning blocks. */
export function scheduleShifts(schedule: Schedule): PlannedShift[] {
  return schedule.shifts.flatMap((shift) => {
    const minutes = shiftMinutes(shift.startTime, shift.endTime);
    if (minutes === 0) {
      return [];
    }
    return [
      {
        key: shiftKey(schedule.id, shift),
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        ...(shift.id !== undefined ? { shiftId: shift.id } : {}),
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        endTime: shift.endTime,
        minutes,
      },
    ];
  });
}

/** Weekly minutes of a schedule (all seven days). */
export function scheduleMinutes(schedule: Schedule): number {
  return scheduleShifts(schedule).reduce((total, shift) => total + shift.minutes, 0);
}

/**
 * Builds a worker week from the schedules assigned to that worker.
 *
 * A schedule id repeated in the input is counted once, so a double assignment
 * can never double the weekly hours.
 */
export function buildWorkerWeek(schedules: readonly Schedule[]): WorkerWeek {
  const days: MutableWeekDay[] = DAY_ORDER.map((dayOfWeek) => {
    const shifts: PlannedShift[] = [];
    return { dayOfWeek, shifts, minutes: 0 };
  });
  const seenSchedules = new Set<number>();

  for (const schedule of schedules) {
    if (seenSchedules.has(schedule.id)) {
      continue;
    }
    seenSchedules.add(schedule.id);
    for (const shift of scheduleShifts(schedule)) {
      const day = days.find((candidate) => candidate.dayOfWeek === shift.dayOfWeek);
      if (day === undefined) {
        continue;
      }
      day.shifts.push(shift);
    }
  }

  let weeklyMinutes = 0;
  let longestDayMinutes = 0;
  for (const day of days) {
    day.shifts.sort(
      (left, right) => (timeToMinutes(left.startTime) ?? 0) - (timeToMinutes(right.startTime) ?? 0),
    );
    const minutes = day.shifts.reduce((total, shift) => total + shift.minutes, 0);
    day.minutes = minutes;
    weeklyMinutes += minutes;
    longestDayMinutes = Math.max(longestDayMinutes, minutes);
  }

  return { days, weeklyMinutes, longestDayMinutes };
}

export interface WeekOverlapReport {
  /** Keys of the blocks involved in at least one overlap. */
  readonly keys: ReadonlySet<string>;
  readonly messages: readonly string[];
}

/** All-pairs overlap check inside a worker week (display + bootstrap). */
export function findWeekOverlaps(week: WorkerWeek): WeekOverlapReport {
  const keys = new Set<string>();
  const messages: string[] = [];

  for (const day of week.days) {
    for (let left = 0; left < day.shifts.length; left += 1) {
      for (let right = left + 1; right < day.shifts.length; right += 1) {
        const first = day.shifts[left];
        const second = day.shifts[right];
        if (!overlaps(first, second)) {
          continue;
        }
        keys.add(first.key);
        keys.add(second.key);
        messages.push(
          `${DAY_LABELS[day.dayOfWeek]}: «${first.scheduleName}» ${first.startTime}–${first.endTime} se cruza con «${second.scheduleName}» ${second.startTime}–${second.endTime}.`,
        );
      }
    }
  }

  return { keys, messages };
}

function overlaps(
  first: Pick<PlannedShift, 'startTime' | 'endTime'>,
  second: Pick<PlannedShift, 'startTime' | 'endTime'>,
): boolean {
  const firstStart = timeToMinutes(first.startTime);
  const firstEnd = timeToMinutes(first.endTime);
  const secondStart = timeToMinutes(second.startTime);
  const secondEnd = timeToMinutes(second.endTime);
  if (firstStart === null || firstEnd === null || secondStart === null || secondEnd === null) {
    return false;
  }
  return firstStart < secondEnd && secondStart < firstEnd;
}

export interface AssignmentConflictInput {
  readonly workerName: string;
  /** Area ids assigned to the worker. Empty means "not planifiable yet". */
  readonly workerAreaIds: readonly number[] | undefined;
  /** Schedules currently assigned to the worker. */
  readonly assignedSchedules: readonly Schedule[];
  /** Schedule the admin is trying to assign. */
  readonly candidate: Schedule;
}

export interface AssignmentConflictReport {
  /** Rules that stop the request before it is sent. */
  readonly blocking: readonly string[];
  /** Rules worth surfacing but that do not block the request. */
  readonly warnings: readonly string[];
  /** Weekly hours after the assignment (0 when it is blocked as duplicate). */
  readonly weeklyMinutes: number;
}

/**
 * Client-side rules checked before `POST /schedule-assignments`.
 *
 * Blocking: missing area, double booking, shift overlap, hard weekly cap.
 * Warnings: legal weekly cap and over-long days.
 */
export function detectAssignmentConflicts(
  input: AssignmentConflictInput,
): AssignmentConflictReport {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const { workerName, candidate, assignedSchedules } = input;

  if ((input.workerAreaIds ?? []).length === 0) {
    blocking.push(
      `${workerName} no tiene un área asignada; asígnala en Empleados antes de planificar turnos.`,
    );
  }

  const duplicate = assignedSchedules.some((schedule) => schedule.id === candidate.id);
  if (duplicate) {
    blocking.push(`${workerName} ya tiene asignado «${candidate.name}» (doble reserva).`);
  }

  if (!duplicate) {
    for (const candidateShift of scheduleShifts(candidate)) {
      for (const existing of assignedSchedules) {
        for (const existingShift of scheduleShifts(existing)) {
          if (candidateShift.dayOfWeek !== existingShift.dayOfWeek) {
            continue;
          }
          if (!overlaps(candidateShift, existingShift)) {
            continue;
          }
          blocking.push(
            `${DAY_LABELS[candidateShift.dayOfWeek]}: «${candidate.name}» ${candidateShift.startTime}–${candidateShift.endTime} se cruza con «${existing.name}» ${existingShift.startTime}–${existingShift.endTime}.`,
          );
        }
      }
    }

    for (let left = 0; left < candidate.shifts.length; left += 1) {
      for (let right = left + 1; right < candidate.shifts.length; right += 1) {
        const first = candidate.shifts[left];
        const second = candidate.shifts[right];
        if (first.dayOfWeek !== second.dayOfWeek) {
          continue;
        }
        if (!overlaps(first, second)) {
          continue;
        }
        blocking.push(
          `La plantilla «${candidate.name}» tiene turnos superpuestos el ${DAY_LABELS[first.dayOfWeek].toLowerCase()} (${first.startTime}–${first.endTime} y ${second.startTime}–${second.endTime}).`,
        );
      }
    }
  }

  const current = buildWorkerWeek(assignedSchedules);
  const candidateMinutes = duplicate ? 0 : scheduleMinutes(candidate);
  const weeklyMinutes = current.weeklyMinutes + candidateMinutes;
  const weeklyHours = minutesToHours(weeklyMinutes);

  if (weeklyMinutes > MAX_WEEKLY_HOURS * 60) {
    blocking.push(
      `La asignación llevaría a ${workerName} a ${String(weeklyHours)} h semanales; el máximo operativo es ${String(MAX_WEEKLY_HOURS)} h.`,
    );
  } else if (weeklyMinutes > LEGAL_WEEKLY_HOURS * 60) {
    warnings.push(
      `${workerName} quedaría con ${String(weeklyHours)} h semanales, por encima de las ${String(LEGAL_WEEKLY_HOURS)} h legales de referencia.`,
    );
  }

  if (candidateMinutes > 0) {
    const candidateWeek = buildWorkerWeek([candidate]);
    for (const day of candidateWeek.days) {
      if (day.minutes > MAX_DAILY_HOURS * 60) {
        warnings.push(
          `${workerName} tendría ${formatMinutes(day.minutes)} el ${DAY_LABELS[day.dayOfWeek].toLowerCase()} (más de ${String(MAX_DAILY_HOURS)} h).`,
        );
      }
    }
  }

  return { blocking, warnings, weeklyMinutes };
}

export interface WorkerScheduleContext {
  readonly workerName: string;
  /** Schedules assigned to the worker other than the one being updated. */
  readonly otherSchedules: readonly Schedule[];
}

export interface ScheduleUpdateConflictInput {
  readonly updatedSchedule: Schedule;
  /** Every worker that currently holds the schedule being updated. */
  readonly assignedWorkers: readonly WorkerScheduleContext[];
}

export interface ScheduleUpdateConflictReport {
  readonly blocking: readonly string[];
  readonly warnings: readonly string[];
  readonly affectedWorkers: number;
}

/**
 * Client-side rules for editing a shift of an existing schedule template.
 *
 * Updating a template changes it for every assigned worker, so the same
 * overlap and weekly-cap rules used when assigning must be checked again
 * against each of those workers' other schedules. The backend repeats these
 * checks before persisting; this copy exists to reject a gesture instantly.
 */
export function detectScheduleUpdateConflicts(
  input: ScheduleUpdateConflictInput,
): ScheduleUpdateConflictReport {
  const blocking = new Set<string>();
  const warnings = new Set<string>();
  const updated = input.updatedSchedule;

  for (let left = 0; left < updated.shifts.length; left += 1) {
    for (let right = left + 1; right < updated.shifts.length; right += 1) {
      const first = updated.shifts[left];
      const second = updated.shifts[right];
      if (first.dayOfWeek !== second.dayOfWeek || !overlaps(first, second)) {
        continue;
      }
      blocking.add(
        `La plantilla «${updated.name}» dejaría turnos superpuestos el ${DAY_LABELS[first.dayOfWeek].toLowerCase()} (${first.startTime}–${first.endTime} y ${second.startTime}–${second.endTime}).`,
      );
    }
  }

  for (const worker of input.assignedWorkers) {
    for (const candidate of scheduleShifts(updated)) {
      for (const other of worker.otherSchedules) {
        for (const existing of scheduleShifts(other)) {
          if (candidate.dayOfWeek !== existing.dayOfWeek || !overlaps(candidate, existing)) {
            continue;
          }
          blocking.add(
            `${worker.workerName}: «${updated.name}» ${candidate.startTime}–${candidate.endTime} se cruza con «${other.name}» ${existing.startTime}–${existing.endTime} el ${DAY_LABELS[candidate.dayOfWeek].toLowerCase()}.`,
          );
        }
      }
    }

    const totalMinutes =
      scheduleMinutes(updated) +
      worker.otherSchedules.reduce((total, other) => total + scheduleMinutes(other), 0);
    const weeklyHours = minutesToHours(totalMinutes);
    if (totalMinutes > MAX_WEEKLY_HOURS * 60) {
      blocking.add(
        `${worker.workerName} quedaría con ${String(weeklyHours)} h semanales; el máximo operativo es ${String(MAX_WEEKLY_HOURS)} h.`,
      );
    } else if (totalMinutes > LEGAL_WEEKLY_HOURS * 60) {
      warnings.add(
        `${worker.workerName} quedaría con ${String(weeklyHours)} h semanales, por encima de las ${String(LEGAL_WEEKLY_HOURS)} h legales de referencia.`,
      );
    }

    const week = buildWorkerWeek([updated, ...worker.otherSchedules]);
    for (const day of week.days) {
      if (day.minutes > MAX_DAILY_HOURS * 60) {
        warnings.add(
          `${worker.workerName} tendría ${formatMinutes(day.minutes)} el ${DAY_LABELS[day.dayOfWeek].toLowerCase()} (más de ${String(MAX_DAILY_HOURS)} h).`,
        );
      }
    }
  }

  return {
    blocking: Array.from(blocking),
    warnings: Array.from(warnings),
    affectedWorkers: input.assignedWorkers.length,
  };
}

/** First day of the week (Monday) at local midnight. */
export function startOfWeek(anchor: Date): Date {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

export function addDays(anchor: Date, days: number): Date {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  date.setDate(date.getDate() + days);
  return date;
}

/** Monday → Sunday of the week containing `anchor`. */
export function weekDates(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_unused, index) => addDays(start, index));
}

/** Local `YYYY-MM-DD` (no UTC shift). */
export function localIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${String(date.getFullYear())}-${month}-${day}`;
}

/** `new Date()` → `MONDAY` … `SUNDAY`. */
export function dayOfWeekOfDate(date: Date): DayOfWeek {
  const index = (date.getDay() + 6) % 7;
  return DAY_ORDER[index];
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Local day start as an ISO instant, for the time-log `from` filter. */
export function startOfLocalDayIso(date: Date): string {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  return start.toISOString();
}

/** Local day end as an ISO instant, for the time-log `to` filter. */
export function endOfLocalDayIso(date: Date): string {
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return end.toISOString();
}

export interface UpcomingShift {
  readonly dayOfWeek: DayOfWeek;
  readonly date: Date;
  readonly startTime: string;
  readonly endTime: string;
  readonly scheduleName: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly active: boolean;
}

/**
 * Next (or currently active) shift of a recurring worker week.
 *
 * Searches today plus the next seven days, so a Sunday night shift is found
 * for a Monday morning "next shift". Returns `null` when the week is empty.
 */
export function findUpcomingShift(
  schedule: WorkerScheduleResponse,
  now: Date = new Date(),
): UpcomingShift | null {
  const days = schedule.days;
  let upcoming: UpcomingShift | null = null;

  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(now, offset);
    const day = days.find((candidate) => candidate.dayOfWeek === dayOfWeekOfDate(date));
    if (day === undefined) {
      continue;
    }
    for (const shift of day.shifts) {
      const startMinutes = timeToMinutes(shift.startTime);
      const endMinutes = timeToMinutes(shift.endTime);
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        continue;
      }
      const startsAt = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        Math.floor(startMinutes / 60),
        startMinutes % 60,
        0,
        0,
      );
      const endsAt = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        Math.floor(endMinutes / 60),
        endMinutes % 60,
        0,
        0,
      );
      const candidate: UpcomingShift = {
        dayOfWeek: dayOfWeekOfDate(date),
        date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        scheduleName: shift.scheduleName,
        startsAt,
        endsAt,
        active: now >= startsAt && now < endsAt,
      };
      if (candidate.active) {
        return candidate;
      }
      if (startsAt > now && (upcoming === null || startsAt < upcoming.startsAt)) {
        upcoming = candidate;
      }
    }
  }

  return upcoming;
}

/** Human countdown for an upcoming shift ("en 3 h 20 min", "en curso"). */
export function describeUpcomingShift(shift: UpcomingShift, now: Date = new Date()): string {
  if (shift.active) {
    return 'En curso ahora';
  }
  const minutes = Math.round((shift.startsAt.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) {
    return 'Empieza ahora';
  }
  if (minutes < 60) {
    return `En ${String(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `En ${String(hours)} h ${String(minutes % 60)} min`;
  }
  return `En ${String(Math.round(hours / 24))} días`;
}

export interface TimeLogSession {
  readonly clockIn: Date | null;
  readonly clockOut: Date | null;
  readonly minutes: number;
  readonly open: boolean;
}

export interface TimeLogDaySummary {
  readonly key: string;
  readonly workerId: number;
  readonly date: Date;
  readonly dateIso: string;
  readonly sessions: readonly TimeLogSession[];
  readonly minutes: number;
  readonly openSessions: number;
  readonly exceptions: readonly string[];
}

interface LogAccumulator {
  workerId: number;
  date: Date;
  dateIso: string;
  logs: TimeLogEntry[];
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Groups time logs per worker and local day, pairing `IN`/`OUT`.
 *
 * Every anomaly is reported as text; hours only come from a closed pair, so an
 * open session never pretends to be a completed shift.
 */
export function summarizeTimeLogs(logs: readonly TimeLogEntry[]): TimeLogDaySummary[] {
  const groups = new Map<string, LogAccumulator>();

  for (const log of logs) {
    const parsed = new Date(log.timestamp);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    const date = startOfLocalDay(parsed);
    const dateIso = localIsoDate(date);
    const key = `${String(log.workerId)}:${dateIso}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { workerId: log.workerId, date, dateIso, logs: [log] });
    } else {
      existing.logs.push(log);
    }
  }

  const summaries = Array.from(groups.values()).map((group) => {
    const sorted = [...group.logs].sort(
      (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );
    const sessions: TimeLogSession[] = [];
    const exceptions: string[] = [];
    let openIn: TimeLogEntry | null = null;
    let openCount = 0;

    for (const log of sorted) {
      if (!log.withinShift) {
        exceptions.push('Registro fuera de turno');
      }
      if (log.type === 'IN') {
        if (openIn !== null) {
          exceptions.push('Entrada sin salida previa');
          continue;
        }
        openIn = log;
        sessions.push({
          clockIn: new Date(log.timestamp),
          clockOut: null,
          minutes: 0,
          open: true,
        });
        openCount += 1;
        continue;
      }
      if (openIn === null) {
        exceptions.push('Salida sin entrada');
        continue;
      }
      const clockIn = new Date(openIn.timestamp);
      const clockOut = new Date(log.timestamp);
      const minutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
      const index = sessions.length - 1;
      if (minutes <= 0) {
        exceptions.push('Salida anterior a la entrada');
        sessions[index] = { clockIn, clockOut: null, minutes: 0, open: true };
      } else {
        sessions[index] = { clockIn, clockOut, minutes, open: false };
        openCount -= 1;
      }
      openIn = null;
    }

    if (openIn !== null) {
      exceptions.push('Sin salida registrada');
    }

    return {
      key: `${String(group.workerId)}:${group.dateIso}`,
      workerId: group.workerId,
      date: group.date,
      dateIso: group.dateIso,
      sessions,
      minutes: sessions.reduce((total, session) => total + session.minutes, 0),
      openSessions: openCount,
      exceptions: Array.from(new Set(exceptions)),
    };
  });

  return summaries.sort((left, right) => {
    if (left.dateIso !== right.dateIso) {
      return right.dateIso.localeCompare(left.dateIso);
    }
    return left.workerId - right.workerId;
  });
}

export interface CoverageRow {
  readonly dayOfWeek: DayOfWeek;
  readonly label: string;
  /** Workers scheduled in each hour bucket, aligned with `hours`. */
  readonly counts: readonly number[];
}

export interface CoverageMatrix {
  /** First hour in the matrix (24 h clock). */
  readonly startHour: number;
  /** Exclusive end hour; `24` covers the whole day. */
  readonly endHour: number;
  readonly hours: readonly number[];
  readonly rows: readonly CoverageRow[];
  /** Highest single-cell count, used to scale the visual emphasis. */
  readonly max: number;
}

/**
 * How many workers are scheduled for every day/hour pair.
 *
 * Used by the weekly grid to answer "how many people do I have on Tuesday at
 * 18:00" without reading each worker row. A shift covering [start, end) adds
 * one worker to every hour bucket it overlaps; shifts crossing midnight are
 * clipped at `endHour`.
 */
export function buildCoverage(
  weeks: readonly WorkerWeek[],
  defaultStartHour = 6,
  defaultEndHour = 24,
): CoverageMatrix {
  let startHour = defaultStartHour;
  let endHour = defaultEndHour;

  for (const week of weeks) {
    for (const day of week.days) {
      for (const shift of day.shifts) {
        const start = timeToMinutes(shift.startTime);
        const end = timeToMinutes(shift.endTime);
        if (start === null || end === null || end <= start) continue;
        startHour = Math.min(startHour, Math.floor(start / 60));
        endHour = Math.max(endHour, Math.ceil(end / 60));
      }
    }
  }

  const hours: number[] = [];
  for (let hour = startHour; hour < endHour; hour++) hours.push(hour);

  const counts = new Map<DayOfWeek, number[]>(DAY_ORDER.map((day) => [day, hours.map(() => 0)]));

  for (const week of weeks) {
    for (const day of week.days) {
      const row = counts.get(day.dayOfWeek);
      if (row === undefined) continue;
      for (const shift of day.shifts) {
        const start = timeToMinutes(shift.startTime);
        const end = timeToMinutes(shift.endTime);
        if (start === null || end === null || end <= start) continue;
        const from = Math.max(start, startHour * 60);
        const to = Math.min(end, endHour * 60);
        const firstHour = Math.floor(from / 60);
        const lastHour = Math.ceil(to / 60) - 1;
        for (let hour = firstHour; hour <= lastHour; hour++) {
          const index = hour - startHour;
          if (index >= 0 && index < row.length) row[index] += 1;
        }
      }
    }
  }

  let max = 0;
  for (const row of counts.values()) {
    for (const value of row) max = Math.max(max, value);
  }

  return {
    startHour,
    endHour,
    hours,
    max,
    rows: DAY_ORDER.map((dayOfWeek) => ({
      dayOfWeek,
      label: DAY_SHORT_LABELS[dayOfWeek],
      counts: counts.get(dayOfWeek) ?? [],
    })),
  };
}

export interface OpeningDay {
  readonly closed: boolean;
  readonly openHour: number;
  readonly closeHour: number;
}

export interface CoverageGap {
  readonly dayOfWeek: DayOfWeek;
  readonly hour: number;
  readonly count: number;
}

/** True when `hour` falls inside the opening window of `day`. */
export function isHourOpen(day: OpeningDay | undefined, hour: number): boolean {
  return day !== undefined && !day.closed && hour >= day.openHour && hour < day.closeHour;
}

/**
 * Opening hours with no scheduled worker.
 *
 * Used by the weekly grid to raise the staffing alert: a day/hour inside the
 * business window whose coverage count is zero is a real gap, while closed
 * days and hours outside the window are not.
 */
export function findCoverageGaps(
  matrix: CoverageMatrix,
  openings: Partial<Record<DayOfWeek, OpeningDay>>,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const row of matrix.rows) {
    const opening = openings[row.dayOfWeek];
    if (opening === undefined || opening.closed) continue;
    matrix.hours.forEach((hour, index) => {
      if (isHourOpen(opening, hour) && (row.counts[index] ?? 0) === 0) {
        gaps.push({ dayOfWeek: row.dayOfWeek, hour, count: 0 });
      }
    });
  }
  return gaps;
}
