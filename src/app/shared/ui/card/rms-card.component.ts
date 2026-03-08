import { ChangeDetectionStrategy, Component, input, TemplateRef } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { CardModule } from 'primeng/card';
import { RmsCardInputs } from './rms-card.model';

@Component({
  selector: 'rms-card',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, CardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-card.component.html',
  styles: [`
    .rms-card {
      background: var(--p-surface-0);
      border: 1px solid var(--p-surface-200);
      border-radius: 1rem;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .rms-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .rms-card-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-100);
    }

    .rms-card-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--p-surface-900);
    }

    .rms-card-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.875rem;
      color: var(--p-surface-600);
    }

    .rms-card-content {
      padding: 1.25rem;
    }

    .rms-card-footer {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--p-surface-100);
      background: var(--p-surface-50);
    }
  `],
})
export class RmsCardComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly headerTemplate = input<TemplateRef<any> | null>(null);
  readonly footerTemplate = input<TemplateRef<any> | null>(null);
  readonly styleClass = input<string>('');

  readonly config = () => ({
    title: this.title(),
    subtitle: this.subtitle(),
    headerTemplate: this.headerTemplate(),
    footerTemplate: this.footerTemplate(),
    styleClass: this.styleClass(),
  });
}
