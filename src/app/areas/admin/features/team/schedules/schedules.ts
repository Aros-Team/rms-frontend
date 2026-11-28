import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { Schedule } from '@app/core/services/schedules/schedule';
import { Logging } from '@app/core/services/logging/logging';
import { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule';
import { DayOfWeek } from '@app/shared/models/dto/schedules/shift';
import { CreateScheduleRequest } from '@app/shared/models/dto/schedules/create-schedule-request';
import {
  DAY_LABELS,
  DAY_ORDER,
  DAY_SHORT_LABELS,
  formatMinutes,
  scheduleMinutes,
} from '@app/core/services/schedules/schedule-planning';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';

import { RmsButton } from '@app/shared/ui/button/button';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsField } from '@app/shared/ui/field/field';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';

interface ShiftEntry {
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
}

const ERROR_TRANSLATIONS = new Map<string, string>([
  ['Schedule name already exists', 'El nombre del horario ya existe.'],
  ['Shifts cannot overlap on the same day', 'Los turnos no pueden solaparse en el mismo día.'],
  [
    'Cannot delete schedule with active assignments',
    'No se puede eliminar: el horario tiene trabajadores asignados.',
  ],
]);

/**
 * Schedule template manager (`app-schedules`).
 *
 * Feature: create, edit and delete the weekly templates that the admin grid
 * assigns to workers.
 *
 * Contract:
 *  - the unit of work is a template: name + one or more shift ranges, each
 *    repeated across the selected days;
 *  - overlap inside a template is rejected client-side before the request;
 *  - the section has no H1 because it is embedded both in the schedules route
 *    and in the legacy settings tab; the route page owns the only H1;
 *  - loading, empty, error and saving states are explicit.
 */
