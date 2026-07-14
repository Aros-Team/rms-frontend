import { NgClass } from '@angular/common';
import { Component, OnInit, inject, computed, DestroyRef, signal, ViewChild, ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { WorkerResponse } from '@app/shared/models/dto/workers/worker-response.model';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Worker } from '@app/core/services/workers/worker';
import { CreateWorkerRequest } from '@app/shared/models/dto/workers/create-worker-request.model';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FormValidation } from '@app/shared/components/form/form-validation';
import { Logging } from '@app/core/services/logging/logging';
import { UpdateWorkerRequest } from '@app/shared/models/dto/workers/worker-response.model';
import { WorkersCacheService } from './workers-cache.service';
import { LazyLoadDirective } from '@app/core/directives/lazy-load.directive';
import { AreaResponse } from '@app/shared/models/dto/areas/area.model';
import { Area } from '@app/core/services/areas/area';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';
import { WorkerCard } from './worker-card';
import { TimeLog, TimeLogFilterParams } from '@app/core/services/schedules/time-log';
import { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry.model';
import { Schedule } from '@app/core/services/schedules/schedule';
import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule.model';

interface WorkerFormValue {
  document: string;
  name: string;
  email: string;
  phone: string;
  address: string | null,
  areaId: number | null,
  salary: number | null,
  reason: string | null,
  observations: string | null,
}

@Component({
  selector: 'app-workers',
  imports: [
    RouterModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    IftaLabelModule,
    ReactiveFormsModule,
    InputIconModule,
    IconFieldModule,
    SelectModule,
    InputNumberModule,
    TooltipModule,
    TagModule,
    SkeletonModule,
    ConfirmDialogModule,
    DatePickerModule,
    FormValidation,
    LazyLoadDirective,
    TableSkeleton,
    WorkerCard,
    NgClass,
  ],
  templateUrl: './workers.html',
  styles: ``,
})
export class Workers implements OnInit {
  private workerService = inject(Worker);
  private areaService = inject(Area);
  private messageService = inject(MessageService);
  private logger = inject(Logging);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);
  readonly cache = inject(WorkersCacheService);
  private timeLogService = inject(TimeLog);
  private scheduleService = inject(Schedule);
  private scheduleAssignmentService = inject(ScheduleAssignment);

  // Template refs for focus management
  @ViewChild('tabEmpleados') tabEmpleados?: ElementRef<HTMLButtonElement>;
  @ViewChild('tabTimeLogs') tabTimeLogs?: ElementRef<HTMLButtonElement>;
  @ViewChild('firstInputRef') firstInputRef?: ElementRef<HTMLElement>;

  // Tab navigation
  activeEmployeeTab = signal<'list' | 'time-logs'>('list');

  title = 'Administración de trabajadores';
  description = 'Gestión completa de todos los trabajadores del restaurante';

  // Time-log state
  timeLogs = signal<TimeLogEntry[]>([]);
  timeLogLoading = signal(false);
  timeLogError = signal<string | null>(null);
  filterWorkerId = signal<number | undefined>(undefined);
  filterFrom = signal<Date | undefined>(undefined);
  filterTo = signal<Date | undefined>(undefined);

  // Schedule assignment state
  scheduleDialogVisible = signal(false);
  selectedWorkerForSchedule = signal<WorkerResponse | null>(null);
  allSchedules = signal<ScheduleModel[]>([]);
  workerAssignedScheduleIds = signal<number[]>([]);
  assigningScheduleIds = signal<Set<number>>(new Set());
  scheduleDialogLoading = signal(false);
  userAssignedSchedules = signal<Map<number, number[]>>(new Map());

  // Filter to show only WORKER role users (employees)
  workers = computed(() => (this.cache.workers.data() ?? []));
  areas = signal<AreaResponse[]>([]);
  editing = false;
  selectedWorker: WorkerResponse | null = null;
  originalSalary = signal<number | null>(null);
  salaryValue = signal<number | null>(null);
  salaryChanged = computed(() => this.salaryValue() !== this.originalSalary());

  userForm: FormGroup = new FormGroup({
    document: new FormControl('', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.pattern(/^\d+$/)(control), (control: AbstractControl) => Validators.maxLength(20)(control)]),
    name: new FormControl('', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)(control), (control: AbstractControl) => Validators.maxLength(100)(control)]),
    email: new FormControl('', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.email(control), (control: AbstractControl) => Validators.maxLength(100)(control)]),
    phone: new FormControl('', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.pattern(/^\d{10}$/)(control)]),
    address: new FormControl('', [(control: AbstractControl) => Validators.maxLength(200)(control)]),
    salary: new FormControl<number | null>(null),
    reason: new FormControl<string | null>(null),
    observations: new FormControl<string | null>(null),
    areaId: new FormControl<number | null>(null, [(control: AbstractControl) => Validators.required(control)]),
  });

  creationModalVisible = false;
  modificationModalVisible = false;

  /** Errors from backend validation (400 errors with field-specific messages) */
  private backendFieldErrors: Record<string, string> = {};

  ngOnInit(): void {
    // Force load on first visit if no data
    if (this.cache.workers.data() === null) {
      this.cache.workers.refresh();
    }

    this.userForm.get('salary')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => { this.salaryValue.set(val as number | null); });
  }

  onVisible(): void {
    this.cache.workers.loadIfStale();
    this.searchForAreas();
  }

  closeModals(): void {
    this.modificationModalVisible = false;
    this.creationModalVisible = false;
  }

  showModificationModal(worker: WorkerResponse): void {
    this.selectedWorker = worker;
    this.editing = true;
    this.backendFieldErrors = {};
    this.fillFormWithData(worker);
    this.originalSalary.set(worker.salary ?? null);
    this.salaryValue.set(worker.salary ?? null);
    this.userForm.patchValue({ reason: null, observations: null });
    this.creationModalVisible = true;
  }

  showCreationModal(): void {
    this.closeModals();
    this.clearForm();
    this.backendFieldErrors = {};
    this.editing = false;
    this.creationModalVisible = true;
  }

  /** Focus first input in modal dialog after it opens */
  focusFirstInput(): void {
    setTimeout(() => this.firstInputRef?.nativeElement.focus());
  }

  createWorker(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario inválido',
        detail: 'Por favor complete todos los campos requeridos.',
        life: 3000,
      });
      return;
    }

    this.backendFieldErrors = {};

    this.workerService.createWorker(this.formToRequest()).subscribe({
      next: () => {
        this.closeModals();
        this.searchForWorkers();
        this.messageService.add({
          severity: 'success',
          summary: 'Operación exitosa',
          detail: 'El trabajador ha sido creado. Se enviará una contraseña al correo.',
          life: 5000,
        });
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.logger.error('Error creating worker:', err);
        const backendMessage = err.error?.message;

        if (err.status === 400 && backendMessage) {
          this.parseBackendValidationErrors(backendMessage);
          const hasFieldErrors = Object.keys(this.backendFieldErrors).length > 0;
          if (hasFieldErrors) {
            this.messageService.add({
              severity: 'error',
              summary: 'Error de validación',
              detail: 'Algunos campos tienen errores. Por favor revise la información.',
              life: 5000,
            });
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: backendMessage,
              life: 5000,
            });
          }
        } else if (err.status === 409) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage ?? 'Ya existe un trabajador con ese documento o correo',
            life: 5000,
          });
        } else if (err.status === 0 || (err.status && err.status >= 500)) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error del servidor',
            detail: backendMessage ?? 'Error del servidor. Intente más tarde.',
            life: 5000,
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage ?? 'Error al crear el trabajador',
            life: 5000,
          });
        }
      },
    });
  }

  updateWorker(): void {
    if (this.userForm.invalid || !this.selectedWorker?.id) {
      this.userForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Formulario inválido',
        detail: 'Por favor complete todos los campos requeridos.',
        life: 3000,
      });
      return;
    }

    this.backendFieldErrors = {};

    const formValue = this.userForm.value as WorkerFormValue;

    if (this.salaryChanged()) {
      if (!formValue.reason || formValue.reason.trim() === '') {
        this.messageService.add({
          severity: 'error',
          summary: 'Error de validación',
          detail: 'La razón es obligatoria cuando se cambia el salario.',
          life: 5000,
        });
        return;
      }
    }

    const updateData: UpdateWorkerRequest = {
      document: formValue.document,
      name: formValue.name,
      email: formValue.email,
      phone: formValue.phone,
      address: formValue.address ?? '',
      areas: formValue.areaId != null ? [formValue.areaId] : [],
    };

    if (this.salaryChanged()) {
      updateData.salary = formValue.salary;
      updateData.reason = formValue.reason;
      updateData.observations = formValue.observations ?? null;
    }

    this.workerService.updateWorker(this.selectedWorker.id, updateData).subscribe({
      next: () => {
        this.closeModals();
        this.searchForWorkers();
        this.messageService.add({
          severity: 'success',
          summary: 'Operación exitosa',
          detail: 'El trabajador ha sido actualizado correctamente.',
          life: 5000,
        });
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.logger.error('Error updating worker:', err);
        const backendMessage = err.error?.message;

        if (err.status === 400 && backendMessage) {
          this.parseBackendValidationErrors(backendMessage);
          const hasFieldErrors = Object.keys(this.backendFieldErrors).length > 0;
          if (hasFieldErrors) {
            this.messageService.add({
              severity: 'error',
              summary: 'Error de validación',
              detail: 'Algunos campos tienen errores. Por favor revise la información.',
              life: 5000,
            });
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: backendMessage,
              life: 5000,
            });
          }
        } else if (err.status === 404) {
          this.messageService.add({
            severity: 'error',
              summary: 'Error',
              detail: 'Trabajador no encontrado.',
              life: 5000,
            });
          } else if (err.status === 409) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage ?? 'Ya existe un trabajador con ese documento o correo',
            life: 5000,
          });
        } else if (err.status === 0 || (err.status && err.status >= 500)) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error del servidor',
            detail: backendMessage ?? 'Error del servidor. Intente más tarde.',
            life: 5000,
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage ?? 'Error al actualizar el trabajador',
            life: 5000,
          });
        }
      },
    });
  }

  deleteWorker(worker: WorkerResponse): void {
    if (!worker.id) return;

    this.confirmationService.confirm({
      message: `¿Está seguro que desea eliminar al trabajador "${worker.name}"? Esta acción no se puede deshacer.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        if (!worker.id) {
          this.logger.error('Cannot delete worker without ID');
          return;
        }
        this.workerService.deleteWorker(worker.id).subscribe({
          next: () => {
            this.searchForWorkers();
            this.messageService.add({
              severity: 'success',
              summary: 'Operación exitosa',
              detail: 'El trabajador ha sido eliminado correctamente.',
              life: 5000,
            });
          },
          error: (err: { status?: number; error?: { message?: string } }) => {
            this.logger.error('Error deleting worker:', err);
            const backendMessage = err.error?.message;

            if (err.status === 404) {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Trabajador no encontrado.',
                life: 5000,
              });
            } else if (err.status === 0 || (err.status && err.status >= 500)) {
              this.messageService.add({
                severity: 'error',
                summary: 'Error del servidor',
                detail: backendMessage ?? 'Error del servidor. Intente más tarde.',
                life: 5000,
              });
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: backendMessage ?? 'Error al eliminar el trabajador',
                life: 5000,
              });
            }
          },
        });
      },
    });
  }

  retrySetupEmail(worker: WorkerResponse): void {
    if (!worker.id) return;

    this.workerService.retrySetupEmail(worker.id).subscribe({
      next: () => {
        this.searchForWorkers();
        this.messageService.add({
          severity: 'success',
          summary: 'Correo enviado',
          detail: 'Se ha reenviado la invitación correctamente.',
          life: 5000,
        });
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.logger.error('Error retrying setup email:', err);
        const backendMessage = err.error?.message;

        if (err.status === 404) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Trabajador no encontrado.',
            life: 5000,
          });
        } else if (err.status === 0 || (err.status && err.status >= 500)) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error del servidor',
            detail: backendMessage ?? 'Error del servidor. Intente más tarde.',
            life: 5000,
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage ?? 'Error al reenviar el correo',
            life: 5000,
          });
        }
      },
    });
  }

  private fillFormWithData(data: WorkerResponse): void {
    this.userForm.patchValue({
      document: data.document,
      name: data.name,
      email: data.email,
      phone: data.phone ?? '',
      address: data.address ?? '',
      areaId: data.assignedAreas?.[0] ?? null,
      salary: data.salary ?? null,
    });
  }

  private clearForm(): void {
    this.userForm.reset();
  }

  private formToRequest(): CreateWorkerRequest {
    const formValue = this.userForm.value as WorkerFormValue;
    return {
      document: formValue.document,
      name: formValue.name,
      email: formValue.email,
      phone: formValue.phone,
      address: formValue.address ?? undefined,
      areas: formValue.areaId != null ? [formValue.areaId] : [],
      salary: formValue.salary ?? undefined,
    };
  }

  private searchForWorkers(): void {
    this.cache.workers.refresh();
  }

  private searchForAreas(): void {
    this.areaService.getAreas().subscribe((res) => {
      this.areas.set(res);
      this.logger.debug('Areas loaded:', this.areas());
    });
  }

  public isValidField(field: string): boolean {
    return !!(this.userForm.get(field)?.valid && this.userForm.get(field)?.touched);
  }

  public getBackendError(field: string): string {
    return this.backendFieldErrors[field] || '';
  }

  private parseBackendValidationErrors(backendMessage: string): void {
    this.backendFieldErrors = {};
    const fieldMarkers = ['document:', 'email:', 'phone:', 'name:', 'address:', 'salary:', 'reason:'];

    const errorTranslations: Record<string, string> = {
      'Phone must be between 10 and 20 characters': 'El teléfono debe tener 10 dígitos',
      'the phone must be a valid phone number': 'El teléfono debe tener 10 dígitos',
      'the document must only have numbers': 'El documento debe contener solo números',
      'Document is required': 'Campo requerido',
      'Name is required': 'Campo requerido',
      'Phone is required': 'Campo requerido',
      'Address is required': 'Campo requerido',
      'Invalid email format': 'Ingrese un correo electrónico válido',
      'Email is required': 'Campo requerido',
      'El nombre solo permite letras y espacios': 'El nombre solo permite letras y espacios',
      'El nombre debe tener máximo 100 caracteres': 'El nombre debe tener máximo 100 caracteres',
      'El documento debe tener máximo 20 caracteres': 'El documento debe tener máximo 20 caracteres',
      'El correo debe tener máximo 100 caracteres': 'El correo debe tener máximo 100 caracteres',
      'La dirección debe tener máximo 200 caracteres': 'La dirección debe tener máximo 200 caracteres',
      'Salary must be a positive value': 'El salario debe ser un valor positivo',
      'Reason is required when salary changes': 'La razón es obligatoria cuando se cambia el salario',
    };

    for (const marker of fieldMarkers) {
      if (backendMessage.includes(marker)) {
        const fieldName = marker.replace(':', '');
        const afterField = backendMessage.split(marker)[1] || '';
        const errorText = afterField.split(';')[0]?.trim() || '';
        if (errorText) {
          const translatedError = errorTranslations[errorText] || errorText;
          this.backendFieldErrors[fieldName] = translatedError;
        }
      }
    }
  }

  // ── Time-log methods ──

  switchTab(tab: 'list' | 'time-logs'): void {
    if (this.activeEmployeeTab() === tab) return;
    this.activeEmployeeTab.set(tab);
    if (tab === 'time-logs') {
      this.loadTimeLogs();
    }
    // Focus the active tab for keyboard/AT users
    setTimeout(() => {
      if (tab === 'list') {
        this.tabEmpleados?.nativeElement.focus();
      } else {
        this.tabTimeLogs?.nativeElement.focus();
      }
    });
  }

  loadTimeLogs(): void {
    this.timeLogLoading.set(true);
    this.timeLogError.set(null);

    const params: TimeLogFilterParams = {};
    if (this.filterWorkerId() !== undefined) {
      params.workerId = this.filterWorkerId();
    }
    const fromDate = this.filterFrom();
    if (fromDate) {
      params.from = fromDate.toISOString();
    }
    const toDate = this.filterTo();
    if (toDate) {
      params.to = toDate.toISOString();
    }

    this.timeLogService.getTimeLogs(params).subscribe({
      next: (data) => {
        this.timeLogs.set(data);
        this.timeLogLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load time logs', err);
        if (err.status === 403) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Acción no disponible fuera de turno' });
        } else if (err.status === 404) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se encontraron registros' });
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar los registros de ingreso' });
        }
        this.timeLogError.set('Error al cargar los registros de ingreso');
        this.timeLogLoading.set(false);
      },
    });
  }

  clearFilters(): void {
    this.filterWorkerId.set(undefined);
    this.filterFrom.set(undefined);
    this.filterTo.set(undefined);
    this.loadTimeLogs();
  }

  formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Schedule assignment methods ──

  openScheduleDialog(worker: WorkerResponse): void {
    if (!worker.id) return;
    const workerId = worker.id;
    this.selectedWorkerForSchedule.set(worker);
    this.scheduleDialogVisible.set(true);
    this.scheduleDialogLoading.set(true);
    this.workerAssignedScheduleIds.set([]);
    this.allSchedules.set([]);

    this.scheduleService.getAll().subscribe({
      next: (schedules) => {
        this.allSchedules.set(schedules);
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load schedules', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar horarios' });
      },
    });

    this.scheduleAssignmentService.getAssignments(workerId).subscribe({
      next: (scheduleIds) => {
        this.workerAssignedScheduleIds.set(scheduleIds);
        this.userAssignedSchedules.update(map => {
          const newMap = new Map(map);
          newMap.set(workerId, scheduleIds);
          return newMap;
        });
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to load assignments', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar asignaciones' });
      },
      complete: () => {
        this.scheduleDialogLoading.set(false);
      },
    });
  }

  closeScheduleDialog(): void {
    this.scheduleDialogVisible.set(false);
  }

  assignSchedule(scheduleId: number): void {
    const worker = this.selectedWorkerForSchedule();
    if (!worker?.id) return;
    const workerId = worker.id;

    this.assigningScheduleIds.update(s => new Set(s).add(scheduleId));

    this.scheduleAssignmentService.assign(workerId, scheduleId).subscribe({
      next: () => {
        this.workerAssignedScheduleIds.update(ids => [...ids, scheduleId]);
        this.userAssignedSchedules.update(map => {
          const newMap = new Map(map);
          const current = newMap.get(workerId) ?? [];
          newMap.set(workerId, [...current, scheduleId]);
          return newMap;
        });
        this.messageService.add({ severity: 'success', summary: 'Asignado', detail: 'Horario asignado correctamente' });
        this.assigningScheduleIds.update(s => { const n = new Set(s); n.delete(scheduleId); return n; });
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 409) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'El horario se solapa con turnos existentes del trabajador' });
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al asignar horario' });
        }
        this.assigningScheduleIds.update(s => { const n = new Set(s); n.delete(scheduleId); return n; });
      },
    });
  }

  unassignSchedule(scheduleId: number): void {
    const worker = this.selectedWorkerForSchedule();
    if (!worker?.id) return;
    const workerId = worker.id;

    this.assigningScheduleIds.update(s => new Set(s).add(scheduleId));

    this.scheduleAssignmentService.removeAssignment(workerId, scheduleId).subscribe({
      next: () => {
        this.workerAssignedScheduleIds.update(ids => ids.filter(id => id !== scheduleId));
        this.userAssignedSchedules.update(map => {
          const newMap = new Map(map);
          const current = newMap.get(workerId) ?? [];
          newMap.set(workerId, current.filter(id => id !== scheduleId));
          return newMap;
        });
        this.messageService.add({ severity: 'success', summary: 'Desasignado', detail: 'Horario desasignado correctamente' });
        this.assigningScheduleIds.update(s => { const n = new Set(s); n.delete(scheduleId); return n; });
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Failed to remove assignment', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al desasignar horario' });
        this.assigningScheduleIds.update(s => { const n = new Set(s); n.delete(scheduleId); return n; });
      },
    });
  }

  isScheduleAssigned(scheduleId: number): boolean {
    return this.workerAssignedScheduleIds().includes(scheduleId);
  }

  isScheduleAssigning(scheduleId: number): boolean {
    return this.assigningScheduleIds().has(scheduleId);
  }

  getAssignedScheduleCount(userId: number): string {
    const count = this.userAssignedSchedules().get(userId)?.length;
    return count !== undefined ? String(count) : '-';
  }

  getScheduleCount(userId: number): number {
    return this.userAssignedSchedules().get(userId)?.length ?? 0;
  }

  hasScheduleData(userId: number): boolean {
    return this.userAssignedSchedules().has(userId);
  }
}
