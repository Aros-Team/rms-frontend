import { Component, OnInit, inject, signal } from '@angular/core';

import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { UserResponse } from '@app/shared/models/dto/users/user-response.model';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '@app/core/services/users/user-service';
import { CreateUserRequest } from '@app/shared/models/dto/users/create-user-request.model';
import { MessageService, ConfirmationService } from 'primeng/api';
import { FormValidation } from '@app/shared/components/form/form-validation';
import { LoggingService } from '@app/core/services/logging/logging-service';
import { UpdateUserRequest } from '@app/shared/models/dto/users/user-response.model';

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
    MultiSelectModule,
    TagModule,
    ConfirmDialogModule,
    FormValidation,
  ],
  templateUrl: './users.html',
  styles: ``,
})
export class Users implements OnInit {
  private userService = inject(UserService);
  private messageService = inject(MessageService);
  private loggingService = inject(LoggingService);
  private confirmationService = inject(ConfirmationService);

  title = 'Administracion de usuarios';
  description = 'Gestión completa de todos los usuarios/empleados del restaurante';

  users = signal<UserResponse[]>([]);
  editing = false;
  selectedUser: UserResponse | null = null;

  userForm: FormGroup = new FormGroup({
    document: new FormControl('', [Validators.required, Validators.pattern('^\\d+$')]),
    name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    phone: new FormControl('', [Validators.required, Validators.pattern('^\\d{10}$')]),
    address: new FormControl('', []),
  });

  creationModalVisible = false;
  modificationModalVisible = false;

  /** Errors from backend validation (400 errors with field-specific messages) */
  private backendFieldErrors: Record<string, string> = {};

  ngOnInit(): void {
    this.searchForUsers();
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
        this.loggingService.error('Error creating user:', err);
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
            detail: backendMessage || 'Ya existe un usuario con ese documento o correo',
            life: 5000,
          });
        } else if (err.status === 0 || (err.status && err.status >= 500)) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error del servidor',
            detail: backendMessage || 'Error del servidor. Intente más tarde.',
            life: 5000,
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage || 'Error al crear el usuario',
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

    const updateData: UpdateUserRequest = {
      document: this.userForm.get('document')?.value,
      name: this.userForm.get('name')?.value,
      email: this.userForm.get('email')?.value,
      phone: this.userForm.get('phone')?.value,
      address: this.userForm.get('address')?.value,
    };

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
        this.loggingService.error('Error updating user:', err);
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
            detail: backendMessage || 'Ya existe un usuario con ese documento o correo',
            life: 5000,
          });
        } else if (err.status === 0 || (err.status && err.status >= 500)) {
          this.messageService.add({
            severity: 'error',
            summary: 'Error del servidor',
            detail: backendMessage || 'Error del servidor. Intente más tarde.',
            life: 5000,
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage || 'Error al actualizar el usuario',
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
        this.userService.deleteUser(user.id!).subscribe({
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
            this.loggingService.error('Error deleting user:', err);
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
                detail: backendMessage || 'Error del servidor. Intente más tarde.',
                life: 5000,
              });
            } else {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: backendMessage || 'Error al eliminar el usuario',
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
        this.loggingService.error('Error retrying email:', err);
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
            detail: backendMessage || 'Error del servidor. Intente más tarde.',
            life: 5000,
          });
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: backendMessage || 'Error al reenviar el correo',
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
    });
  }

  private clearForm(): void {
    this.userForm.reset();
  }

  private formToRequest(): CreateUserRequest {
    return {
      document: this.userForm.get('document')?.value,
      name: this.userForm.get('name')?.value,
      email: this.userForm.get('email')?.value,
      phone: this.userForm.get('phone')?.value,
      address: this.userForm.get('address')?.value,
    };
  }

  private searchForUsers(): void {
    this.userService.getUsers().subscribe((res) => {
      this.users.set(res);
      this.loggingService.debug('Users loaded:', this.users());
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
    const fieldMarkers = ['document:', 'email:', 'phone:', 'name:', 'address:'];

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
