import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { LegalConsentModalComponent } from './shared/legal/legal-consent-modal.component';
import { LegalConsentStateService } from './shared/legal/legal-consent-state.service';
import { AuthService } from './core/auth/application/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LegalConsentModalComponent],
  template: `
    <router-outlet></router-outlet>
    @if (consentState.shouldShowModal()) {
      <app-legal-consent-modal></app-legal-consent-modal>
    }
    @if (authService.isLoggedIn()) {
      <button type="button" class="logout-btn" (click)="logout()">
        <i class="pi pi-sign-out"></i>
        Salir
      </button>
    }
  `,
  styles: [`
    .logout-btn {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      padding: 0.5rem 1rem;
      background: var(--p-surface-800);
      color: var(--p-surface-100);
      border: 1px solid var(--p-surface-700);
      border-radius: 0.5rem;
      cursor: pointer;
      font-size: 0.75rem;
      opacity: 0.7;
      z-index: 9998;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .logout-btn:hover {
      opacity: 1;
    }
  `],
})
export class AppComponent {
  readonly consentState = inject(LegalConsentStateService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      const isLoggedIn = this.authService.isLoggedIn();
      const currentUrl = window.location.pathname;

      if (!isLoggedIn && !currentUrl.startsWith('/auth')) {
        this.router.navigate(['/auth/login']);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
