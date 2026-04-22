import { Component, inject, signal, OnInit, ChangeDetectionStrategy, computed } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SetupAccountService } from '@services/authentication/setup-account.service';
import { SetupAccountResponse } from '@models/dto/auth/setup-account-response.model';
import { SetupPasswordRequest } from '@models/dto/auth/setup-password-request.model';
import { MessageService } from 'primeng/api';
import { LoggingService } from '@app/core/services/logging/logging-service';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-setup-account',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PasswordModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    NgClass,
  ],
  templateUrl: './setup-account.component.html',
  styleUrl: './setup-account.component.css',
})
export class SetupAccountComponent implements OnInit {
  private setupAccountService = inject(SetupAccountService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private loggingService = inject(LoggingService);

  loading = signal(true);
  error = signal<string | null>(null);
  success = signal(false);
  userData = signal<SetupAccountResponse | null>(null);
  currentStep = signal(1);

  passwordForm: FormGroup = new FormGroup({
    newPassword: new FormControl('', [Validators.required]),
    confirmPassword: new FormControl('', [Validators.required]),
  });

  adminStep1Form: FormGroup = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    document: new FormControl('', [Validators.required, Validators.minLength(5)]),
  });

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.error.set('Token no proporcionado');
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

    const password = this.passwordForm.get('newPassword')?.value;
    const confirmPassword = this.passwordForm.get('confirmPassword')?.value;

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
      data.name = this.adminStep1Form.get('name')?.value;
      data.document = this.adminStep1Form.get('document')?.value;
    }

    this.loading.set(true);
    this.setupAccountService.setupPassword(data).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        setTimeout(() => {
          this.router.navigate(['/login'], { queryParams: { accountActivated: 'true' } });
        }, 2000);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 409) {
          this.error.set('already_used');
        } else if (err.status === 400) {
          this.error.set('invalid');
        } else {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo activar la cuenta. Intente más tarde.',
            life: 5000,
          });
        }
      },
    });
  }

  private validatePasswordStrength(password: string): boolean {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*()+\-=[\]{};':"\\|,.<>?]/.test(password);
    const hasMinLength = password.length >= 8;

    if (!hasMinLength || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSymbol) {
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
      case 'minLength': return password.length >= 8;
      case 'upperCase': return /[A-Z]/.test(password);
      case 'lowerCase': return /[a-z]/.test(password);
      case 'number': return /\d/.test(password);
      case 'symbol': return /[!@#$%^&*()+\-=[\]{};':"\\|,.<>?]/.test(password);
      default: return false;
    }
  }

  getPasswordValue(field: string): string {
    return this.passwordForm.get(field)?.value || '';
  }

  isInvalid(field: string): boolean {
    const control = this.passwordForm.get(field);
    return control !== null && control.invalid && control.touched;
  }

  isAdminStep1Invalid(field: string): boolean {
    const control = this.adminStep1Form.get(field);
    return control !== null && control.invalid && control.touched;
  }

  retryTokenValidation(): void {
    this.error.set(null);
    this.loading.set(true);
    this.validateToken();
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
