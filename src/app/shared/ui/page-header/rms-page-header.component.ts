import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { RmsPageHeaderInputs } from './rms-page-header.model';

@Component({
  selector: 'rms-page-header',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-page-header.component.html',
  styles: [`
    .rms-page-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .back-btn {
      width: 40px;
      height: 40px;
      padding: 0;
      background: var(--p-surface-800);
      border: 1px solid var(--p-surface-700);
      color: var(--p-surface-300);
    }

    .back-btn:hover {
      background: var(--p-surface-700);
      color: var(--p-surface-100);
    }

    .rms-page-header-content {
      flex: 1;
      min-width: 200px;
    }

    .rms-page-header-content h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--p-surface-100);
    }

    .rms-page-header-content p {
      margin: 0.25rem 0 0;
      font-size: 0.875rem;
      color: var(--p-surface-500);
    }

    .rms-page-header-actions {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
  `],
})
export class RmsPageHeaderComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  readonly showBackButton = input<boolean>(false);
  readonly backIcon = input<string>('pi pi-arrow-left');

  readonly onBack = output<void>();

  readonly config = () => ({
    title: this.title(),
    subtitle: this.subtitle(),
    showBackButton: this.showBackButton(),
    backIcon: this.backIcon(),
  });
}
