import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RmsFilterChipsInputs, RmsFilterChip } from './rms-filter-chips.model';

@Component({
  selector: 'rms-filter-chips',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-filter-chips.component.html',
  styles: [`
    .rms-filter-chips {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .filter-chip {
      padding: 0.4rem 0.85rem;
      border-radius: 1.5rem;
      border: 1px solid var(--p-surface-700);
      background: transparent;
      color: var(--p-surface-400);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-chip:hover {
      background: var(--p-surface-800);
      color: var(--p-surface-200);
    }

    .filter-chip.active {
      background: var(--p-surface-100);
      color: var(--p-surface-900);
      border-color: var(--p-surface-100);
    }
  `],
})
export class RmsFilterChipsComponent {
  readonly chips = input<RmsFilterChip[]>([]);
  readonly activeValue = input<string>('');
  readonly allowClear = input<boolean>(true);

  readonly onChange = output<string>();

  readonly activeValueSignal = signal('');

  readonly config = () => ({
    chips: this.chips(),
    activeValue: this.activeValueSignal(),
    allowClear: this.allowClear(),
  });

  constructor() {
    this.activeValueSignal.set(this.activeValue());
  }

  select(value: string): void {
    this.activeValueSignal.set(value);
    this.onChange.emit(value);
  }
}
