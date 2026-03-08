import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
            <label for="username">Correo</label>
            <input
              id="username"
              type="email"
              pInputText
              formControlName="username"
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

          @if (authFacade.error()) {
            <p-message severity="error" [text]="authFacade.error()!" styleClass="error-message"></p-message>
          }

          <button
            pButton
            type="submit"
            class="submit-btn"
            [disabled]="form.invalid || authFacade.loading()"
            [label]="authFacade.loading() ? 'Ingresando...' : 'Iniciar Sesion'"
          ></button>
        </form>

        <div class="demo-credentials">
          <p class="demo-title">Credenciales de prueba:</p>
          <ul class="demo-list">
            <li><code>admin&#64;rms.com</code> / <code>admin123</code> - Admin</li>
            <li><code>mesero&#64;rms.com</code> / <code>mesero123</code> - Mesero</li>
            <li><code>cocina&#64;rms.com</code> / <code>cocina123</code> - Cocina</li>
          </ul>
        </div>
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
        background: linear-gradient(135deg, var(--p-surface-900) 0%, var(--p-surface-800) 50%, var(--p-surface-900) 100%);
        padding: 1.5rem;
      }

      .login-card {
        width: 100%;
        max-width: 400px;
        background: var(--p-surface-0);
        border-radius: 1.25rem;
        padding: 2rem;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }

      .login-header {
        text-align: center;
        margin-bottom: 2rem;
      }

      .logo {
        width: 60px;
        height: 60px;
        background: var(--p-surface-900);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 1rem;
      }

      .logo i {
        font-size: 1.75rem;
        color: var(--p-surface-0);
      }

      h1 {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--p-surface-900);
        margin: 0;
        letter-spacing: 0.05em;
      }

      .subtitle {
        color: var(--p-surface-500);
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
        color: var(--p-surface-700);
      }

      .input-field {
        width: 100%;
        padding: 0.875rem 1rem;
        border: 2px solid var(--p-surface-300);
        border-radius: 0.75rem;
        font-size: 1rem;
        background: var(--p-surface-0);
        color: var(--p-surface-900);
        box-sizing: border-box;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .input-field::placeholder {
        color: var(--p-surface-400);
      }

      .input-field:focus {
        outline: none;
        border-color: var(--p-primary-500);
        box-shadow: 0 0 0 4px var(--p-primary-100);
      }

      :host ::ng-deep .p-password {
        width: 100%;
      }

      :host ::ng-deep .p-password-input {
        width: 100%;
        padding: 0.875rem 1rem;
        border: 2px solid var(--p-surface-300);
        border-radius: 0.75rem;
        font-size: 1rem;
        background: var(--p-surface-0);
        color: var(--p-surface-900);
        box-sizing: border-box;
      }

      :host ::ng-deep .p-password-input::placeholder {
        color: var(--p-surface-400);
      }

      :host ::ng-deep .p-password-input:focus {
        outline: none;
        border-color: var(--p-primary-500);
        box-shadow: 0 0 0 4px var(--p-primary-100);
      }

      :host ::ng-deep .p-password-toggle-mask-icon {
        color: var(--p-surface-500);
        cursor: pointer;
      }

      :host ::ng-deep .error-message {
        width: 100%;
      }

      .submit-btn {
        width: 100%;
        padding: 1rem;
        background: var(--p-surface-900);
        border: none;
        border-radius: 0.75rem;
        font-size: 1rem;
        font-weight: 600;
        color: var(--p-surface-0);
        cursor: pointer;
        transition: background 0.2s, transform 0.1s;
        margin-top: 0.5rem;
      }

      .submit-btn:hover:not(:disabled) {
        background: var(--p-surface-800);
      }

      .submit-btn:active:not(:disabled) {
        transform: scale(0.98);
      }

      .submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .demo-credentials {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--p-surface-200);
      }

      .demo-title {
        font-size: 0.75rem;
        color: var(--p-surface-500);
        margin: 0 0 0.5rem 0;
        font-weight: 600;
      }

      .demo-list {
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: 0.75rem;
        color: var(--p-surface-600);
      }

      .demo-list li {
        padding: 0.25rem 0;
      }

      .demo-list code {
        background: var(--p-surface-100);
        padding: 0.15rem 0.3rem;
        border-radius: 0.25rem;
        font-size: 0.7rem;
      }
    `,
  ],
})
export class LoginPageComponent {
  readonly authFacade = inject(AuthFacade);

  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    const { username, password } = this.form.getRawValue();
    this.authFacade.login({ username, password }).subscribe();
  }
}
