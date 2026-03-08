import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RmsCartItemInputs, RmsCartItemData } from './rms-cart-item.model';

@Component({
  selector: 'rms-cart-item',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-cart-item.component.html',
  styles: [`
    .rms-cart-item {
      background: var(--p-surface-800);
      border-radius: 0.75rem;
      padding: 0.75rem;
    }

    .rms-cart-item-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .rms-cart-item-name {
      font-weight: 500;
      color: var(--p-surface-100);
    }

    .rms-cart-item-price {
      color: var(--p-success-500);
      font-weight: 600;
    }

    .rms-cart-item-controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .qty-btn {
      width: 28px;
      height: 28px;
      border: 1px solid var(--p-surface-600);
      border-radius: 0.4rem;
      background: var(--p-surface-700);
      color: var(--p-surface-100);
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .qty-btn:hover {
      background: var(--p-surface-600);
    }

    .qty {
      min-width: 24px;
      text-align: center;
      color: var(--p-surface-100);
      font-weight: 500;
    }

    .remove-btn {
      margin-left: auto;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: 0.4rem;
      background: var(--p-danger-500);
      color: var(--p-danger-contrast-color);
      cursor: pointer;
      font-size: 1.1rem;
    }

    .rms-cart-item-instructions {
      width: 100%;
      padding: 0.4rem 0.6rem;
      font-size: 0.8rem;
      border: 1px solid var(--p-surface-600);
      border-radius: 0.4rem;
      background: var(--p-surface-700);
      color: var(--p-surface-200);
      box-sizing: border-box;
    }

    .rms-cart-item-instructions::placeholder {
      color: var(--p-surface-500);
    }

    .rms-cart-item-instructions:focus {
      outline: none;
      border-color: var(--p-primary-500);
    }
  `],
})
export class RmsCartItemComponent {
  readonly item = input.required<RmsCartItemData>();
  readonly currency = input<string>('USD');

  readonly increment = output<string | number>();
  readonly decrement = output<string | number>();
  readonly remove = output<string | number>();
  readonly updateInstructions = output<{ id: string | number; instructions: string }>();

  readonly config = () => ({
    item: this.item(),
    currency: this.currency(),
  });

  onUpdateInstructions(event: Event, id: string | number): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateInstructions.emit({ id, instructions: value });
  }
}
