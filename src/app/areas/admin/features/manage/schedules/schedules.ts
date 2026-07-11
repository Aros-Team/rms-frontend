import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { Schedule } from '@app/core/services/schedules/schedule';
import { Logging } from '@app/core/services/logging/logging';
import { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule.model';
import { DayOfWeek, Shift as ShiftModel } from '@app/shared/models/dto/schedules/shift.model';
import { CreateScheduleRequest } from '@app/shared/models/dto/schedules/create-schedule-request.model';

import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';

const errorTranslations: Record<string, string> = {
  'Schedule name already exists': 'El nombre del horario ya existe',
  'Shifts cannot overlap on the same day': 'Los turnos no pueden solaparse en el mismo día',
  'Cannot delete schedule with active assignments': 'No se puede eliminar: el horario tiene trabajadores asignados',
};

@Component({
  selector: 'app-schedules',
  imports: [
    RouterModule,
    ReactiveFormsModule,
    ButtonModule, TableModule, ToastModule, TagModule, SkeletonModule,
    ConfirmDialogModule, DialogModule, InputTextModule, SelectModule, InputNumberModule,
    TooltipModule,
    TableSkeleton,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './schedules.html',
  styleUrl: './schedules.css',
})
export class Schedules implements OnInit {
  private scheduleService = inject(Schedule);
  private logger = inject(Logging);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  // Wrap Validators.required to avoid @typescript-eslint/unbound-method lint errors
  private readonly requiredValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
    Validators.required(control);

  schedules = signal<ScheduleModel[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Modal state
  modalVisible = signal(false);
  editingSchedule = signal<ScheduleModel | null>(null);
  saving = signal(false);
  formSubmitted = signal(false);
  shiftError = signal<string | null>(null);

  // Shift days for dropdown
  shiftDays = signal<DayOfWeek[]>(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);

  dayLabels: Record<string, string> = {
    MONDAY: 'Lunes',
    TUESDAY: 'Martes',
    WEDNESDAY: 'Miércoles',
    THURSDAY: 'Jueves',
    FRIDAY: 'Viernes',
    SATURDAY: 'Sábado',
    SUNDAY: 'Domingo',
  };

  dayOptions = computed(() =>
    this.shiftDays().map((day) => ({
      label: this.dayLabels[day],
      value: day,
    })),
  );

  // Reactive form
  scheduleForm: FormGroup;

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

  ngOnInit() {
    this.loadSchedules();
  }

  loadSchedules(): void {
    this.loading.set(true);
    this.error.set(null);
    this.scheduleService.getAll().subscribe({
      next: (data) => {
        this.schedules.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.logger.error('Failed to load schedules', err);
        this.error.set('Error al cargar los horarios');
        this.loading.set(false);
      },
    });
  }

  // ---- Shift helpers ----

  buildShiftGroup(): FormGroup {
    return this.fb.group({
      dayOfWeek: ['', this.requiredValidator],
      startTime: ['', this.requiredValidator],
      endTime: ['', this.requiredValidator],
    });
  }

  addShift(): void {
    this.shifts.push(this.buildShiftGroup());
  }

  removeShift(index: number): void {
    this.shifts.removeAt(index);
    this.shiftError.set(null);
  }

  validateShifts(): boolean {
    this.shiftError.set(null);
    const controls = this.shifts.controls;

    // Check time ordering: startTime < endTime for each shift
    for (let i = 0; i < controls.length; i++) {
      const group = controls[i] as FormGroup;
      const start = group.get('startTime')?.value as string | undefined;
      const end = group.get('endTime')?.value as string | undefined;

      if (start && end && start >= end) {
        this.shiftError.set(`Turno #${String(i + 1)}: la hora de inicio debe ser anterior a la de fin`);
        return false;
      }
    }

    // Check for overlapping shifts on the same day
    for (let i = 0; i < controls.length; i++) {
      const group = controls[i] as FormGroup;
      const day = group.get('dayOfWeek')?.value as string | undefined;
      const start = group.get('startTime')?.value as string | undefined;
      const end = group.get('endTime')?.value as string | undefined;

      if (day && start && end && this.hasOverlap(day, start, end, i)) {
        this.shiftError.set('Los turnos no pueden superponerse en el mismo día');
        return false;
      }
    }

    return true;
  }

  hasOverlap(day: string, start: string, end: string, excludingIndex: number): boolean {
    const controls = this.shifts.controls;

    for (let i = 0; i < controls.length; i++) {
      if (i === excludingIndex) {
        continue;
      }
      const group = controls[i] as FormGroup;
      const otherDay = group.get('dayOfWeek')?.value as string | undefined;
      const otherStart = group.get('startTime')?.value as string | undefined;
      const otherEnd = group.get('endTime')?.value as string | undefined;

      if (day === otherDay && start && end && otherStart && otherEnd) {
        // Check if intervals overlap: (startA < endB) && (startB < endA)
        if (start < otherEnd && otherStart < end) {
          return true;
        }
      }
    }

    return false;
  }

  // ---- Modal handlers ----

  openCreateModal(): void {
    this.editingSchedule.set(null);
    this.formSubmitted.set(false);
    this.shiftError.set(null);
    this.scheduleForm.get('name')?.reset('');
    this.scheduleForm.get('description')?.reset('');
    this.shifts.clear();
    this.addShift();
    this.modalVisible.set(true);
  }

  openEditModal(schedule: ScheduleModel): void {
    this.editingSchedule.set(schedule);
    this.loadScheduleForEdit(schedule);
    this.modalVisible.set(true);
  }

  loadScheduleForEdit(schedule: ScheduleModel): void {
    this.formSubmitted.set(false);
    this.shiftError.set(null);
    this.scheduleForm.get('name')?.reset(schedule.name);
    this.scheduleForm.get('description')?.reset(schedule.description ?? '');
    this.shifts.clear();

    for (const shift of schedule.shifts) {
      this.shifts.push(
        this.fb.group({
          dayOfWeek: [shift.dayOfWeek, this.requiredValidator],
          startTime: [shift.startTime, this.requiredValidator],
          endTime: [shift.endTime, this.requiredValidator],
        }),
      );
    }
  }

  saveSchedule(): void {
    this.formSubmitted.set(true);

    // Mark all controls as touched to trigger validation display
    this.scheduleForm.markAllAsTouched();
    this.shifts.controls.forEach((group) => {
      (group as FormGroup).markAllAsTouched();
    });

    if (this.scheduleForm.invalid || !this.validateShifts()) {
      return;
    }

    this.saving.set(true);
    const raw: { name: string; description: string | null; shifts: Omit<ShiftModel, 'id'>[] } =
      this.scheduleForm.getRawValue() as typeof raw;
    const data: CreateScheduleRequest = {
      name: raw.name,
      description: raw.description ?? undefined,
      shifts: raw.shifts,
    };

    const editing = this.editingSchedule();
    const obs = editing
      ? this.scheduleService.update(editing.id, data)
      : this.scheduleService.create(data);

    obs.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Guardado',
          detail: 'Horario guardado correctamente',
        });
        this.saving.set(false);
        this.modalVisible.set(false);
        this.loadSchedules();
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        if (err.status === 409) {
          const body = err.error as Record<string, string> | null;
          const backendMessage = body?.['message'] ?? '';
          const translated = errorTranslations[backendMessage] || 'Ya existe un horario con ese nombre';
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: translated,
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Error al guardar el horario',
          });
        }
      },
    });
  }

  deleteSchedule(schedule: ScheduleModel, event: Event): void {
    const target = event.target;
    if (!target) {
      return;
    }
    this.confirmationService.confirm({
      target,
      message: `¿Eliminar el horario "${schedule.name}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.scheduleService.delete(schedule.id).subscribe({
          next: () => {
            this.messageService.add({ severity: 'success', summary: 'Eliminado', detail: 'Horario eliminado correctamente' });
            this.loadSchedules();
          },
          error: (err: HttpErrorResponse) => {
            if (err.status === 409) {
              const body = err.error as Record<string, string> | null;
              const backendMessage = body?.['message'] ?? '';
              const translated = errorTranslations[backendMessage] || 'No se puede eliminar: el horario tiene trabajadores asignados';
              this.messageService.add({ severity: 'error', summary: 'Error', detail: translated });
            } else {
              this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar el horario' });
            }
          },
        });
      },
    });
  }

  getShiftCount(schedule: ScheduleModel): number {
    return schedule.shifts.length;
  }
}
