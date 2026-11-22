/**
 * Tests for the schedule planning domain.
 *
 * Feature: the weekly grid, the assignment guardrails and the attendance
 * summary share one deterministic model.
 *
 * Contract:
 *  - shift maths is total: malformed or inverted ranges count as 0 minutes;
 *  - a worker week is the union of the assigned templates, counted once even
 *    when the same schedule id appears twice;
 *  - assignment rules block missing area, double booking, overlapping shifts
 *    and the hard weekly cap; legal weekly hours and long days are warnings;
 *  - time logs only produce hours from a closed IN/OUT pair; open, orphan and
 *    reversed sessions are exceptions;
 *  - "next shift" handles an active shift, a later shift today, the next day
 *    and an empty week.
 *
 * Approach: pure functions, no TestBed, fixed local dates.
 */
import { describe, expect, it } from 'vitest';

import type { Schedule } from '@app/shared/models/dto/schedules/schedule';
import type { Shift, DayOfWeek } from '@app/shared/models/dto/schedules/shift';
import type { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry';
import type { WorkerScheduleResponse } from '@app/shared/models/dto/schedules/worker-schedule-response';
import {
  DAY_ORDER,
  MAX_WEEKLY_HOURS,
  buildCoverage,
  buildWorkerWeek,
  findCoverageGaps,
  isHourOpen,
  describeUpcomingShift,
  detectAssignmentConflicts,
  findUpcomingShift,
  findWeekOverlaps,
  formatMinutes,
  scheduleMinutes,
  shiftMinutes,
  startOfWeek,
  summarizeTimeLogs,
  timeToMinutes,
  weekDates,
} from './schedule-planning';

function shift(
  dayOfWeek: DayOfWeek,
  startTime: string,
  endTime: string,
  id?: number,
): Shift {
  return { dayOfWeek, startTime, endTime, ...(id !== undefined ? { id } : {}) };
}

function schedule(id: number, name: string, shifts: Shift[]): Schedule {
  return { id, name, shifts };
}

function fullWeek(id: number, name: string, start: string, end: string): Schedule {
  return schedule(
    id,
    name,
    DAY_ORDER.map((day) => shift(day, start, end)),
  );
}

function instant(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function log(
  id: number,
  workerId: number,
  timestamp: string,
  type: 'IN' | 'OUT',
  withinShift = true,
): TimeLogEntry {
  return { id, workerId, timestamp, type, withinShift, relatedShiftId: null };
}

const SERVICE_AREA = [2];

describe('shift maths', () => {
  it('converts HH:mm to minutes and rejects malformed values', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('9:05')).toBe(545);
    expect(timeToMinutes('24:00')).toBeNull();
    expect(timeToMinutes('12:60')).toBeNull();
    expect(timeToMinutes('noon')).toBeNull();
  });

  it('counts a normal shift and a zero-minute inverted range', () => {
    expect(shiftMinutes('11:00', '15:00')).toBe(240);
    expect(shiftMinutes('23:00', '02:00')).toBe(0);
    expect(shiftMinutes('11:00', '11:00')).toBe(0);
    expect(shiftMinutes('bad', '15:00')).toBe(0);
  });

  it('formats durations for people', () => {
    expect(formatMinutes(0)).toBe('0 h');
    expect(formatMinutes(270)).toBe('4 h 30 min');
    expect(formatMinutes(240)).toBe('4 h');
  });
});

