import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RouterModule } from '@angular/router';
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
import { UserResponse } from '@app/shared/models/dto/users/user-response.model';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '@app/core/services/users/user';
import { CreateUserRequest } from '@app/shared/models/dto/users/create-user-request.model';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FormValidation } from '@app/shared/components/form/form-validation';
import { Logging } from '@app/core/services/logging/logging';
import { UpdateUserRequest } from '@app/shared/models/dto/users/user-response.model';
import { UsersCacheService } from './users-cache.service';
import { LazyLoadDirective } from '@app/core/directives/lazy-load.directive';
import { AreaResponse } from '@app/shared/models/dto/areas/area.model';
import { Area } from '@app/core/services/areas/area';
import { signal } from '@angular/core';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';

interface UserFormValue {
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
  selector: 'app-users',
  imports: [
    RouterModule,
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
    FormValidation,
    LazyLoadDirective,
    TableSkeleton,
    CurrencyPipe,
  ],
  templateUrl: './users.html',
  styles: ``,
})
export class Users implements OnInit {
  private userService = inject(User);
  private areaService = inject(Area);
  private messageService = inject(MessageService);
  private logger = inject(Logging);
  private confirmationService = inject(ConfirmationService);
  private destroyRef = inject(DestroyRef);
  readonly cache = inject(UsersCacheService);

  title = 'Administracion de usuarios';
  description = 'Gestión completa de todos los usuarios/empleados del restaurante';

  users = computed(() => this.cache.users.data() ?? []);
  areas = signal<AreaResponse[]>([]);
  editing = false;
  selectedUser: UserResponse | null = null;
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
    if (this.cache.users.data() === null) {
      this.cache.users.refresh();
    }

    this.userForm.get('salary')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => { this.salaryValue.set(val as number | null); });
  }

  onVisible(): void {
    this.cache.users.loadIfStale();
    this.searchForAreas();
  }

  closeModals(): void {
    this.modificationModalVisible = false;
    this.creationModalVisible = false;
  }

  showModificationModal(user: UserResponse): void {
    this.selectedUser = user;
    this.editing = true;
    this.backendFieldErrors = {};
    this.fillFormWithData(user);
    this.originalSalary.set(user.salary ?? null);
    this.salaryValue.set(user.salary ?? null);
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

  createUser(): void {
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

    this.userService.createUser(this.formToRequest()).subscribe({
      next: () => {
        this.closeModals();
        this.searchForUsers();
        this.messageService.add({
          severity: 'success',
          summary: 'Operación exitosa',
          detail: 'El usuario ha sido creado. Se enviará una contraseña al correo.',
          life: 5000,
        });
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.logger.error('Error creating user:', err);
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
            detail: backendMessage ?? 'Ya existe un usuario con ese documento o correo',
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
            detail: backendMessage ?? 'Error al crear el usuario',
            life: 5000,
          });
        }
      },
    });
  }

  updateUser(): void {
    if (this.userForm.invalid || !this.selectedUser?.id) {
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

    const formValue = this.userForm.value as UserFormValue;

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

    const updateData: UpdateUserRequest = {
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

    this.userService.updateUser(this.selectedUser.id, updateData).subscribe({
      next: () => {
        this.closeModals();
        this.searchForUsers();
        this.messageService.add({
          severity: 'success',
          summary: 'Operación exitosa',
          detail: 'El usuario ha sido actualizado correctamente.',
          life: 5000,
        });
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.logger.error('Error updating user:', err);
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
            detail: 'Usuario no encontrado.',
            life: 5000,
          });
        } else if (err.status === 409) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage ?? 'Ya existe un usuario con ese documento o correo',
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
            detail: backendMessage ?? 'Error al actualizar el usuario',
            life: 5000,
          });
        }
      },
    });
  }

  deleteUser(user: UserResponse): void {
    if (!user.id) return;

    this.confirmationService.confirm({
      message: `¿Está seguro que desea eliminar al usuario "${user.name}"? Esta acción no se puede deshacer.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        if (!user.id) {
          this.logger.error('Cannot delete user without ID');
          return;
        }
        this.userService.deleteUser(user.id).subscribe({
          next: () => {
            this.searchForUsers();
            this.messageService.add({
              severity: 'success',
              summary: 'Operación exitosa',
              detail: 'El usuario ha sido eliminado correctamente.',
              life: 5000,
            });
          },
          error: (err: { status?: number; error?: { message?: string } }) => {
            this.logger.error('Error deleting user:', err);
            const backendMessage = err.error?.message;

            if (err.status === 404) {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Usuario no encontrado.',
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
                detail: backendMessage ?? 'Error al eliminar el usuario',
                life: 5000,
              });
            }
          },
        });
      },
    });
  }

  retryEmail(user: UserResponse): void {
    if (!user.id) return;

    this.userService.retryEmail(user.id).subscribe({
      next: () => {
        this.searchForUsers();
        this.messageService.add({
          severity: 'success',
          summary: 'Email enviado',
          detail: 'Se ha reenviado la invitación correctamente.',
          life: 5000,
        });
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.logger.error('Error retrying email:', err);
        const backendMessage = err.error?.message;

        if (err.status === 404) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Usuario no encontrado.',
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

  private fillFormWithData(data: UserResponse): void {
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

  private formToRequest(): CreateUserRequest {
    const formValue = this.userForm.value as UserFormValue;
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

  private searchForUsers(): void {
    this.cache.users.refresh();
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
}
