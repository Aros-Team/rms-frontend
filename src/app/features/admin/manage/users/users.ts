import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { MultiSelectModule } from 'primeng/multiselect';
import { UserResponse } from '@app/shared/models/dto/users/user-response.model';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '@app/core/services/users/user-service';
import { CreateUserRequest } from '@app/shared/models/dto/users/create-user-request.model';
import { MessageService } from 'primeng/api';
import { FormValidation } from '@app/shared/components/form/form-validation';
import { LoggingService } from '@app/core/services/logging/logging-service';

@Component({
  selector: 'app-users',
  imports: [
    CommonModule,
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
    FormValidation,
  ],
  templateUrl: './users.html',
  styles: ``,
})
export class Users implements OnInit {
  title = 'Administracion de usuarios';
  description = 'Gestión completa de todos los usuarios/empleados del restaurante';

  users: UserResponse[] = [];
  /**
   * the form is on editing mode?
   */
  editing = false;

  userForm: FormGroup = new FormGroup({
    document: new FormControl('', [Validators.required, Validators.pattern('^\\d+$')]),
    name: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    phone: new FormControl('', [Validators.pattern('^\\d{7,10}$')]),
    address: new FormControl('', []),
  });

  creationModalVisible = false;
  modificationModalVisible = false;

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private loggingService: LoggingService
  ) {
    //
  }

  ngOnInit(): void {
    this.searchForUsers();
  }

  closeModals() {
    this.modificationModalVisible = false;
    this.creationModalVisible = false;
  }

  showModificationModal(data: UserResponse) {
    this.loggingService.debug('Edición de usuarios aún no disponible');
    this.messageService.add({
      severity: 'info',
      summary: 'Próximamente',
      detail: 'La funcionalidad de edición estará disponible pronto.',
      life: 3000,
    });
  }

  showCreationModal() {
    this.closeModals();
    this.clearForm();
    this.editing = false;
    this.creationModalVisible = true;
  }

  createUser() {
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
      error: (err) => {
        console.error('Error creating user:', err);
        let errorMessage = 'Error al crear el usuario';
        
        if (err.status === 409) {
          errorMessage = 'Ya existe un usuario con ese documento o correo';
        } else if (err.status === 0 || (err.status && err.status >= 500)) {
          errorMessage = 'Error del servidor. Intente más tarde.';
        }
        
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
          life: 5000,
        });
      }
    });
  }
  
  updateUser() {
    this.loggingService.debug('Actualización de usuarios aún no disponible');
    this.messageService.add({
      severity: 'info',
      summary: 'Próximamente',
      detail: 'La funcionalidad de edición estará disponible pronto.',
      life: 3000,
    });
  }

  deleteUser(document: string) {
    this.loggingService.debug('Eliminación de usuarios aún no disponible');
    this.messageService.add({
      severity: 'info',
      summary: 'Próximamente',
      detail: 'La funcionalidad de eliminación estará disponible pronto.',
      life: 3000,
    });
  }

  private fillFormWithData(data: UserResponse): void {
    this.userForm.setValue({ ...data, areas: data.assignedAreas || [], password: '' });
    this.loggingService.debug("areas => ");
    this.loggingService.debug(this.userForm.get('areas')?.value);
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
      this.users = res;
      this.loggingService.debug('Users loaded:', this.users);
    });
  }

  public isValidField(field: string) {
    return this.userForm.get(field)?.valid && this.userForm.get(field)?.touched;
  }
}
