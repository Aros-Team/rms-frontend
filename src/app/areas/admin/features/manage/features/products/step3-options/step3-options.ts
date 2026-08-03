import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { switchMap, catchError, EMPTY, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { Product } from '@app/core/services/products/product';
import { OptionGroup } from '@app/core/services/option-group/option-group';
import { Logging } from '@app/core/services/logging/logging';
import { ProductCache } from '../product-cache';

import { ProductOptionResponse } from '@app/shared/models/dto/products/product-option';
import { OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { ProductCostBreakdownResponse } from '@app/shared/models/dto/products/product-cost-breakdown-response';

import { fromApi, toApi } from '@app/shared/lib/option-selection-type-mapper/option-selection-type-mapper';
import { getSelectionTypeConfig } from '@app/shared/lib/option-selection-type-helper/option-selection-type-helper';
import { mapHttpError } from '@app/shared/lib/http-error-mapper/http-error-mapper';

import { SearchInput } from '@app/shared/components/search-input/search-input';
import { OptionSelectionList, SelectionOption } from '@app/shared/components/option-selection-list/option-selection-list';
import { InlineCreatePopover, InlineCreateField } from '@app/shared/components/inline-create-popover/inline-create-popover';
import { RemovableChip, RemovableChipData } from '@app/shared/components/removable-chip/removable-chip';
import { CostBreakdownPanelComponent } from '@app/shared/components/cost-breakdown-panel/cost-breakdown-panel';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';

export interface ActiveOption {
  id: number;
  name: string;
  optionGroupId: number;
  optionGroupName: string;
}

export interface OptionsChangedPayload {
  optionIds: number[];
  optionExtras: { optionId: number; extraPrice: number }[];
}

@Component({
  selector: 'app-step3-options',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SearchInput,
    OptionSelectionList,
    InlineCreatePopover,
    RemovableChip,
    CostBreakdownPanelComponent,
    ButtonModule,
    TagModule,
    DividerModule,
    TooltipModule,
  ],
  templateUrl: './step3-options.html',
  styleUrl: './step3-options.css',
})
export class Step3Options {
  private productService = inject(Product);
  private optionGroupService = inject(OptionGroup);
  private messageService = inject(MessageService);
  private logger = inject(Logging);
  private cache = inject(ProductCache);

  readonly productId = input.required<number>();
  readonly modalMode = input<'create' | 'edit'>('create');
  readonly existingOptions = input<ProductOptionResponse[]>([]);
  readonly optionGroups = input<OptionGroupResponse[]>([]);

  readonly optionsChanged = output<OptionsChangedPayload>();

  readonly selectedGroupId = signal<number | null>(null);
  readonly tempSelectedOptionIds = signal<number[]>([]);
  readonly activeOptions = signal<ActiveOption[]>([]);
  readonly costBreakdown = signal<ProductCostBreakdownResponse | null>(null);
  readonly groupSearchTerm = signal('');
  readonly inlineCreateSubmitting = signal(false);

  readonly createGroupFields: InlineCreateField[] = [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Tipo de masa' },
    {
      name: 'selectionType',
      label: 'Tipo de selección',
      type: 'select',
      required: true,
      placeholder: 'Seleccionar',
      options: [
        { label: 'Única opción', value: OptionSelectionType.SINGLE_CHOICE },
        { label: 'Selección múltiple', value: OptionSelectionType.MULTI_SELECT },
        { label: 'Extra (cargo adicional)', value: OptionSelectionType.EXTRA },
        { label: 'Quitar (remoción)', value: OptionSelectionType.REMOVE },
      ],
    },
    { name: 'description', label: 'Descripción', type: 'text', required: false, placeholder: 'Opcional' },
  ];

  /** Options for the currently selected group */
  readonly groupOptions = computed<SelectionOption[]>(() => {
    const groupId = this.selectedGroupId();
    if (!groupId) return [];
    const allOptions = this.cache.referenceData.data()?.productOptions ?? [];
    return allOptions
      .filter(o => o.optionCategoryId === groupId)
      .map(o => ({
        id: o.id,
        name: o.name,
      }));
  });

  /** Filtered groups based on search term */
  readonly filteredGroups = computed(() => {
    const term = this.groupSearchTerm().toLowerCase().trim();
    const all = this.optionGroups();
    if (!term) return all;
    return all.filter(g => g.name.toLowerCase().includes(term));
  });

  /** Whether the create-group option should be shown */
  readonly showCreateOption = computed(() => {
    const term = this.groupSearchTerm().toLowerCase().trim();
    if (!term) return false;
    const all = this.optionGroups();
    return !all.some(g => g.name.toLowerCase() === term);
  });

  /** Chips for active options */
  readonly activeOptionChips = computed<RemovableChipData[]>(() => {
    return this.activeOptions().map(o => ({
      id: o.id,
      label: o.name,
      severity: 'secondary' as const,
    }));
  });

  /** Selection type config for the selected group */
  readonly selectedGroupTypeConfig = computed(() => {
    const groupId = this.selectedGroupId();
    if (!groupId) return null;
    const groups = this.optionGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;
    return getSelectionTypeConfig(fromApi(group.selectionType));
  });

  /** Selection type for the selected group */
  readonly selectedGroupSelectionType = computed<OptionSelectionType | null>(() => {
    const groupId = this.selectedGroupId();
    if (!groupId) return null;
    const groups = this.optionGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;
    return fromApi(group.selectionType);
  });

  private readonly costEffect = effect(() => {
    const id = this.productId();
    if (id) {
      this.loadCostBreakdown(id);
    }
  });

  constructor() {
    effect(() => {
      const opts = this.activeOptions();
      const id = this.productId();
      this.emitOptionsChanged(id, opts);
    });
  }

  onGroupSearch(term: string): void {
    this.groupSearchTerm.set(term);
  }

  selectGroup(groupId: number): void {
    this.selectedGroupId.set(groupId);
    this.tempSelectedOptionIds.set([]);
  }

  onSelectionChange(ids: number[]): void {
    this.tempSelectedOptionIds.set(ids);
  }

  addSelectedOptions(): void {
    const tempIds = this.tempSelectedOptionIds();
    const groupOpts = this.groupOptions();
    const group = this.optionGroups().find(g => g.id === this.selectedGroupId());

    const newOptions: ActiveOption[] = tempIds
      .filter(id => !this.activeOptions().some(a => a.id === id))
      .map(id => {
        const opt = groupOpts.find(o => o.id === id);
        return {
          id,
          name: opt?.name ?? 'Opción',
          optionGroupId: this.selectedGroupId() ?? 0,
          optionGroupName: group?.name ?? '',
        };
      });

    this.activeOptions.update(current => [...current, ...newOptions]);
    this.tempSelectedOptionIds.set([]);
  }

  removeOption(optionId: number): void {
    this.activeOptions.update(opts => opts.filter(o => o.id !== optionId));
  }

  onInlineCreateSubmit(values: Record<string, unknown>): void {
    const name = values['name'] as string;
    const selectionType = values['selectionType'] as OptionSelectionType;
    const description = (values['description'] as string) || '';

    if (!name.trim()) return;

    const productId = this.productId();

    this.inlineCreateSubmitting.set(true);
    this.optionGroupService.createOptionGroup({
      name: name.trim(),
      description,
      productIds: [productId],
      selectionType: toApi(selectionType),
    }).pipe(
      switchMap((created: OptionGroupResponse) => {
        this.cache.referenceData.refresh();
        return of(created);
      }),
      catchError(err => {
        this.logger.error('Error creating option group', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: mapHttpError(err as HttpErrorResponse, 'option-group'),
        });
        this.inlineCreateSubmitting.set(false);
        return EMPTY;
      })
    ).subscribe((created: OptionGroupResponse) => {
      this.inlineCreateSubmitting.set(false);
      this.selectedGroupId.set(created.id);
      this.groupSearchTerm.set('');
      this.messageService.add({
        severity: 'success',
        summary: 'Grupo creado',
        detail: `"${created.name}" agregado correctamente`,
      });
    });
  }

  private loadCostBreakdown(productId: number): void {
    this.productService.getCostBreakdown(productId).pipe(
      catchError(() => of(null))
    ).subscribe((breakdown: ProductCostBreakdownResponse | null) => {
      this.costBreakdown.set(breakdown);
    });
  }

  private emitOptionsChanged(_productId: number, options: ActiveOption[]): void {
    this.optionsChanged.emit({
      optionIds: options.map(o => o.id),
      optionExtras: options.map(o => ({ optionId: o.id, extraPrice: 0 })),
    });
  }
}
