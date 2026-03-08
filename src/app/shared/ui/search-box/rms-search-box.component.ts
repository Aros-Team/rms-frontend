import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RmsSearchBoxInputs } from './rms-search-box.model';

@Component({
  selector: 'rms-search-box',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-search-box.component.html',
  styles: [`
    .rms-search-box {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--p-surface-800);
      border: 1px solid var(--p-surface-700);
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
    }

    .rms-search-box i {
      color: var(--p-surface-500);
      font-size: 1rem;
    }

    .rms-search-box input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--p-surface-100);
      font-size: 0.9rem;
      outline: none;
    }

    .rms-search-box input::placeholder {
      color: var(--p-surface-500);
    }

    .clear-btn {
      background: none;
      border: none;
      color: var(--p-surface-500);
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .clear-btn:hover {
      color: var(--p-surface-300);
    }
  `],
})
export class RmsSearchBoxComponent {
  readonly placeholder = input<string>('Buscar...');
  readonly icon = input<string>('pi pi-search');
  readonly debounce = input<number>(300);

  readonly value = signal('');
  
  readonly onSearch = output<string>();

  readonly config = () => ({
    placeholder: this.placeholder(),
    icon: this.icon(),
    debounce: this.debounce(),
  });

  private debounceTimer: any;

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.onSearch.emit(value);
    }, this.debounce());
  }

  clear(): void {
    this.value.set('');
    this.onSearch.emit('');
  }
}
