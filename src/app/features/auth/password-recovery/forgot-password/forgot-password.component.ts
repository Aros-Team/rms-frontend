import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { PasswordService } from '@app/core/services/authentication/password.service';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  imports: [
    ReactiveFormsModule,
    PasswordModule,
    MessageModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule
  ],
})
export class ForgotPasswordComponent {
  private passwordService = inject(PasswordService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email])
  });

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const email = this.form.get('email')?.value;

    this.passwordService.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/login'], { queryParams: { passwordResetSent: true } });
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.error.set('Si el correo existe, recibirás un enlace de recuperación.');
          this.success.set(true);
        } else {
          this.error.set('Ocurrió un error. Por favor, intenta más tarde.');
        }
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}