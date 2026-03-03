import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LEGAL_TEXTS } from './legal-texts';

type LegalTab = 'terms' | 'privacy' | 'cookies';

@Component({
  selector: 'app-legal-consent-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isVisible()">
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
        background: #ffffff;
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
        background: linear-gradient(135deg, #06213a 0%, #154e75 100%);
        color: #ecf7ff;
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
        border-bottom: 1px solid #d4e5f1;
        background: #f4fafc;
      }

      .tab {
        flex: 1;
        padding: 0.75rem;
        border: none;
        background: transparent;
        color: #3a5a70;
        font-weight: 500;
        cursor: pointer;
        transition: all 150ms ease;
        border-bottom: 2px solid transparent;
      }

      .tab:hover {
        background: #e8f3fa;
      }

      .tab--active {
        color: #0f4f78;
        border-bottom-color: #0f4f78;
        background: #ffffff;
      }

      .modal__content {
        padding: 1.25rem 1.5rem;
        overflow-y: auto;
        background: #fafcfd;
      }

      .legal-text h2 {
        margin: 0 0 0.25rem;
        font-size: 1.15rem;
        color: #0a2e47;
      }

      .last-updated {
        margin: 0 0 1rem;
        font-size: 0.8rem;
        color: #6b8299;
      }

      .legal-body {
        font-size: 0.9rem;
        line-height: 1.6;
        color: #2a4a5e;
        white-space: pre-wrap;
        max-height: 280px;
        overflow-y: auto;
        padding-right: 0.5rem;
      }

      .legal-body strong {
        color: #0a2e47;
      }

      .modal__footer {
        padding: 1rem 1.5rem 1.25rem;
        border-top: 1px solid #dbe8f0;
        background: #ffffff;
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
        background: #0f4f78;
        color: #ffffff;
      }

      .btn--primary:hover {
        background: #0c4468;
      }

      .btn--secondary {
        background: transparent;
        color: #5a6b7a;
        border: 1px solid #c5d3de;
      }

      .btn--secondary:hover {
        background: #f0f4f8;
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
  }

  reject(): void {
    this.isVisible.set(false);
  }
}
