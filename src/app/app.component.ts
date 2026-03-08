import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LegalConsentModalComponent } from './shared/legal/legal-consent-modal.component';
import { LegalConsentStateService } from './shared/legal/legal-consent-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LegalConsentModalComponent],
  template: `
    <router-outlet></router-outlet>
    @if (consentState.shouldShowModal()) {
      <app-legal-consent-modal></app-legal-consent-modal>
    }
  `,
  styles: [],
})
export class AppComponent {
  readonly consentState = inject(LegalConsentStateService);
}
