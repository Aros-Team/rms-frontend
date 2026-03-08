import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DialogModule } from 'primeng/dialog';
import { TabsModule } from 'primeng/tabs';
import { LEGAL_TEXTS } from './legal-texts';
import { LegalConsentStateService } from './legal-consent-state.service';
import { RmsButtonComponent } from '../ui/button/rms-button.component';

@Component({
  selector: 'app-legal-consent-modal',
  standalone: true,
  imports: [CommonModule, DialogModule, TabsModule, RmsButtonComponent],
  templateUrl: './legal-consent-modal.component.html',
  styles: [`
    :host {
      display: block;
    }

    .modal-subtitle {
      margin: 0 0 1rem;
      color: var(--p-surface-600);
      font-size: 0.9rem;
    }

    .legal-content h2 {
      margin: 0 0 0.25rem;
      font-size: 1.15rem;
      color: var(--p-surface-800);
    }

    .last-updated {
      margin: 0 0 1rem;
      font-size: 0.8rem;
      color: var(--p-surface-500);
    }

    .legal-body {
      font-size: 0.9rem;
      line-height: 1.6;
      color: var(--p-surface-700);
      white-space: pre-wrap;
      max-height: 280px;
      overflow-y: auto;
      padding-right: 0.5rem;
    }

    .legal-body strong {
      color: var(--p-surface-800);
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    :host ::ng-deep .legal-modal .p-dialog-content {
      padding: 0;
    }

    :host ::ng-deep .legal-modal .p-tabview-panels {
      padding: 1.25rem 1.5rem;
    }
  `],
})
export class LegalConsentModalComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly consentState = inject(LegalConsentStateService);

  readonly isVisible = signal(true);
  readonly activeTabIndex = signal(0);

  private readonly contents = {
    terms: LEGAL_TEXTS.termsAndConditions,
    privacy: LEGAL_TEXTS.privacyPolicy,
    cookies: LEGAL_TEXTS.cookieConsent,
  };

  getContent(type: 'terms' | 'privacy' | 'cookies') {
    return this.contents[type];
  }

  getSanitizedContent(type: 'terms' | 'privacy' | 'cookies'): SafeHtml {
    const content = this.getContent(type);
    if (!content) return '';
    return this.sanitizer.bypassSecurityTrustHtml(content.content);
  }

  accept(): void {
    this.isVisible.set(false);
    this.consentState.accept();
  }

  reject(): void {
    this.activeTabIndex.set(0);
  }
}
