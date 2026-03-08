import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RmsButtonComponent } from '../button/rms-button.component';
import { RmsEmptyStateInputs } from './rms-empty-state.model';

@Component({
  selector: 'rms-empty-state',
  standalone: true,
  imports: [CommonModule, RmsButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-empty-state.component.html',
  styles: [`
    .rms-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
    }

    .rms-empty-state i {
      font-size: 3rem;
      color: var(--p-surface-400);
      margin-bottom: 1rem;
    }

    .rms-empty-state h3 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
      color: var(--p-surface-700);
    }

    .rms-empty-state p {
      margin: 0 0 1.5rem;
      color: var(--p-surface-500);
      font-size: 0.95rem;
    }
  `],
})
export class RmsEmptyStateComponent {
  readonly icon = input<string>('pi pi-inbox');
  readonly title = input<string>('');
  readonly message = input<string>('');
  readonly actionLabel = input<string>('');
  readonly actionIcon = input<string>('');

  readonly onAction = output<void>();

  readonly config = () => ({
    icon: this.icon(),
    title: this.title(),
    message: this.message(),
    actionLabel: this.actionLabel(),
    actionIcon: this.actionIcon(),
  });
}
