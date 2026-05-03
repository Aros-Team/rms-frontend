import { Component, inject, signal } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { Password } from '@app/core/services/auth/password';
import { FloatLabelModule } from 'primeng/floatlabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.html',
  imports: [
    ReactiveFormsModule,
    PasswordModule,
    MessageModule,
    FloatLabelModule,
    InputTextModule,
    ButtonModule
  ],
})
export class ForgotPassword {
  private passwordService = inject(Password);
  private messageService = inject(MessageService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  form: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required.bind(Validators), Validators.email.bind(Validators)])
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

    const emailControl = this.form.get('email');
    const email = emailControl?.value as string;

    this.passwordService.forgotPassword(email).subscribe({
      next: () => {
        this.loading.set(false);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(['/login'], { queryParams: { passwordResetSent: true } });
      },
      error: (err: { status?: number }) => {
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(['/login']);
  }
}