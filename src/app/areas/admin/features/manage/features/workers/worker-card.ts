import { Component, computed, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import { AreaResponse } from '@app/shared/models/dto/areas/area';
import { Schedule } from '@app/shared/models/dto/schedules/schedule';
import { DayOfWeek } from '@app/shared/models/dto/schedules/shift';
import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsCard } from '@app/shared/ui/card/card';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';

const DAY_ORDER: readonly DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const DAY_SHORT: Record<DayOfWeek, string> = {
  MONDAY: 'Lun',
  TUESDAY: 'Mar',
  WEDNESDAY: 'Mié',
  THURSDAY: 'Jue',
  FRIDAY: 'Vie',
  SATURDAY: 'Sáb',
  SUNDAY: 'Dom',
};

function clock(value: string): string {
  return value.slice(0, 5);
}

function compactDays(days: readonly DayOfWeek[]): string {
  const indexes = days
    .map((day) => DAY_ORDER.indexOf(day))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  if (indexes.length === 0) {
    return '';
  }
  const consecutive = indexes.every((value, index) => index === 0 || value === indexes[index - 1] + 1);
  if (consecutive && indexes.length > 2) {
    return `${DAY_SHORT[DAY_ORDER[indexes[0]]]}–${DAY_SHORT[DAY_ORDER[indexes[indexes.length - 1]]]}`;
  }
  return indexes.map((index) => DAY_SHORT[DAY_ORDER[index]]).join(', ');
}

function weeklyMinutes(schedules: readonly Schedule[]): number {
  return schedules.reduce(
    (total, schedule) =>
      total +
      (schedule.shifts).reduce((sum, shift) => {
        const [startHour, startMinute] = shift.startTime.split(':').map(Number);
        const [endHour, endMinute] = shift.endTime.split(':').map(Number);
        return sum + (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
      }, 0),
    0,
  );
}

@Component({
  selector: 'app-worker-card',
  imports: [RouterModule, RmsBadge, RmsCard, RmsIconButton, RmsStatusPill],
  templateUrl: './worker-card.html',
})
export class WorkerCard {
  readonly worker = input.required<WorkerResponse>();
  readonly areas = input<AreaResponse[]>([]);
  readonly assignedSchedules = input<readonly Schedule[]>([]);

  readonly assignSchedule = output();
  readonly edit = output();
  readonly retryEmail = output();
  readonly delete = output();

  initials = computed(() => {
    const name = this.worker().name || '';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase() || '??';
  });

  areaName = computed(() => {
    const areaId = this.worker().assignedAreas?.[0];
    if (areaId == null) return 'Sin área';
    const area = this.areas().find(a => a.id === areaId);
    return area?.name ?? 'Sin área';
  });

  /** Day range and time window of the assigned schedule, e.g. "Lun–Vie 08:00–16:00". */
  scheduleSummary = computed(() => {
    const schedules = this.assignedSchedules();
    if (schedules.length === 0) {
      return 'Sin horario';
    }
    if (schedules.length > 1) {
      return `${String(schedules.length)} horarios`;
    }
    const shifts = schedules[0].shifts;
    if (shifts.length === 0) {
      return 'Sin turnos';
    }
    const days = compactDays(shifts.map((shift) => shift.dayOfWeek));
    const first = shifts[0];
    const sameWindow = shifts.every(
      (shift) => shift.startTime === first.startTime && shift.endTime === first.endTime,
    );
    const window = sameWindow
      ? `${clock(first.startTime)}–${clock(first.endTime)}`
      : 'horario variable';
    return `${days} ${window}`;
  });

  /** Total contracted hours per week across the assigned schedules. */
  weeklyHoursLabel = computed(() => {
    const minutes = weeklyMinutes(this.assignedSchedules());
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? String(hours) : hours.toFixed(1)} h/sem`;
  });

  statusLabel = computed(() => {
    switch (this.worker().status) {
      case 'PENDING': return 'Pendiente';
      case 'ERROR': return 'Error';
      case 'ACTIVE': return 'Activo';
      case 'INACTIVE': return 'Inactivo';
      default: return this.worker().status ?? 'Desconocido';
    }
  });

  statusTone = computed<'success' | 'warning' | 'danger' | 'neutral'>(() => {
    switch (this.worker().status) {
      case 'PENDING': return 'warning';
      case 'ERROR': return 'danger';
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'neutral';
      default: return 'neutral';
    }
  });

  onAssignSchedule(): void {
    this.assignSchedule.emit();
  }

  onEdit(): void {
    this.edit.emit();
  }

  onRetryEmail(): void {
    this.retryEmail.emit();
  }

  onDelete(): void {
    this.delete.emit();
  }
}
