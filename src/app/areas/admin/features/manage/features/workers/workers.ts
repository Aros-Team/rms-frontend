import { NgClass } from '@angular/common';
import { Component, OnInit, inject, computed, effect, DestroyRef, signal, ViewChild, ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { WorkerResponse } from '@app/shared/models/dto/workers/worker-response';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Worker } from '@app/core/services/workers/worker';
import { WorkerImage } from '@app/core/services/worker-image/worker-image';
import { CreateWorkerRequest } from '@app/shared/models/dto/workers/create-worker-request';
import { MessageService, ConfirmationService } from 'primeng/api';
import { fieldError as resolveFieldError } from '@app/shared/lib/form-error';
import { Logging } from '@app/core/services/logging/logging';
import { UpdateWorkerRequest } from '@app/shared/models/dto/workers/worker-response';
import { tryToAmount } from '@app/shared/models/dto/common/money';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { WorkersCache } from './workers-cache';
import { LazyLoad } from '@app/core/directives/lazy-load/lazy-load.directive';
import { AreaResponse } from '@app/shared/models/dto/areas/area';
import { Area } from '@app/core/services/areas/area';
import { TableSkeleton } from '@shared/skeletons/table-skeleton/table-skeleton';
import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsField } from '@app/shared/ui/field/field';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsSelect, type RmsSelectOption } from '@app/shared/ui/select/select';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import { WorkerCard } from './worker-card';
import { PayrollPanel } from './payroll-panel/payroll-panel';
import { SearchInput as SearchInputComponent } from '@app/shared/components/search-input/search-input';
import { TimeLog, TimeLogFilterParams } from '@app/core/services/schedules/time-log';
import { TimeLogEntry } from '@app/shared/models/dto/schedules/time-log-entry';
import { Schedule } from '@app/core/services/schedules/schedule';
import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Schedule as ScheduleModel } from '@app/shared/models/dto/schedules/schedule';

interface WorkerFormValue {
  document: string;
  name: string;
  email: string;
  phone: string;
  address: string | null,
  jobTitle: string | null,
  areaId: number | null,
  salary: number | null,
  reason: string | null,
  observations: string | null,
}

