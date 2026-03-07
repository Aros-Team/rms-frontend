import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthSessionService } from '../../core/auth/auth-session.service';

@Component({
  selector: 'app-shell-header',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <header class="header">
      <div>
        <p class="brand-label">Restaurant Management System</p>
        <h1 class="brand-title">Panel de Operaciones</h1>
      </div>

      <div class="header-actions">
        <button
          type="button"
          pButton
          icon="pi pi-bell"
          [outlined]="true"
          class="action-btn"
          aria-label="Notificaciones"
        ></button>
        <button
          type="button"
          pButton
          icon="pi pi-sign-out"
          [outlined]="true"
          class="action-btn"
          aria-label="Cerrar sesion"
          (click)="logout()"
        ></button>
      </div>
    </header>
  `,
  styles: [
    `
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 1rem;
        padding: 1rem 1.25rem;
      }

      .brand-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #64748b;
        margin: 0;
      }

      .brand-title {
        font-size: 1.1rem;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0.25rem 0 0;
      }

      .header-actions {
        display: flex;
        gap: 0.5rem;
      }

      .action-btn {
        width: 40px;
        height: 40px;
        border-color: #475569 !important;
        color: #94a3b8 !important;
      }

      .action-btn:hover {
        background: #334155 !important;
        color: #f1f5f9 !important;
      }
    `,
  ],
})
export class ShellHeaderComponent {
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  logout(): void {
    this.authSession.clear();
    this.router.navigateByUrl('/auth/login');
  }
}