@Component({
  selector: 'app-schedules',
  imports: [
    ReactiveFormsModule,
    RmsButton,
    RmsDialog,
    RmsEmptyState,
    RmsField,
    RmsIconButton,
    RmsInput,
    RmsSkeleton,
  ],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Schedules implements OnInit {
  private scheduleService = inject(Schedule);
  private logger = inject(Logging);
  private fb = inject(FormBuilder);

  /** Emitted after a template is created, updated or deleted. */
  @Output() readonly changed = new EventEmitter<void>();

  private readonly requiredValidator: ValidatorFn = (
    control: AbstractControl,
  ): ValidationErrors | null => Validators.required(control);

  readonly schedules = signal<ScheduleModel[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly forbidden = signal(false);
  readonly notice = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly dialogVisible = signal(false);
  readonly editingSchedule = signal<ScheduleModel | null>(null);
  readonly saving = signal(false);
  readonly formSubmitted = signal(false);
  readonly shiftError = signal<string | null>(null);
  readonly pendingDelete = signal<ScheduleModel | null>(null);
  readonly deleting = signal(false);

  readonly dayOrder = DAY_ORDER;
  readonly dayLabels = DAY_LABELS;
  readonly dayShortLabels = DAY_SHORT_LABELS;
  readonly formatMinutes = formatMinutes;

  readonly scheduleForm: FormGroup;

  get shifts(): FormArray {
    return this.scheduleForm.get('shifts') as FormArray;
  }

  constructor() {
    this.scheduleForm = this.fb.group({
      name: ['', this.requiredValidator],
      description: [''],
      shifts: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.loadSchedules();
  }

  loadSchedules(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.forbidden.set(false);
    this.scheduleService.getAll().subscribe({
      next: (data) => {
        this.schedules.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load schedules', err);
        this.forbidden.set(err.status === 403);
        this.loadError.set(this.translateError(err, 'No se pudieron cargar las plantillas.'));
        this.loading.set(false);
      },
    });
  }

  scheduleHours(schedule: ScheduleModel): string {
    return formatMinutes(scheduleMinutes(schedule));
  }

  // ---- Modal state -------------------------------------------------------

  openCreateModal(): void {
    this.editingSchedule.set(null);
    this.formSubmitted.set(false);
    this.shiftError.set(null);
    this.actionError.set(null);
    this.scheduleForm.get('name')?.reset('');
    this.scheduleForm.get('description')?.reset('');
    this.shifts.clear();
    this.addShiftEntry();
    this.dialogVisible.set(true);
  }

  openEditModal(schedule: ScheduleModel): void {
    this.editingSchedule.set(schedule);
    this.formSubmitted.set(false);
    this.shiftError.set(null);
    this.actionError.set(null);
    this.scheduleForm.get('name')?.reset(schedule.name);
    this.scheduleForm.get('description')?.reset(schedule.description ?? '');
    this.shifts.clear();

    const groups = new Map<string, { days: Set<DayOfWeek>; startTime: string; endTime: string }>();
    for (const shift of schedule.shifts) {
      const key = `${shift.startTime}-${shift.endTime}`;
      const existing = groups.get(key);
      if (existing === undefined) {
        groups.set(key, {
          days: new Set([shift.dayOfWeek]),
          startTime: shift.startTime,
          endTime: shift.endTime,
        });
      } else {
        existing.days.add(shift.dayOfWeek);
      }
    }

    for (const group of groups.values()) {
      this.shifts.push(
        this.fb.group({
          days: [Array.from(group.days), this.requiredValidator],
          startTime: [group.startTime, this.requiredValidator],
          endTime: [group.endTime, this.requiredValidator],
        }),
      );
    }

    if (this.shifts.length === 0) {
      this.addShiftEntry();
    }
    this.dialogVisible.set(true);
  }

  addShiftEntry(): void {
    this.shifts.push(
      this.fb.group({
        days: [[] as DayOfWeek[], this.requiredValidator],
        startTime: ['', this.requiredValidator],
        endTime: ['', this.requiredValidator],
      }),
    );
    this.shiftError.set(null);
  }

  removeShiftEntry(index: number): void {
    this.shifts.removeAt(index);
    this.shiftError.set(null);
  }

  nameError(): string {
    const control = this.scheduleForm.get('name');
    if (control === null || !control.invalid || (!control.touched && !this.formSubmitted())) {
      return '';
    }
    return 'El nombre es obligatorio.';
  }

  shiftFieldError(index: number, field: 'startTime' | 'endTime'): string {
    const group = this.shifts.at(index) as FormGroup | undefined;
    const control = group?.get(field);
    if (control?.invalid !== true) {
      return '';
    }
    if (!control.touched && !this.formSubmitted()) {
      return '';
    }
    return 'Requerido.';
  }

  daysError(index: number): string {
    const group = this.shifts.at(index) as FormGroup | undefined;
    const control = group?.get('days');
    if (control?.invalid !== true) {
      return '';
    }
    if (!control.touched && !this.formSubmitted()) {
      return '';
    }
    return 'Selecciona al menos un día.';
  }

  get weeklyPreview(): string {
    const raw = this.scheduleForm.getRawValue() as {
      shifts: ShiftEntry[];
    };
    const minutes = raw.shifts.reduce((total, entry) => {
      if (!entry.startTime || !entry.endTime || entry.startTime >= entry.endTime) {
        return total;
      }
      const start = this.toMinutes(entry.startTime);
      const end = this.toMinutes(entry.endTime);
      return total + Math.max(0, end - start) * entry.days.length;
    }, 0);
    return formatMinutes(minutes);
  }

  shiftPreview(index: number): string {
    const group = this.shifts.at(index) as FormGroup | undefined;
    if (group === undefined) {
      return '';
    }
    const days = (group.get('days')?.value ?? []) as DayOfWeek[];
    const start = (group.get('startTime')?.value ?? '') as string;
    const end = (group.get('endTime')?.value ?? '') as string;
    if (days.length === 0) {
      return 'Sin días seleccionados';
    }
    const dayText = days.map((day) => DAY_SHORT_LABELS[day]).join(', ');
    return start && end ? `${dayText} · ${start}–${end}` : dayText;
  }

  isDaySelected(index: number, day: DayOfWeek): boolean {
    const group = this.shifts.at(index) as FormGroup | undefined;
    const days = (group?.get('days')?.value ?? []) as DayOfWeek[];
    return days.includes(day);
  }

  toggleDay(index: number, day: DayOfWeek): void {
    const control = (this.shifts.at(index) as FormGroup).get('days');
    if (control === null) {
      return;
    }
    const current = (control.value ?? []) as DayOfWeek[];
    const next = current.includes(day)
      ? current.filter((candidate) => candidate !== day)
      : [...current, day];
    control.setValue(next);
    control.markAsTouched();
    control.markAsDirty();
    this.shiftError.set(null);
  }

  saveSchedule(): void {
    this.formSubmitted.set(true);
    this.actionError.set(null);
    this.scheduleForm.markAllAsTouched();
    for (const control of this.shifts.controls) {
      (control as FormGroup).markAllAsTouched();
    }

    if (this.scheduleForm.invalid || !this.validateShifts()) {
      return;
    }

    const raw = this.scheduleForm.getRawValue() as {
      name: string;
      description: string | null;
      shifts: ShiftEntry[];
    };
    const description = raw.description?.trim() ?? '';
    const request: CreateScheduleRequest = {
      name: raw.name.trim(),
      description: description === '' ? undefined : description,
      shifts: raw.shifts.flatMap((entry) =>
        entry.days.map((day) => ({
          dayOfWeek: day,
          startTime: entry.startTime,
          endTime: entry.endTime,
        })),
      ),
    };

    this.saving.set(true);
    const editing = this.editingSchedule();
    const request$ = editing
      ? this.scheduleService.update(editing.id, request)
      : this.scheduleService.create(request);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.notice.set(editing ? 'Plantilla actualizada.' : 'Plantilla creada.');
        this.changed.emit();
        this.loadSchedules();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.actionError.set(
          this.translateError(err, 'No se pudo guardar la plantilla. Revisa los datos.'),
        );
      },
    });
  }

  requestDelete(schedule: ScheduleModel): void {
    this.actionError.set(null);
    this.pendingDelete.set(schedule);
  }

  cancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const schedule = this.pendingDelete();
    if (schedule === null) {
      return;
    }
    this.deleting.set(true);
    this.scheduleService.delete(schedule.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.notice.set(`Plantilla «${schedule.name}» eliminada.`);
        this.changed.emit();
        this.loadSchedules();
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.actionError.set(this.translateError(err, 'No se pudo eliminar la plantilla.'));
      },
    });
  }

  dismissNotice(): void {
    this.notice.set(null);
  }

  dismissError(): void {
    this.actionError.set(null);
  }

  // ---- Validation -------------------------------------------------------

  validateShifts(): boolean {
    this.shiftError.set(null);
    const controls = this.shifts.controls;
    if (controls.length === 0) {
      this.shiftError.set('Agrega al menos un turno.');
      return false;
    }

    for (let index = 0; index < controls.length; index += 1) {
      const group = controls[index] as FormGroup;
      const days = (group.get('days')?.value ?? []) as DayOfWeek[];
      const start = (group.get('startTime')?.value ?? '') as string;
      const end = (group.get('endTime')?.value ?? '') as string;
      if (days.length === 0) {
        this.shiftError.set(`Turno #${String(index + 1)}: selecciona al menos un día.`);
        return false;
      }
      if (!start || !end) {
        this.shiftError.set(`Turno #${String(index + 1)}: completa la hora de inicio y fin.`);
        return false;
      }
      if (start >= end) {
        this.shiftError.set(
          `Turno #${String(index + 1)}: la hora de inicio debe ser anterior a la de fin.`,
        );
        return false;
      }
    }

    const pairs: { day: DayOfWeek; start: string; end: string }[] = [];
    for (const control of controls) {
      const group = control as FormGroup;
      const days = (group.get('days')?.value ?? []) as DayOfWeek[];
      const start = (group.get('startTime')?.value ?? '') as string;
      const end = (group.get('endTime')?.value ?? '') as string;
      for (const day of days) {
        pairs.push({ day, start, end });
      }
    }

    for (let left = 0; left < pairs.length; left += 1) {
      for (let right = left + 1; right < pairs.length; right += 1) {
        const first = pairs[left];
        const second = pairs[right];
        if (first.day !== second.day) {
          continue;
        }
        if (first.start < second.end && second.start < first.end) {
          this.shiftError.set(
            `${DAY_LABELS[first.day]}: los turnos ${first.start}–${first.end} y ${second.start}–${second.end} se superponen.`,
          );
          return false;
        }
      }
    }

    return true;
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':');
    return Number(hours) * 60 + Number(minutes);
  }

  private translateError(err: HttpErrorResponse, fallback: string): string {
    const detail = extractProblemDetail(err);
    if (detail !== null) {
      return ERROR_TRANSLATIONS.get(detail) ?? detail;
    }
    if (err.status === 403) {
      return 'No tienes permiso para administrar horarios.';
    }
    if (err.status === 0) {
      return 'No se pudo contactar al servidor. Revisa la conexión e inténtalo de nuevo.';
    }
    return fallback;
  }
}