describe('worker week', () => {
  it('merges the assigned templates into seven days', () => {
    const week = buildWorkerWeek([
      fullWeek(1, 'Mañana', '11:00', '15:00'),
      fullWeek(2, 'Noche', '18:00', '23:00'),
    ]);

    expect(week.days).toHaveLength(7);
    expect(week.days[0].shifts.map((item) => item.scheduleName)).toEqual(['Mañana', 'Noche']);
    expect(week.days[0].minutes).toBe(540);
    expect(week.weeklyMinutes).toBe(63 * 60);
    expect(week.longestDayMinutes).toBe(540);
  });

  it('counts a repeated schedule id only once', () => {
    const template = fullWeek(1, 'Mañana', '11:00', '15:00');
    const week = buildWorkerWeek([template, template]);

    expect(week.weeklyMinutes).toBe(28 * 60);
  });

  it('summarises a template in minutes', () => {
    expect(scheduleMinutes(fullWeek(1, 'Mañana', '11:00', '15:00'))).toBe(28 * 60);
  });

  it('finds overlapping blocks and their keys', () => {
    const week = buildWorkerWeek([
      schedule(1, 'Mañana', [shift('MONDAY', '11:00', '15:00', 1)]),
      schedule(2, 'Tarde', [shift('MONDAY', '14:00', '18:00', 2)]),
      schedule(3, 'Noche', [shift('TUESDAY', '18:00', '23:00', 3)]),
    ]);

    const report = findWeekOverlaps(week);

    expect(report.keys.size).toBe(2);
    expect(report.messages[0]).toContain('Lunes');
    expect(report.messages[0]).toContain('11:00–15:00');
    expect(report.messages[0]).toContain('14:00–18:00');
  });
});

describe('assignment conflicts', () => {
  const mañana = fullWeek(1, 'Mañana', '11:00', '15:00');

  it('blocks a worker without an area', () => {
    const report = detectAssignmentConflicts({
      workerName: 'Ana',
      workerAreaIds: [],
      assignedSchedules: [],
      candidate: mañana,
    });

    expect(report.blocking[0]).toContain('no tiene un área asignada');
  });

  it('blocks double booking of the same template', () => {
    const report = detectAssignmentConflicts({
      workerName: 'Ana',
      workerAreaIds: SERVICE_AREA,
      assignedSchedules: [mañana],
      candidate: mañana,
    });

    expect(report.blocking).toContain('Ana ya tiene asignado «Mañana» (doble reserva).');
    expect(report.weeklyMinutes).toBe(28 * 60);
  });

  it('blocks a shift overlap with an existing template', () => {
    const tarde = schedule(2, 'Tarde', [shift('MONDAY', '14:00', '18:00')]);
    const report = detectAssignmentConflicts({
      workerName: 'Ana',
      workerAreaIds: SERVICE_AREA,
      assignedSchedules: [mañana],
      candidate: tarde,
    });

    expect(report.blocking.some((message) => message.includes('se cruza'))).toBe(true);
  });

  it('blocks a template with overlapping shifts of its own', () => {
    const broken = schedule(3, 'Rota', [
      shift('MONDAY', '11:00', '15:00'),
      shift('MONDAY', '14:00', '18:00'),
    ]);
    const report = detectAssignmentConflicts({
      workerName: 'Ana',
      workerAreaIds: SERVICE_AREA,
      assignedSchedules: [],
      candidate: broken,
    });

    expect(report.blocking[0]).toContain('turnos superpuestos');
  });

  it('blocks a hard weekly cap and warns about the legal reference', () => {
    const over = fullWeek(4, 'Doble', '08:00', '20:00');
    const report = detectAssignmentConflicts({
      workerName: 'Ana',
      workerAreaIds: SERVICE_AREA,
      assignedSchedules: [mañana],
      candidate: over,
    });

    expect(report.weeklyMinutes).toBeGreaterThan(MAX_WEEKLY_HOURS * 60);
    expect(report.blocking.some((message) => message.includes('máximo operativo'))).toBe(true);
  });

  it('allows a legal-range assignment and warns only above the legal reference', () => {
    const apoyo = schedule(5, 'Apoyo', [shift('MONDAY', '16:00', '18:00')]);
    const allowed = detectAssignmentConflicts({
      workerName: 'Ana',
      workerAreaIds: SERVICE_AREA,
      assignedSchedules: [],
      candidate: apoyo,
    });
    expect(allowed.blocking).toEqual([]);
    expect(allowed.weeklyMinutes).toBe(120);

    const warning = detectAssignmentConflicts({
      workerName: 'Ana',
      workerAreaIds: SERVICE_AREA,
      assignedSchedules: [fullWeek(7, 'Base', '08:00', '14:00')],
      candidate: fullWeek(6, 'Extra', '16:00', '17:00'),
    });
    expect(warning.blocking).toEqual([]);
    expect(warning.warnings.some((message) => message.includes('legales'))).toBe(true);
  });
});

