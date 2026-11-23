import { Component, inject, signal, OnInit, ChangeDetectionStrategy, computed } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { SetupAccount as SetupAccountService } from '@services/auth/setup-account';
import { SetupAccountResponse } from '@models/dto/auth/setup-account-response';
import { SetupPasswordRequest } from '@models/dto/auth/setup-password-request';
import { MessageService } from 'primeng/api';
import { Logging } from '@app/core/services/logging/logging';
import { NgClass } from '@angular/common';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { RmsButton } from '@shared/ui/button/button';
import { RmsInput } from '@shared/ui/input/input';
import {
  hasLowerCase,
  hasMinPasswordLength,
  hasNumber,
  hasSymbol,
  hasUpperCase,
  isPasswordValid,
} from '@app/shared/lib/password-policy/password-policy';

@Component({
  selector: 'app-setup-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PasswordModule,
    NgClass,
    RmsButton,
    RmsInput,
  ],
  templateUrl: './setup-account.html',
  styleUrl: './setup-account.css',
})
export class SetupAccount implements OnInit {
  private setupAccountService = inject(SetupAccountService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private logger = inject(Logging);

  loading = signal(true);
  error = signal<string | null>(null);
  /** Server's RFC-7807 `detail`, when the failure carried one. */
  serverDetail = signal<string | null>(null);
  success = signal(false);
  userData = signal<SetupAccountResponse | null>(null);
  currentStep = signal(1);

  passwordForm: FormGroup = new FormGroup({
    newPassword: new FormControl<string>('', [(control) => Validators.required(control)]),
    confirmPassword: new FormControl<string>('', [(control) => Validators.required(control)]),
  });

  adminStep1Form: FormGroup = new FormGroup({
    name: new FormControl<string>('', [(control) => Validators.required(control), (control) => Validators.minLength(2)(control)]),
    document: new FormControl<string>('', [(control) => Validators.required(control), (control) => Validators.minLength(5)(control)]),
  });

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.error.set('missing_token');
      this.loading.set(false);
      return;
    }
    this.validateToken();
  }

  private validateToken(): void {
    this.setupAccountService.validateToken(this.token).subscribe({
      next: (data) => {
        this.userData.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.serverDetail.set(extractProblemDetail(err));
        if (err.status === 409) {
          this.error.set('already_used');
        } else {
          this.error.set('invalid');
        }
      },
    });
  }

  isAdmin = computed(() => this.userData()?.role === 'ADMIN');

  goToStep2(): void {
    if (this.adminStep1Form.valid) {
      this.currentStep.set(2);
    } else {
      this.adminStep1Form.markAllAsTouched();
    }
  }

  goToStep1(): void {
    this.currentStep.set(1);
  }

  onSubmitPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const passwordControl = this.passwordForm.get('newPassword');
    const confirmPasswordControl = this.passwordForm.get('confirmPassword');
    const password = String(passwordControl?.value ?? '');
    const confirmPassword = String(confirmPasswordControl?.value ?? '');

    if (password !== confirmPassword) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Las contraseñas no coinciden',
        life: 5000,
      });
      return;
    }

    if (!this.validatePasswordStrength(password)) {
      return;
    }

    const data: SetupPasswordRequest = {
      token: this.token,
      newPassword: password,
    };

    if (this.isAdmin()) {
      const nameControl = this.adminStep1Form.get('name');
      const documentControl = this.adminStep1Form.get('document');
      data.name = String(nameControl?.value ?? '');
      data.document = String(documentControl?.value ?? '');
    }

    this.loading.set(true);
    this.setupAccountService.setupPassword(data).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => {
          void this.router.navigate(['/login'], { queryParams: { accountActivated: 'true' } });
        }, 2000);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const problemDetail = extractProblemDetail(err);
        this.serverDetail.set(problemDetail);
        if (err.status === 409) {
          this.error.set('already_used');
        } else if (err.status === 400 || err.status === 422) {
          this.error.set('invalid');
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: problemDetail ?? 'No se pudo activar la cuenta. Intente más tarde.',
            life: 5000,
          });
        }
      },
    });
  }

  private validatePasswordStrength(password: string): boolean {
    if (!isPasswordValid(password)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Contraseña débil',
        detail: 'La contraseña no cumple con los requisitos mínimos',
        life: 5000,
      });
      return false;
    }
    return true;
  }

  checkPasswordRequirement(password: string, requirement: string): boolean {
    switch (requirement) {
      case 'minLength': return hasMinPasswordLength(password);
      case 'upperCase': return hasUpperCase(password);
      case 'lowerCase': return hasLowerCase(password);
      case 'number': return hasNumber(password);
      case 'symbol': return hasSymbol(password);
      default: return false;
    }
  }

  getPasswordValue(field: string): string {
    const control = this.passwordForm.get(field);
    const value = control?.value as string | null | undefined;
    return value ?? '';
  }

  isInvalid(field: string): boolean {
    const control = this.passwordForm.get(field);
    return control !== null && control.invalid && control.touched;
  }

  isAdminStep1Invalid(field: string): boolean {
    const control = this.adminStep1Form.get(field);
    return control !== null && control.invalid && control.touched;
  }

  get adminNameError(): string {
    if (!this.isAdminStep1Invalid('name')) {
      return '';
    }
    const errors = this.adminStep1Form.get('name')?.errors;
    if (errors?.['required']) {
      return 'El nombre es requerido';
    }
    if (errors?.['minlength']) {
      return 'El nombre debe tener al menos 2 caracteres';
    }
    return 'Revisa este campo';
  }

  get adminDocumentError(): string {
    if (!this.isAdminStep1Invalid('document')) {
      return '';
    }
    const errors = this.adminStep1Form.get('document')?.errors;
    if (errors?.['required']) {
      return 'El documento es requerido';
    }
    if (errors?.['minlength']) {
      return 'El documento debe tener al menos 5 caracteres';
    }
    return 'Revisa este campo';
  }

  get passwordError(): string {
    if (!this.isInvalid('newPassword')) {
      return '';
    }
    return this.passwordForm.get('newPassword')?.errors?.['required']
      ? 'La contraseña es requerida'
      : 'Revisa este campo';
  }

  get confirmPasswordError(): string {
    if (!this.isInvalid('confirmPassword')) {
      return '';
    }
    return this.passwordForm.get('confirmPassword')?.errors?.['required']
      ? 'La confirmación es requerida'
      : 'Revisa este campo';
  }

  retryTokenValidation(): void {
    this.error.set(null);
    this.loading.set(true);
    this.validateToken();
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }
}
