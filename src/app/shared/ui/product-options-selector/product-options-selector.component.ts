import { ChangeDetectionStrategy, Component, input, output, signal, computed, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import { ProductOption } from '../../../core/products/domain/models/product-option.model';
import { RmsButtonComponent } from '../button/rms-button.component';

export interface ProductOptionsSelectorInput {
  productId: number;
  productName: string;
  options: ProductOption[];
}

export interface ProductOptionsSelectorOutput {
  selectedOptionIds: number[];
}

@Component({
  selector: 'app-product-options-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, CheckboxModule, RmsButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [visible]="isVisible()"
      (visibleChange)="onVisibleChange($event)"
      [header]="'Seleccionar opciones - ' + input().productName"
      [modal]="true"
      [style]="{ width: '450px' }"
      [closable]="true"
      [draggable]="false"
      [resizable]="false"
      (onHide)="onModalClose()"
    >
      <div class="options-container">
        @for (group of groupedOptions(); track group.categoryName) {
          <div class="option-group">
            <h4>{{ group.categoryName }}</h4>
            <div class="option-items">
              @for (option of group.options; track option.id) {
                <div class="option-item">
                  <p-checkbox
                    [value]="option.id"
                    [inputId]="'option-' + option.id"
                    [(ngModel)]="selectedOptionIds"
                  />
                  <label [for]="'option-' + option.id">{{ option.name }}</label>
                </div>
              }
            </div>
          </div>
        } @empty {
          <div class="no-options">
            <p>No hay opciones disponibles para este producto.</p>
          </div>
        }
      </div>

      <ng-template pTemplate="footer">
        <div class="dialog-footer">
          <rms-button
            [label]="'Cancelar'"
            [severity]="'secondary'"
            [outlined]="true"
            (onClick)="close()"
          />
          <rms-button
            [label]="'Agregar al carrito'"
            [severity]="'primary'"
            [disabled]="selectedOptionIds.length === 0"
            (onClick)="confirm()"
          />
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    :host {
      display: block;
    }

    .options-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .option-group h4 {
      margin: 0 0 0.75rem;
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--p-surface-900);
    }

    .option-items {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .option-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .option-item label {
      cursor: pointer;
      color: var(--p-surface-700);
      font-size: 0.9rem;
    }

    .no-options {
      text-align: center;
      padding: 1.5rem;
      color: var(--p-surface-500);
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  `],
})
export class ProductOptionsSelectorComponent {
  readonly input = input.required<ProductOptionsSelectorInput>();
  readonly visible = input<boolean>(false);
  readonly onClose = output<void>();
  readonly onConfirm = output<ProductOptionsSelectorOutput>();

  selectedOptionIds: number[] = [];
  
  readonly isVisible = signal(false);

  constructor(private cdr: ChangeDetectorRef) {
    // Sync internal state with input
    effect(() => {
      const visible = this.visible();
      this.isVisible.set(visible);
      this.cdr.markForCheck();
    });
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.onClose.emit();
    }
  }

  onModalClose(): void {
    this.selectedOptionIds = [];
    this.onClose.emit();
  }

  readonly groupedOptions = computed(() => {
    const options = this.input().options;
    const groups = new Map<string, ProductOption[]>();

    for (const option of options) {
      const categoryName = option.optionCategoryName;
      if (!groups.has(categoryName)) {
        groups.set(categoryName, []);
      }
      groups.get(categoryName)!.push(option);
    }

    return Array.from(groups.entries()).map(([categoryName, options]) => ({
      categoryName,
      options,
    }));
  });

  close(): void {
    this.selectedOptionIds = [];
    this.onClose.emit();
  }

  confirm(): void {
    if (this.selectedOptionIds.length > 0) {
      this.onConfirm.emit({
        selectedOptionIds: [...this.selectedOptionIds],
      });
      this.selectedOptionIds = [];
    }
  }
}