describe('week navigation', () => {
  it('starts the week on Monday and returns seven dated days', () => {
    const saturday = new Date(2026, 10, 21);
    const monday = startOfWeek(saturday);
    const dates = weekDates(saturday);

    expect(monday.getDay()).toBe(1);
    expect(dates).toHaveLength(7);
    expect(dates[0].getDate()).toBe(16);
    expect(dates[6].getDate()).toBe(22);
  });
});

describe('upcoming shift', () => {
  const response: WorkerScheduleResponse = {
    days: [
      { dayOfWeek: 'MONDAY', shifts: [{ scheduleName: 'Mañana', startTime: '11:00', endTime: '15:00' }] },
      { dayOfWeek: 'TUESDAY', shifts: [{ scheduleName: 'Mañana', startTime: '11:00', endTime: '15:00' }] },
    ],
  };

  it('returns the shift in progress first', () => {
    const mondayNoon = new Date(2026, 10, 16, 12, 0);
    const upcoming = findUpcomingShift(response, mondayNoon);

    expect(upcoming?.active).toBe(true);
    if (upcoming === null) {
      throw new Error('Expected a shift in progress');
    }
    expect(describeUpcomingShift(upcoming, mondayNoon)).toBe('En curso ahora');
  });

  it('returns next Tuesday when Monday has already ended', () => {
    const mondayEvening = new Date(2026, 10, 16, 18, 0);
    const upcoming = findUpcomingShift(response, mondayEvening);

    expect(upcoming?.active).toBe(false);
    expect(upcoming?.date.getDate()).toBe(17);
    expect(upcoming?.startsAt.getHours()).toBe(11);
  });

  it('looks a full week ahead', () => {
    const sunday = new Date(2026, 10, 22, 20, 0);
    const upcoming = findUpcomingShift(response, sunday);

    expect(upcoming?.date.getDate()).toBe(23);
  });

  it('returns null for an empty week', () => {
    expect(findUpcomingShift({ days: [] }, new Date())).toBeNull();
  });
});

