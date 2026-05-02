import { Component, inject, signal, OnInit } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { Password } from '@app/core/services/auth/password';
import { Logging } from '@app/core/services/logging/logging';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword === confirmPassword ? null : { mismatch: true };
}

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.css'],
  imports: [
    ReactiveFormsModule,
    NgClass,
    PasswordModule,
    InputTextModule,
    ButtonModule,
    MessageModule
  ],
})
export class ResetPassword implements OnInit {
  private passwordService = inject(Password);
  private messageService = inject(MessageService);
  private logger = inject(Logging);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  token = signal<string | null>(null);

  form: FormGroup = new FormGroup({
    newPassword: new FormControl('', [Validators.required]),
    confirmPassword: new FormControl('', [Validators.required])
  }, { validators: passwordMatchValidator });

  checkPasswordRequirement(requirement: string): boolean {
    const password = this.form.get('newPassword')?.value || '';
    switch (requirement) {
      case 'minLength': return password.length >= 8;
      case 'upperCase': return /[A-Z]/.test(password);
      case 'lowerCase': return /[a-z]/.test(password);
      case 'number': return /\d/.test(password);
      case 'symbol': return /[@$!%*?&]/.test(password);
      default: return false;
    }
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      this.token.set(token);
    });
  }

  onSubmit(): void {
    const token = this.token();
    if (!token) {
      this.error.set('El enlace de recuperación es inválido. Por favor, solicita un nuevo código.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const newPassword = this.form.get('newPassword')?.value;

    this.passwordService.resetPassword(token, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Tu contraseña ha sido restablecida'
        });
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 400) {
          this.error.set('Token inválido o expirado. Por favor, solicita un nuevo código.');
        } else {
          this.error.set('Ocurrió un error. Por favor, intenta más tarde.');
        }
        this.logger.error('Reset password failed', err);
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}