@Component({
  selector: 'app-workers',
  imports: [
    NgClass,
    RouterModule,
    FormsModule,
    TableModule,
    DialogModule,
    IftaLabelModule,
    ReactiveFormsModule,
    InputIconModule,
    IconFieldModule,
    SelectModule,
    InputNumberModule,
    TooltipModule,
    SkeletonModule,
    ConfirmDialogModule,
    DatePickerModule,
    LazyLoad,
    TableSkeleton,
    RmsBadge,
    RmsButton,
    RmsEmptyState,
    RmsField,
    RmsInput,
    RmsSelect,
    RmsPageHeader,
    RmsStatusPill,
    WorkerCard,
    PayrollPanel,
    SearchInputComponent,
  ],
  templateUrl: './workers.html',
})
export class Workers implements OnInit {
  private workerService = inject(Worker);
  private workerImageService = inject(WorkerImage);
  private areaService = inject(Area);
  private messageService = inject(MessageService);
  private logger = inject(Logging);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);
  readonly cache = inject(WorkersCache);
  private timeLogService = inject(TimeLog);
  private scheduleService = inject(Schedule);
  private scheduleAssignmentService = inject(ScheduleAssignment);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Template refs for focus management
  @ViewChild('tabEmpleados') tabEmpleados?: ElementRef<HTMLButtonElement>;
  @ViewChild('tabTimeLogs') tabTimeLogs?: ElementRef<HTMLButtonElement>;
  @ViewChild('tabPayroll') tabPayroll?: ElementRef<HTMLButtonElement>;
  @ViewChild('firstInputRef') firstInputRef?: ElementRef<HTMLElement>;

  // Tab navigation
  activeEmployeeTab = signal<'list' | 'time-logs' | 'payroll'>('list');

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
  workers = computed(() => {
    const all = this.cache.workers.data() ?? [];
    const term = this.workerSearch().toLowerCase().trim();
    if (!term) {
      return all;
    }
    return all.filter(
      (worker) =>
        worker.name.toLowerCase().includes(term) ||
        worker.document.toLowerCase().includes(term) ||
        worker.email.toLowerCase().includes(term),
    );
  });

  /** Text pushed by the assistant deep link (`?search=`). */
  readonly workerSearch = signal('');
  areas = signal<AreaResponse[]>([]);
  readonly areaOptions = computed<RmsSelectOption[]>(() =>
    this.areas().map((area) => ({ label: area.name.toLowerCase(), value: area.id })),
  );
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
    jobTitle: new FormControl<string | null>('', [(control: AbstractControl) => Validators.maxLength(100)(control)]),
    salary: new FormControl<number | null>(null),
    reason: new FormControl<string | null>(null),
    observations: new FormControl<string | null>(null),
    areaId: new FormControl<number | null>(null, [(control: AbstractControl) => Validators.required(control)]),
  });

  creationModalVisible = false;
  modificationModalVisible = false;

  /** Worker portrait staged in the create/edit dialog. */
  readonly imagePreview = signal<string | null>(null);
  readonly pendingImageFile = signal<File | null>(null);
  readonly removeExistingImage = signal(false);
  readonly imageBusy = signal(false);
  readonly imageError = signal<string | null>(null);
  private currentImageId: number | null = null;
  private existingImageUrl: string | null = null;
  private previewObjectUrl: string | null = null;
  private readonly maxImageBytes = 5 * 1024 * 1024;
  private readonly loadedScheduleAssignments = new Set<number>();
  private schedulesRequested = false;

  constructor() {
    // Keep the card counts and summaries in sync with the worker list without opening
    // the assignment dialog for every employee.
    effect(() => {
      const workers = this.cache.workers.data();
      if (workers !== null) {
        this.loadAssignmentsFor(workers);
      }
    });
  }

  /** Errors from backend validation (400 errors with field-specific messages) */
  private backendFieldErrors: Record<string, string> = {};

  ngOnInit(): void {
    // Force load on first visit if no data
    if (this.cache.workers.data() === null) {
      this.cache.workers.refresh();
    }

    // Deep link from the assistant: `?search=` filters the list and `?tab=`
    // opens employees, time logs or payroll directly.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.workerSearch.set((params.get('search') ?? '').trim());
        const tab = params.get('tab');
        if (tab === 'list' || tab === 'time-logs' || tab === 'payroll') {
          this.switchTab(tab);
        }
      });

    this.userForm.get('salary')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => { this.salaryValue.set(val as number | null); });
  }

  onVisible(): void {
    this.cache.workers.loadIfStale();
    this.searchForAreas();
    this.loadSchedules();
  }

  closeModals(): void {
    this.modificationModalVisible = false;
    this.creationModalVisible = false;
    this.resetImageState();
  }

  showModificationModal(worker: WorkerResponse): void {
    this.selectedWorker = worker;
    this.editing = true;
    this.backendFieldErrors = {};
    this.fillFormWithData(worker);
    // `salary` is a `Money` DTO on the wire; the form/request work with numbers.
    const salary = tryToAmount(worker.salary);
    this.originalSalary.set(salary);
    this.salaryValue.set(salary);
    this.userForm.patchValue({ reason: null, observations: null });
    this.creationModalVisible = true;
    this.resetImageState();
    this.existingImageUrl = worker.imageUrl ?? null;
    this.imagePreview.set(this.existingImageUrl);
    if (worker.id != null) {
      this.loadWorkerImage(worker.id);
    }
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
    setTimeout(() => this.firstInputRef?.nativeElement.querySelector('input')?.focus());
  }

  /** Two-letter monogram shown while the worker has no portrait. */
  imageInitials(): string {
    const name = (this.userForm.get('name')?.value as string | undefined) ?? '';
    const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
    if (parts.length === 0) {
      return '?';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Stages the chosen file and shows a local preview until the worker is saved. */
  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    this.imageError.set(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.imageError.set('Formato no permitido. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > this.maxImageBytes) {
      this.imageError.set('La imagen supera los 5 MB.');
      return;
    }
    this.revokePreviewUrl();
    const objectUrl = URL.createObjectURL(file);
    this.previewObjectUrl = objectUrl;
    this.pendingImageFile.set(file);
    this.removeExistingImage.set(false);
    this.imagePreview.set(objectUrl);
  }

  /** Removes the staged portrait, or marks the saved one for deletion. */
  removeWorkerImage(): void {
    this.imageError.set(null);
    if (this.pendingImageFile() !== null) {
      this.revokePreviewUrl();
      this.pendingImageFile.set(null);
      this.imagePreview.set(this.removeExistingImage() ? null : this.existingImageUrl);
      return;
    }
    if (this.currentImageId !== null) {
      this.removeExistingImage.set(true);
      this.imagePreview.set(null);
    }
  }

  private loadWorkerImage(workerId: number): void {
    this.workerImageService.getImages(workerId).subscribe({
      next: (images) => {
        // A portrait chosen while the request was in flight wins.
        if (this.pendingImageFile() !== null) {
          return;
        }
        if (images.length === 0) {
          return;
        }
        const first = images[0];
        this.currentImageId = first.id;
        const url = first.tabletUrl || first.mobileUrl;
        this.existingImageUrl = url;
        if (!this.removeExistingImage()) {
          this.imagePreview.set(url);
        }
      },
      error: () => {
        // The worker still opens; the stored `imageUrl` keeps the current preview.
      },
    });
  }

  /**
   * Persists the staged portrait after the worker itself was created/updated.
   * A failed upload never loses the worker: it only shows a warning.
   */
  private saveWorkerImage(workerId: number, editing: boolean, done: () => void): void {
    const file = this.pendingImageFile();
    if (file !== null) {
      this.imageBusy.set(true);
      const request: Observable<unknown> = editing
        ? this.workerImageService.replaceImage(workerId, file)
        : this.workerImageService.uploadImage(workerId, file);
      request.subscribe({
        next: () => {
          this.imageBusy.set(false);
          done();
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Error saving worker image:', err);
          this.imageBusy.set(false);
          this.messageService.add({
            severity: 'warn',
            summary: 'Trabajador guardado',
            detail: 'La foto no se pudo guardar. Puedes intentarlo de nuevo desde la edición.',
            life: 6000,
          });
          done();
        },
      });
      return;
    }

    const imageId = this.currentImageId;
    if (this.removeExistingImage() && imageId !== null) {
      this.imageBusy.set(true);
      this.workerImageService.deleteImage(imageId).subscribe({
        next: () => {
          this.imageBusy.set(false);
          done();
        },
        error: (err: HttpErrorResponse) => {
          this.logger.error('Error deleting worker image:', err);
          this.imageBusy.set(false);
          this.messageService.add({
            severity: 'warn',
            summary: 'Trabajador guardado',
            detail: 'La foto no se pudo quitar.',
            life: 6000,
          });
          done();
        },
      });
      return;
    }

    done();
  }

  private resetImageState(): void {
    this.revokePreviewUrl();
    this.pendingImageFile.set(null);
    this.removeExistingImage.set(false);
    this.imagePreview.set(null);
    this.imageError.set(null);
    this.imageBusy.set(false);
    this.currentImageId = null;
    this.existingImageUrl = null;
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl !== null) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
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
      next: (created) => {
        this.saveWorkerImage(created.id, false, () => {
          this.closeModals();
          this.searchForWorkers();
          this.messageService.add({
            severity: 'success',
            summary: 'Operación exitosa',
            detail: 'El trabajador ha sido creado. Se enviará una contraseña al correo.',
            life: 5000,
          });
        });
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Error creating worker:', err);
        // RFC 7807: the API reports the reason in `detail`, never in `message`.
        const backendMessage = extractProblemDetail(err);

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
    const workerId = this.selectedWorker.id;

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
      jobTitle: formValue.jobTitle?.trim() ? formValue.jobTitle.trim() : null,
    };

    if (this.salaryChanged()) {
      updateData.salary = formValue.salary;
      updateData.reason = formValue.reason;
      updateData.observations = formValue.observations ?? null;
    }

    this.workerService.updateWorker(this.selectedWorker.id, updateData).subscribe({
      next: () => {
        this.saveWorkerImage(workerId, true, () => {
          this.closeModals();
          this.searchForWorkers();
          this.messageService.add({
            severity: 'success',
            summary: 'Operación exitosa',
            detail: 'El trabajador ha sido actualizado correctamente.',
            life: 5000,
          });
        });
      },
      error: (err: HttpErrorResponse) => {
        this.logger.error('Error updating worker:', err);
        const backendMessage = extractProblemDetail(err);

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
      acceptButtonProps: { severity: 'danger' },
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
          error: (err: HttpErrorResponse) => {
            this.logger.error('Error deleting worker:', err);
            const backendMessage = extractProblemDetail(err);

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
      error: (err: HttpErrorResponse) => {
        this.logger.error('Error retrying setup email:', err);
        const backendMessage = extractProblemDetail(err);

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
      jobTitle: data.jobTitle ?? '',
      areaId: data.assignedAreas?.[0] ?? null,
      salary: tryToAmount(data.salary),
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
      jobTitle: formValue.jobTitle?.trim() ? formValue.jobTitle.trim() : null,
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

  private loadSchedules(): void {
    if (this.schedulesRequested) return;
    this.schedulesRequested = true;
    this.scheduleService.getAll().subscribe({
      next: (schedules) => {
        this.allSchedules.set(schedules);
      },
      error: (err: HttpErrorResponse) => {
        this.schedulesRequested = false;
        this.logger.error('Failed to load schedules', err);
      },
    });
  }

  /** Loads the assignments of every listed worker once, so the cards can show them. */
  private loadAssignmentsFor(workers: readonly WorkerResponse[]): void {
    for (const worker of workers) {
      const workerId = worker.id;
      if (workerId === undefined || this.loadedScheduleAssignments.has(workerId)) continue;
      this.loadedScheduleAssignments.add(workerId);
      this.scheduleAssignmentService.getAssignments(workerId).subscribe({
        next: (scheduleIds) => {
          this.userAssignedSchedules.update((map) => {
            const next = new Map(map);
            next.set(workerId, scheduleIds);
            return next;
          });
        },
        error: (err: HttpErrorResponse) => {
          this.loadedScheduleAssignments.delete(workerId);
          this.logger.error('Failed to load schedule assignments', err);
        },
      });
    }
  }

  /** Schedules currently assigned to the worker, for the card summary. */
  schedulesForWorker(workerId: number): readonly ScheduleModel[] {
    const ids = this.userAssignedSchedules().get(workerId) ?? [];
    if (ids.length === 0) return [];
    const catalog = this.allSchedules();
    return ids
      .map((id) => catalog.find((schedule) => schedule.id === id))
      .filter((schedule): schedule is ScheduleModel => schedule !== undefined);
  }

  public isValidField(field: string): boolean {
    return !!(this.userForm.get(field)?.valid && this.userForm.get(field)?.touched);
  }

  public getBackendError(field: string): string {
    return this.backendFieldErrors[field] || '';
  }

  fieldError(field: string): string {
    return resolveFieldError(this.userForm, field, this.getBackendError(field));
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

  switchTab(tab: 'list' | 'time-logs' | 'payroll'): void {
    if (this.activeEmployeeTab() === tab) return;
    this.activeEmployeeTab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (tab === 'time-logs') {
      this.loadTimeLogs();
    }
    // `payroll` needs no call here: the panel is mounted by `@if` on first
    // activation and loads its three caches in its own constructor.
    // Focus the active tab for keyboard/AT users
    setTimeout(() => {
      if (tab === 'list') {
        this.tabEmpleados?.nativeElement.focus();
      } else if (tab === 'time-logs') {
        this.tabTimeLogs?.nativeElement.focus();
      } else {
        this.tabPayroll?.nativeElement.focus();
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
    this.loadSchedules();

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
      next: (result) => {
        this.workerAssignedScheduleIds.update(ids => [...ids, scheduleId]);
        this.userAssignedSchedules.update(map => {
          const newMap = new Map(map);
          const current = newMap.get(workerId) ?? [];
          newMap.set(workerId, [...current, scheduleId]);
          return newMap;
        });
        const detail =
          result.warning ?? 'Horario asignado correctamente';
        this.messageService.add({
          severity: result.warning === null ? 'success' : 'warn',
          summary: result.warning === null ? 'Asignado' : 'Asignado con aviso',
          detail,
        });
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
}