describe('time-log summary', () => {
  it('pairs a closed session and reports its hours', () => {
    const summaries = summarizeTimeLogs([
      log(1, 1001, instant(2026, 11, 20, 11, 0), 'IN'),
      log(2, 1001, instant(2026, 11, 20, 15, 0), 'OUT'),
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].workerId).toBe(1001);
    expect(summaries[0].minutes).toBe(240);
    expect(summaries[0].openSessions).toBe(0);
    expect(summaries[0].exceptions).toEqual([]);
  });

  it('keeps split shifts in one day and sums them', () => {
    const summaries = summarizeTimeLogs([
      log(1, 1001, instant(2026, 11, 20, 11, 0), 'IN'),
      log(2, 1001, instant(2026, 11, 20, 15, 0), 'OUT'),
      log(3, 1001, instant(2026, 11, 20, 18, 0), 'IN'),
      log(4, 1001, instant(2026, 11, 20, 23, 0), 'OUT'),
    ]);

    expect(summaries[0].sessions).toHaveLength(2);
    expect(summaries[0].minutes).toBe(540);
  });

  it('marks an open session instead of inventing a clock-out', () => {
    const summaries = summarizeTimeLogs([
      log(1, 1001, instant(2026, 11, 20, 11, 0), 'IN'),
    ]);

    expect(summaries[0].minutes).toBe(0);
    expect(summaries[0].openSessions).toBe(1);
    expect(summaries[0].exceptions).toContain('Sin salida registrada');
  });

  it('reports an OUT without a matching IN and an outside-shift log', () => {
    const summaries = summarizeTimeLogs([
      log(1, 1001, instant(2026, 11, 20, 15, 0), 'OUT'),
      log(2, 1001, instant(2026, 11, 20, 18, 0), 'IN', false),
    ]);

    expect(summaries[0].exceptions).toContain('Salida sin entrada');
    expect(summaries[0].exceptions).toContain('Registro fuera de turno');
  });

  it('reports a zero-length pair as an open session', () => {
    const summaries = summarizeTimeLogs([
      log(1, 1001, instant(2026, 11, 20, 15, 0), 'IN'),
      log(2, 1001, instant(2026, 11, 20, 15, 0), 'OUT'),
    ]);

    expect(summaries[0].minutes).toBe(0);
    expect(summaries[0].exceptions).toContain('Salida anterior a la entrada');
  });

  it('groups different workers and days separately', () => {
    const summaries = summarizeTimeLogs([
      log(1, 1001, instant(2026, 11, 20, 11, 0), 'IN'),
      log(2, 1001, instant(2026, 11, 20, 15, 0), 'OUT'),
      log(3, 1002, instant(2026, 11, 21, 11, 0), 'IN'),
      log(4, 1002, instant(2026, 11, 21, 15, 0), 'OUT'),
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries.map((summary) => summary.workerId).sort()).toEqual([1001, 1002]);
  });

  describe('buildCoverage', () => {
    function schedule(id: number, shifts: Shift[]): Schedule {
      return { id, name: `S${String(id)}`, shifts };
    }

    it('counts every worker scheduled in each hour bucket', () => {
      const ana = buildWorkerWeek([
        schedule(1, [
          { dayOfWeek: 'MONDAY', startTime: '10:00', endTime: '14:00' },
        ]),
      ]);
      const luis = buildWorkerWeek([
        schedule(2, [
          { dayOfWeek: 'MONDAY', startTime: '12:00', endTime: '16:00' },
        ]),
      ]);

      const coverage = buildCoverage([ana, luis], 8, 18);
      const monday = coverage.rows.find((row) => row.dayOfWeek === 'MONDAY');

      expect(coverage.hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
      expect(monday?.counts[coverage.hours.indexOf(10)]).toBe(1);
      expect(monday?.counts[coverage.hours.indexOf(12)]).toBe(2);
      expect(monday?.counts[coverage.hours.indexOf(15)]).toBe(1);
      expect(monday?.counts[coverage.hours.indexOf(16)]).toBe(0);
      expect(coverage.max).toBe(2);
    });

    it('expands the window when a shift starts earlier than the default', () => {
      const early = buildWorkerWeek([
        schedule(3, [
          { dayOfWeek: 'TUESDAY', startTime: '04:30', endTime: '09:00' },
        ]),
      ]);

      const coverage = buildCoverage([early], 8, 18);

      expect(coverage.startHour).toBe(4);
      const tuesday = coverage.rows.find((row) => row.dayOfWeek === 'TUESDAY');
      expect(tuesday?.counts[coverage.hours.indexOf(4)]).toBe(1);
      expect(tuesday?.counts[coverage.hours.indexOf(8)]).toBe(1);
    });

    it('returns an empty matrix when nobody is scheduled', () => {
      const coverage = buildCoverage([], 8, 18);

      expect(coverage.max).toBe(0);
      expect(coverage.rows.every((row) => row.counts.every((count) => count === 0))).toBe(true);
    });
  });
});

describe('opening hours coverage', () => {
  function matrixFor(counts: number[]): import('./schedule-planning').CoverageMatrix {
    return {
      startHour: 10,
      endHour: 13,
      hours: [10, 11, 12],
      max: Math.max(...counts),
      rows: [
        { dayOfWeek: 'MONDAY', label: 'Lun', counts },
        { dayOfWeek: 'TUESDAY', label: 'Mar', counts: [0, 0, 0] },
      ],
    };
  }

  it('reports only open hours with zero staff', () => {
    const gaps = findCoverageGaps(matrixFor([1, 0, 2]), {
      MONDAY: { closed: false, openHour: 10, closeHour: 13 },
      TUESDAY: { closed: true, openHour: 10, closeHour: 13 },
    });

    expect(gaps).toEqual([{ dayOfWeek: 'MONDAY', hour: 11, count: 0 }]);
  });

  it('ignores days without a configured window', () => {
    const gaps = findCoverageGaps(matrixFor([0, 0, 0]), {});

    expect(gaps).toEqual([]);
  });

  it('treats hours outside the window as closed', () => {
    expect(isHourOpen({ closed: false, openHour: 10, closeHour: 13 }, 9)).toBe(false);
    expect(isHourOpen({ closed: false, openHour: 10, closeHour: 13 }, 12)).toBe(true);
    expect(isHourOpen({ closed: true, openHour: 10, closeHour: 13 }, 12)).toBe(false);
  });
});
