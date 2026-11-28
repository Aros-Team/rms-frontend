import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DialogModule } from 'primeng/dialog';

import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { toAmount } from '@app/shared/models/dto/common/money';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';
import { ProductOption } from '@app/shared/models/dto/products/product-option';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { fromApi } from '@app/shared/lib/option-selection-type-mapper/option-selection-type-mapper';
import {
  OptionSelectionList,
  SelectionOption,
} from '@app/shared/components/option-selection-list/option-selection-list';
import { OptionGroupBadgeComponent } from '@app/shared/components/option-group-badge/option-group-badge';
import {
  RemovableChip,
  RemovableChipData,
} from '@app/shared/components/removable-chip/removable-chip';
import { productImageSrcSet } from '@app/shared/lib/product-image';

export interface SelectedOption {
  optionId: number;
  optionName: string;
}

export interface ProductOptionsConfirmEvent {
  product: ProductListResponse;
  selectedOptions: SelectedOption[];
  instructions: string;
  quantity: number;
  extraCharge: number;
}

export interface GroupMeta {
  groupId: number;
  groupName: string;
  selectionType: OptionSelectionType;
  required: boolean;
  options: SelectionOption[];
}

@Component({
  selector: 'app-product-options-modal',
  templateUrl: './product-options-modal.html',
  styleUrl: './product-options-modal.css',
  imports: [
    CommonModule,
    DialogModule,
    FormsModule,
    OptionSelectionList,
    OptionGroupBadgeComponent,
    RemovableChip,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductOptionsModal {
  // ── Inputs ──
  @Input() product: ProductListResponse | null = null;

  private readonly optionsState = signal<ProductOption[]>([]);

  /** Product options for the modal. Stored as a signal so the computeds invalidate on change. */
  @Input() set options(value: ProductOption[] | null | undefined) {
    this.optionsState.set(value ?? []);
  }

  get options(): ProductOption[] {
    return this.optionsState();
  }

  private readonly requiredGroupIdsState = signal<readonly number[]>([]);

  /** Option groups marked as required for this product. */
  @Input() set requiredGroupIds(value: readonly number[] | null | undefined) {
    this.requiredGroupIdsState.set(value ?? []);
  }

  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() visible = false;

  // Editing support: pre-fill with existing values
  @Input() initialOptionIds: number[] = [];
  @Input() initialInstructions = '';
  @Input() initialQuantity = 1;

  // ── Outputs ──
  @Output() readonly confirm = new EventEmitter<ProductOptionsConfirmEvent>();
  @Output() readonly dismiss = new EventEmitter<void>();
  @Output() readonly errorClear = new EventEmitter<void>();

  /** Renders money values inside TS-computed labels (same formatting as the template pipe). */
  private readonly moneyPipe = new MoneyPipe();

  imageSrcSet(): string | null {
    return productImageSrcSet(this.product);
  }

  // ── Internal state (public for template access) ──
  selectedOptionIds = signal<number[]>([]);
  instructions = signal('');
  quantity = signal(1);

  // ── Computed: group options by optionGroupId ──
  readonly groupMeta = computed<GroupMeta[]>(() => {
    const opts = this.optionsState();
    const required = new Set(this.requiredGroupIdsState());
    const map = new Map<number, GroupMeta>();

    for (const opt of opts) {
      const gid = opt.optionGroupId;
      let group = map.get(gid);
      if (!group) {
        group = {
          groupId: gid,
          groupName: opt.optionGroupName,
          selectionType: fromApi(opt.categorySelectionType),
          required: required.has(gid),
          options: [],
        };
        map.set(gid, group);
      }
      group.options.push({
        id: opt.id,
        name: opt.name,
        extraPrice: opt.extraPrice == null ? undefined : toAmount(opt.extraPrice),
      });
    }

    return Array.from(map.values());
  });

  // ── Computed: chips for currently selected options ──
  readonly selectedChips = computed<RemovableChipData[]>(() => {
    const selIds = this.selectedOptionIds();
    const opts = this.optionsState();
    return selIds
      .map((id) => opts.find((o) => o.id === id))
      .filter((o): o is ProductOption => !!o)
      .map((o) => ({
        id: o.id,
        label: o.name,
        meta:
          toAmount(o.extraPrice) > 0 ? this.moneyPipe.transform(toAmount(o.extraPrice)) : undefined,
      }));
  });

  // ── Computed: accumulated extraCharge from selected options ──
  readonly extraCharge = computed(() => {
    const selIds = this.selectedOptionIds();
    const opts = this.optionsState();
    return selIds.reduce((sum, id) => {
      const opt = opts.find((o) => o.id === id);
      return sum + toAmount(opt?.extraPrice);
    }, 0);
  });

  /** Required groups that still have no selected option. */
  readonly missingRequiredGroups = computed<GroupMeta[]>(() => {
    const selected = new Set(this.selectedOptionIds());
    return this.groupMeta().filter(
      (group) => group.required && !group.options.some((option) => selected.has(option.id)),
    );
  });

  readonly canConfirm = computed(() => this.missingRequiredGroups().length === 0);

  readonly missingRequiredLabel = computed(() =>
    this.missingRequiredGroups()
      .map((group) => group.groupName)
      .join(', '),
  );

  readonly validationMessage = signal('');

  // ── Reset state when dialog opens ──
  constructor() {
    effect(() => {
      if (this.visible) {
        this.selectedOptionIds.set(this.initialOptionIds);
        this.instructions.set(this.initialInstructions);
        this.quantity.set(this.initialQuantity);
        this.validationMessage.set('');
      }
    });
  }

  // ── Public methods ──

  getSelectedIdsForGroup(groupId: number): number[] {
    const group = this.groupMeta().find((g) => g.groupId === groupId);
    if (!group) return [];
    const groupOptionIds = group.options.map((o) => o.id);
    return this.selectedOptionIds().filter((id) => groupOptionIds.includes(id));
  }

  onGroupSelectionChange(groupId: number, selectedIds: number[]): void {
    const group = this.groupMeta().find((g) => g.groupId === groupId);
    if (!group) return;
    const groupOptionIds = new Set(group.options.map((o) => o.id));
    this.selectedOptionIds.update((ids) => {
      const withoutGroup = ids.filter((id) => !groupOptionIds.has(id));
      return [...withoutGroup, ...selectedIds];
    });
  }

  removeSelection(optionId: number): void {
    this.selectedOptionIds.update((ids) => ids.filter((id) => id !== optionId));
  }

  toggleOption(optionId: number, optionGroupId: number): void {
    const sameCategory = this.options
      .filter((o) => o.optionGroupId === optionGroupId)
      .map((o) => o.id);

    this.selectedOptionIds.update((ids) => {
      const withoutCategory = ids.filter((id) => !sameCategory.includes(id));
      return ids.includes(optionId) ? withoutCategory : [...withoutCategory, optionId];
    });
  }

  isSelected(optionId: number): boolean {
    return this.selectedOptionIds().includes(optionId);
  }

  changeQuantity(delta: number): void {
    this.quantity.update((q) => Math.max(1, Math.min(99, q + delta)));
  }

  onConfirm(): void {
    const prod = this.product;
    if (!prod) return;

    const missing = this.missingRequiredGroups();
    if (missing.length > 0) {
      this.validationMessage.set(
        `Falta elegir en: ${missing.map((group) => group.groupName).join(', ')}`,
      );
      return;
    }
    this.validationMessage.set('');

    const selIds = this.selectedOptionIds();
    const selOptions: SelectedOption[] = selIds.map((id) => ({
      optionId: id,
      optionName: this.optionsState().find((o) => o.id === id)?.name ?? '',
    }));

    this.confirm.emit({
      product: prod,
      selectedOptions: selOptions,
      instructions: this.instructions(),
      quantity: this.quantity(),
      extraCharge: this.extraCharge(),
    });
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  onErrorClear(): void {
    this.errorClear.emit();
  }
}
