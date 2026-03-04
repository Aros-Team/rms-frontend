import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { LegalConsentModalComponent } from './shared/legal/legal-consent-modal.component';
import { LegalConsentStateService } from './shared/legal/legal-consent-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgIf, RouterOutlet, LegalConsentModalComponent],
  template: `
    <router-outlet></router-outlet>
    <app-legal-consent-modal *ngIf="consentState.shouldShowModal()"></app-legal-consent-modal>
  `,
  styles: [],
})
export class AppComponent {
  readonly consentState = inject(LegalConsentStateService);
}
