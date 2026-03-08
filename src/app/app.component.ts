import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { LegalConsentModalComponent } from './shared/legal/legal-consent-modal.component';
import { LegalConsentStateService } from './shared/legal/legal-consent-state.service';
import { AuthService } from './core/auth/application/services/auth.service';
import { RmsButtonComponent } from './shared/ui/button/rms-button.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LegalConsentModalComponent, RmsButtonComponent],
  template: `
    <router-outlet></router-outlet>
    @if (consentState.shouldShowModal()) {
      <app-legal-consent-modal></app-legal-consent-modal>
    }
    @if (authService.isLoggedIn()) {
      <rms-button
        class="logout-btn"
        [label]="'Salir'"
        [icon]="'pi pi-sign-out'"
        [severity]="'secondary'"
        [outlined]="true"
        (onClick)="logout()"
      />
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    .logout-btn {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      z-index: 9998;
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
