import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LEGAL_TEXTS } from './legal-texts';
import { LegalConsentStateService } from './legal-consent-state.service';

type LegalTab = 'terms' | 'privacy' | 'cookies';

@Component({
  selector: 'app-legal-consent-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <div class="modal-overlay">
        <div class="modal">
        <header class="modal__header">
          <h1>Bienvenido al Sistema RMS</h1>
          <p>Antes de continuar, por favor revise y acepte nuestros términos.</p>
        </header>

        <nav class="tabs">
          <button
            type="button"
            class="tab"
            [class.tab--active]="activeTab() === 'terms'"
            (click)="setTab('terms')"
          >
            Términos
          </button>
          <button
            type="button"
            class="tab"
            [class.tab--active]="activeTab() === 'privacy'"
            (click)="setTab('privacy')"
          >
            Privacidad
          </button>
          <button
            type="button"
            class="tab"
            [class.tab--active]="activeTab() === 'cookies'"
            (click)="setTab('cookies')"
          >
            Cookies
          </button>
        </nav>

        <section class="modal__content">
          <article class="legal-text">
            <h2>{{ currentContent()?.title }}</h2>
            <p class="last-updated">{{ currentContent()?.lastUpdated }}</p>
            <div class="legal-body" [innerHTML]="sanitizedContent()"></div>
          </article>
        </section>

        <footer class="modal__footer">
          <div class="actions">
            <button type="button" class="btn btn--secondary" (click)="reject()">
              Rechazar
            </button>
            <button type="button" class="btn btn--primary" (click)="accept()">
              Aceptar y Continuar
            </button>
          </div>
        </footer>
      </div>
      </div>
    }
  `,
  styles: [
    `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(3, 21, 38, 0.72);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 1rem;
        animation: fadeIn 200ms ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .modal {
        background: var(--p-surface-0);
        border-radius: 1rem;
        width: 100%;
        max-width: 640px;
        max-height: 90vh;
        display: grid;
        grid-template-rows: auto auto 1fr auto;
        overflow: hidden;
        box-shadow: 0 24px 48px rgba(8, 42, 68, 0.24);
        animation: slideUp 250ms ease-out;
      }

      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .modal__header {
        padding: 1.25rem 1.5rem;
        background: linear-gradient(135deg, var(--p-primary-800) 0%, var(--p-primary-600) 100%);
        color: var(--p-primary-contrast-color);
      }

      .modal__header h1 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 600;
      }

      .modal__header p {
        margin: 0.4rem 0 0;
        opacity: 0.85;
        font-size: 0.9rem;
      }

      .tabs {
        display: flex;
        border-bottom: 1px solid var(--p-surface-200);
        background: var(--p-surface-50);
      }

      .tab {
        flex: 1;
        padding: 0.75rem;
        border: none;
        background: transparent;
        color: var(--p-surface-600);
        font-weight: 500;
        cursor: pointer;
        transition: all 150ms ease;
        border-bottom: 2px solid transparent;
      }

      .tab:hover {
        background: var(--p-surface-100);
      }

      .tab--active {
        color: var(--p-primary-600);
        border-bottom-color: var(--p-primary-600);
        background: var(--p-surface-0);
      }

      .modal__content {
        padding: 1.25rem 1.5rem;
        overflow-y: auto;
        background: var(--p-surface-0);
      }

      .legal-text h2 {
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

      .modal__footer {
        padding: 1rem 1.5rem 1.25rem;
        border-top: 1px solid var(--p-surface-200);
        background: var(--p-surface-0);
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      .btn {
        border: none;
        border-radius: 0.6rem;
        padding: 0.65rem 1.4rem;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: all 150ms ease;
      }

      .btn--primary {
        background: var(--p-primary-500);
        color: var(--p-primary-contrast-color);
      }

      .btn--primary:hover {
        background: var(--p-primary-600);
      }

      .btn--secondary {
        background: transparent;
        color: var(--p-surface-500);
        border: 1px solid var(--p-surface-300);
      }

      .btn--secondary:hover {
        background: var(--p-surface-100);
      }

      @media (max-width: 520px) {
        .modal {
          max-height: 95vh;
        }

        .tabs {
          flex-wrap: wrap;
        }

        .tab {
          flex: 1 1 40%;
        }
      }
    `,
  ],
})
export class LegalConsentModalComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly consentState = inject(LegalConsentStateService);

  readonly activeTab = signal<LegalTab>('terms');
  readonly isVisible = signal(true);

  readonly currentContent = () => {
    const tab = this.activeTab();
    switch (tab) {
      case 'terms':
        return LEGAL_TEXTS.termsAndConditions;
      case 'privacy':
        return LEGAL_TEXTS.privacyPolicy;
      case 'cookies':
        return LEGAL_TEXTS.cookieConsent;
    }
  };

  readonly sanitizedContent = (): SafeHtml => {
    const content = this.currentContent();
    if (!content) return '';
    return this.sanitizer.bypassSecurityTrustHtml(content.content);
  };

  setTab(tab: LegalTab): void {
    this.activeTab.set(tab);
  }

  accept(): void {
    this.isVisible.set(false);
    this.consentState.accept();
  }

  reject(): void {
    this.activeTab.set('terms');
  }
}
