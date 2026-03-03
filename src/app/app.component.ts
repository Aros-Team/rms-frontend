import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LegalConsentModalComponent } from './shared/legal/legal-consent-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LegalConsentModalComponent],
  template: `
    <router-outlet></router-outlet>
    <app-legal-consent-modal></app-legal-consent-modal>
  `,
  styles: [],
})
export class AppComponent {}
