import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthFacade } from '../../application/auth.facade';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  template: `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">
            <i class="pi pi-shopping-bag"></i>
          </div>
          <h1>RMS</h1>
          <p class="subtitle">Restaurant Management System</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
          <div class="form-group">
            <label for="document">Correo</label>
            <input
              id="document"
              type="email"
              pInputText
              formControlName="document"
              autocomplete="email"
              placeholder="correo@restaurante.com"
              class="input-field"
            />
          </div>

          <div class="form-group">
            <label for="password">Contrasena</label>
            <p-password
              inputId="password"
              formControlName="password"
              [feedback]="false"
              [toggleMask]="true"
              [fluid]="true"
              placeholder="Ingresa tu contrasena"
              styleClass="password-wrapper"
              inputStyleClass="input-field"
            ></p-password>
          </div>

          <a routerLink="/auth/forgot-password" class="forgot-link">
            Olvidaste tu contrasena?
          </a>

          <p-message *ngIf="error()" severity="error" [text]="error()" styleClass="error-message"></p-message>

          <button
            pButton
            type="submit"
            class="submit-btn"
            [disabled]="form.invalid || loading()"
            [label]="loading() ? 'Ingresando...' : 'Iniciar Sesion'"
          ></button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .login-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
        padding: 1.5rem;
      }

      .login-card {
        width: 100%;
        max-width: 400px;
        background: #ffffff;
        border-radius: 1.25rem;
        padding: 2.5rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }

      .login-header {
        text-align: center;
        margin-bottom: 2rem;
      }

      .logo {
        width: 60px;
        height: 60px;
        background: #0f172a;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1rem;
      }

      .logo i {
        font-size: 1.75rem;
        color: #fff;
      }

      h1 {
        font-size: 1.75rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        letter-spacing: 0.05em;
      }

      .subtitle {
        color: #64748b;
        font-size: 0.85rem;
        margin: 0.35rem 0 0;
      }

      .login-form {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .form-group label {
        font-size: 0.875rem;
        font-weight: 600;
        color: #334155;
      }

      .input-field {
        width: 100%;
        padding: 0.875rem 1rem;
        border: 2px solid #000;
        border-radius: 0.75rem;
        font-size: 1rem;
        background: #fff;
        color: #0f172a;
        box-sizing: border-box;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .input-field::placeholder {
        color: #94a3b8;
      }

      .input-field:focus {
        outline: none;
        border-color: #0f172a;
        box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.1);
      }

      :host ::ng-deep .p-password {
        width: 100%;
      }

      :host ::ng-deep .p-password-input {
        width: 100%;
        padding: 0.875rem 1rem;
        border: 2px solid #000;
        border-radius: 0.75rem;
        font-size: 1rem;
        background: #fff;
        color: #0f172a;
        box-sizing: border-box;
      }

      :host ::ng-deep .p-password-input::placeholder {
        color: #94a3b8;
      }

      :host ::ng-deep .p-password-input:focus {
        outline: none;
        border-color: #0f172a;
        box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.1);
      }

      :host ::ng-deep .p-password-toggle-mask-icon {
        color: #64748b;
        cursor: pointer;
      }

      .forgot-link {
        font-size: 0.875rem;
        color: #0f172a;
        text-decoration: none;
        text-align: right;
        display: block;
        font-weight: 500;
      }

      .forgot-link:hover {
        text-decoration: underline;
      }

      :host ::ng-deep .error-message {
        width: 100%;
      }

      .submit-btn {
        width: 100%;
        padding: 1rem;
        background: #0f172a;
        border: none;
        border-radius: 0.75rem;
        font-size: 1rem;
        font-weight: 600;
        color: #fff;
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
        margin-top: 0.5rem;
      }

      .submit-btn:hover:not(:disabled) {
        background: #1e293b;
      }

      .submit-btn:active:not(:disabled) {
        transform: scale(0.98);
      }

      .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    document: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authFacade
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          if (result.requiresTwoFactor) {
            this.router.navigateByUrl('/auth/2fa');
            return;
          }

          this.router.navigateByUrl('/');
        },
        error: (err) => {
          const message = err?.error?.message || err?.message || 'No fue posible iniciar sesion.';
          this.error.set(message);
        },
      });
  }
}
