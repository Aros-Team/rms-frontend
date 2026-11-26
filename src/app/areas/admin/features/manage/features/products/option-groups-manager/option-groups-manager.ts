import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { Product } from '@app/core/services/products/product';
import { ProductOption as ProductOptionService } from '@app/core/services/product-option/product-option';
import { OptionGroup as OptionGroupService } from '@app/core/services/option-group/option-group';
import { ProductCache } from '../product-cache';

import type { ProductOption } from '@app/shared/models/dto/products/product-option';
import type { OptionGroupRequest, OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';
import type { ApiSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { toAmount } from '@app/shared/models/dto/common/money';
import { fromApi, toApi } from '@app/shared/lib/option-selection-type-mapper/option-selection-type-mapper';
import { getSelectionTypeConfig } from '@app/shared/lib/option-selection-type-helper/option-selection-type-helper';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsCard } from '@app/shared/ui/card/card';
import { RmsCheckbox } from '@app/shared/ui/checkbox/checkbox';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSelect, type RmsSelectOption } from '@app/shared/ui/select/select';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';

import {
  RecipeIngredientEditor,
  type RecipeVariantView,
} from '../product-recipe-page/recipe-ingredient-editor';
import {
  createRecipeRow,
  recipeRowsFromRecipe,
  validateRecipeRows,
  type RecipeRow,
} from '../product-recipe-page/recipe-rows';

/** Option row enriched with the per-product association state. */
interface ManagerOption {
  id: number;
  name: string;
  recipe: { supplyVariantId: number; requiredQuantity: number }[];
  extraPrice: number;
  associated: boolean;
}

/** Option group enriched with its options for the current product. */
interface ManagerGroup {
  id: number;
  name: string;
  description: string;
  selectionType: ApiSelectionType;
  internalType: OptionSelectionType;
  required: boolean;
  productIds: number[];
  options: ManagerOption[];
}

interface GroupDraft {
  name: string;
  description: string;
  selectionType: OptionSelectionType;
  required: boolean;
}

interface OptionDraft {
  name: string;
  extraPrice: string;
}

const EMPTY_GROUP: GroupDraft = {
  name: '',
  description: '',
  selectionType: OptionSelectionType.SINGLE_CHOICE,
  required: false,
};

const EMPTY_OPTION: OptionDraft = { name: '', extraPrice: '0' };

/**
 * Product-scoped option-group manager.
 *
 * Creates option groups, creates their options (with ingredient recipes) and
 * keeps each option associated with the product plus its per-product surcharge.
 * Used by the product recipe page and the product wizard step 3.
 *
 * Product-scoped by decision: groups created here are attached to this product
 * only. A reusable catalogue is a documented future improvement (ADR-0001).
 */
@Component({
  selector: 'app-option-groups-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RmsBadge,
    RmsButton,
    RmsCard,
    RmsCheckbox,
    RmsDialog,
    RmsEmptyState,
    RmsInput,
    RmsSelect,
    RmsSkeleton,
    RecipeIngredientEditor,
    MoneyPipe,
  ],
  templateUrl: './option-groups-manager.html',
})
export class OptionGroupsManager implements OnInit {
  private readonly productService = inject(Product);
  private readonly productOptionService = inject(ProductOptionService);
  private readonly optionGroupService = inject(OptionGroupService);
  private readonly cache = inject(ProductCache);

  @Input({ required: true }) productId = 0;
  @Output() readonly changed = new EventEmitter<void>();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly groups = signal<ManagerGroup[]>([]);

  readonly variants = computed<RecipeVariantView[]>(
    () => this.cache.referenceData.data()?.variants ?? [],
  );
  readonly variantsLoading = computed(() => this.cache.referenceData.isLoading());
  readonly knownVariantIds = computed(
    () => new Set(this.variants().map((variant) => variant.id)),
  );

  // ── Group dialog ─────────────────────────────────────────────────
  readonly groupDialogOpen = signal(false);
  readonly editingGroupId = signal<number | null>(null);
  readonly groupDraft = signal<GroupDraft>({ ...EMPTY_GROUP });
  readonly groupSaving = signal(false);
  readonly groupError = signal<string | null>(null);

  readonly selectionOptions: RmsSelectOption[] = Object.values(OptionSelectionType).map(
    (value) => ({ label: getSelectionTypeConfig(value).label, value }),
  );

  // ── Option dialog ────────────────────────────────────────────────
  readonly optionDialogOpen = signal(false);
  readonly editingOptionId = signal<number | null>(null);
  readonly optionGroupId = signal<number | null>(null);
  readonly optionGroupName = signal('');
  readonly optionDraft = signal<OptionDraft>({ ...EMPTY_OPTION });
  readonly optionRows = signal<RecipeRow[]>([]);
  readonly optionSaving = signal(false);
  readonly optionError = signal<string | null>(null);
  readonly optionReplacementAck = signal(false);

  readonly optionValidation = computed(() =>
    validateRecipeRows(this.optionRows(), this.knownVariantIds()),
  );
  readonly optionPriceError = computed(() => {
    const parsed = this.parseExtraPrice(this.optionDraft().extraPrice);
    if (parsed === null) return 'Usa un número igual o mayor que 0';
    return '';
  });
  readonly canSaveOption = computed(
    () =>
      !this.optionSaving() &&
      this.optionDraft().name.trim().length > 0 &&
      this.optionValidation().valid &&
      this.optionPriceError().length === 0,
  );

  readonly optionDialogHeader = computed(() =>
    this.editingOptionId() === null
      ? `Nueva opción en «${this.optionGroupName()}»`
      : `Editar opción «${this.optionDraft().name}»`,
  );

  // ── Detach confirmation ──────────────────────────────────────────
  readonly detachDialogOpen = signal(false);
  readonly detachTarget = signal<ManagerGroup | null>(null);
  readonly detaching = signal(false);
  readonly detachError = signal<string | null>(null);

  ngOnInit(): void {
    this.cache.referenceData.loadIfStale();
    this.reload();
  }

  reload(): void {
    if (this.productId <= 0) return;
    this.loading.set(true);
    this.error.set(null);

    this.optionGroupService
      .getProductOptionGroups(this.productId)
      .pipe(
        switchMap((groups) => {
          if (groups.length === 0) {
            return of({ groups, details: [] as ProductOption[][], productOptions: [] as ProductOption[] });
          }
          return forkJoin({
            groups: of(groups),
            details: forkJoin(
              groups.map((group) =>
                this.productOptionService
                  .getOptionsByGroup(group.id)
                  .pipe(catchError(() => of([] as ProductOption[]))),
              ),
            ),
            productOptions: this.productService
              .getOptions(this.productId)
              .pipe(catchError(() => of([] as ProductOption[]))),
          });
        }),
      )
      .subscribe({
        next: ({ groups, details, productOptions }) => {
          this.groups.set(this.merge(groups, details, productOptions));
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(this.message(err, 'No se pudieron cargar los grupos de opciones'));
          this.loading.set(false);
        },
      });
  }

  private merge(
    groups: OptionGroupResponse[],
    details: ProductOption[][],
    productOptions: ProductOption[],
  ): ManagerGroup[] {
    const associatedById = new Map(productOptions.map((option) => [option.id, option]));
    return groups.map((group, index) => ({
      id: group.id,
      name: group.name,
      description: group.description ?? '',
      selectionType: group.selectionType,
      internalType: fromApi(group.selectionType),
      required: group.required,
      productIds: group.productIds,
      options: (details[index] ?? []).map((option) => {
        const associated = associatedById.get(option.id);
        return {
          id: option.id,
          name: option.name,
          recipe: option.recipe ?? [],
          extraPrice: associated === undefined ? 0 : toAmount(associated.extraPrice),
          associated: associated !== undefined,
        };
      }),
    }));
  }

  // ── Group CRUD ───────────────────────────────────────────────────

  openCreateGroup(): void {
    this.editingGroupId.set(null);
    this.groupDraft.set({ ...EMPTY_GROUP });
    this.groupError.set(null);
    this.groupDialogOpen.set(true);
  }

  openEditGroup(group: ManagerGroup): void {
    this.editingGroupId.set(group.id);
    this.groupDraft.set({
      name: group.name,
      description: group.description,
      selectionType: group.internalType,
      required: group.required,
    });
    this.groupError.set(null);
    this.groupDialogOpen.set(true);
  }

  onGroupDialogVisible(visible: boolean): void {
    this.groupDialogOpen.set(visible);
    if (!visible) this.groupError.set(null);
  }

  updateGroupName(value: string): void {
    this.groupDraft.update((draft) => ({ ...draft, name: value }));
  }

  updateGroupDescription(value: string): void {
    this.groupDraft.update((draft) => ({ ...draft, description: value }));
  }

  updateGroupSelectionType(value: string | number | null): void {
    const next = Object.values(OptionSelectionType).find((type) => type === value);
    if (next === undefined) return;
    this.groupDraft.update((draft) => ({ ...draft, selectionType: next }));
  }

  updateGroupRequired(value: boolean): void {
    this.groupDraft.update((draft) => ({ ...draft, required: value }));
  }

  saveGroup(): void {
    if (this.groupSaving()) return;
    const draft = this.groupDraft();
    if (draft.name.trim().length === 0) {
      this.groupError.set('El nombre del grupo es obligatorio');
      return;
    }

    this.groupSaving.set(true);
    this.groupError.set(null);
    const editingId = this.editingGroupId();
    const current = this.groups().find((group) => group.id === editingId);
    // Preserve every product association when editing: the API replaces the
    // whole list and a group may be shared (future reusable catalogue).
    const productIds =
      current !== undefined && current.productIds.length > 0
        ? current.productIds
        : [this.productId];

    const request: OptionGroupRequest = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      productIds,
      required: draft.required,
      selectionType: toApi(draft.selectionType),
    };

    const call =
      editingId === null
        ? this.optionGroupService.createOptionGroup(request)
        : this.optionGroupService.updateOptionGroup(editingId, request);

    call.subscribe({
      next: () => {
        this.groupSaving.set(false);
        this.groupDialogOpen.set(false);
        this.reload();
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.groupSaving.set(false);
        this.groupError.set(this.message(err, 'No se pudo guardar el grupo de opciones'));
      },
    });
  }

  // ── Option CRUD ──────────────────────────────────────────────────

  openCreateOption(group: ManagerGroup): void {
    this.editingOptionId.set(null);
    this.optionGroupId.set(group.id);
    this.optionGroupName.set(group.name);
    this.optionDraft.set({ ...EMPTY_OPTION });
    this.optionRows.set([]);
    this.optionReplacementAck.set(false);
    this.optionError.set(null);
    this.optionDialogOpen.set(true);
  }

  openEditOption(group: ManagerGroup, option: ManagerOption): void {
    this.editingOptionId.set(option.id);
    this.optionGroupId.set(group.id);
    this.optionGroupName.set(group.name);
    this.optionDraft.set({ name: option.name, extraPrice: String(option.extraPrice) });
    this.optionRows.set(recipeRowsFromRecipe(option.recipe));
    this.optionReplacementAck.set(false);
    this.optionError.set(null);
    this.optionDialogOpen.set(true);
  }

  onOptionDialogVisible(visible: boolean): void {
    this.optionDialogOpen.set(visible);
    if (!visible) this.resetOptionDialog();
  }

  updateOptionName(value: string): void {
    this.optionDraft.update((draft) => ({ ...draft, name: value }));
  }

  updateOptionExtraPrice(value: string): void {
    this.optionDraft.update((draft) => ({ ...draft, extraPrice: value }));
  }

  updateOptionRows(rows: RecipeRow[]): void {
    this.optionRows.set(rows);
  }

  addOptionRecipeRow(): void {
    this.optionRows.update((rows) => [...rows, createRecipeRow()]);
  }

  updateOptionAck(value: boolean): void {
    this.optionReplacementAck.set(value);
  }

  saveOption(): void {
    if (!this.canSaveOption()) return;
    const groupId = this.optionGroupId();
    const draft = this.optionDraft();
    const extraPrice = this.parseExtraPrice(draft.extraPrice);
    if (groupId === null || extraPrice === null) return;

    this.optionSaving.set(true);
    this.optionError.set(null);

    const request = {
      name: draft.name.trim(),
      optionGroupId: groupId,
      recipe: this.optionValidation().payload,
    };

    const editingId = this.editingOptionId();
    const save$ =
      editingId === null
        ? this.productOptionService
            .createOption(request)
            .pipe(switchMap((created) => this.productService.associateOption(this.productId, created.id, extraPrice)))
        : this.productOptionService
            .updateOption(editingId, request)
            .pipe(
              switchMap(() =>
                this.productService.updateOptionExtraPrice(this.productId, editingId, extraPrice),
              ),
            );

    save$.subscribe({
      next: () => {
        this.optionSaving.set(false);
        this.optionDialogOpen.set(false);
        this.resetOptionDialog();
        this.reload();
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.optionSaving.set(false);
        this.optionError.set(this.message(err, 'No se pudo guardar la opción'));
      },
    });
  }

  associateExisting(group: ManagerGroup, option: ManagerOption): void {
    if (option.associated) return;
    this.productService
      .associateOption(this.productId, option.id, option.extraPrice)
      .subscribe({
        next: () => {
          this.reload();
          this.changed.emit();
        },
        error: (err: unknown) => {
          this.error.set(this.message(err, 'No se pudo asociar la opción al producto'));
        },
      });
  }

  detachOption(option: ManagerOption): void {
    this.productService.detachOption(this.productId, option.id).subscribe({
      next: () => {
        this.reload();
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.error.set(this.message(err, 'No se pudo quitar la opción del producto'));
      },
    });
  }

  // ── Detach group ─────────────────────────────────────────────────

  askDetachGroup(group: ManagerGroup): void {
    this.detachTarget.set(group);
    this.detachError.set(null);
    this.detachDialogOpen.set(true);
  }

  onDetachDialogVisible(visible: boolean): void {
    this.detachDialogOpen.set(visible);
    if (!visible) this.detachTarget.set(null);
  }

  confirmDetachGroup(): void {
    const target = this.detachTarget();
    if (target === null || this.detaching()) return;
    this.detaching.set(true);
    this.detachError.set(null);
    this.productService.detachOptionGroup(this.productId, target.id).subscribe({
      next: () => {
        this.detaching.set(false);
        this.detachDialogOpen.set(false);
        this.detachTarget.set(null);
        this.reload();
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.detaching.set(false);
        this.detachError.set(this.message(err, 'No se pudo quitar el grupo del producto'));
      },
    });
  }

  // ── Template helpers ─────────────────────────────────────────────

  selectionLabel(type: ApiSelectionType): string {
    return getSelectionTypeConfig(fromApi(type)).label;
  }

  groupOptionCount(group: ManagerGroup): number {
    return group.options.filter((option) => option.associated).length;
  }

  private parseExtraPrice(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return 0;
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private resetOptionDialog(): void {
    this.editingOptionId.set(null);
    this.optionGroupId.set(null);
    this.optionGroupName.set('');
    this.optionDraft.set({ ...EMPTY_OPTION });
    this.optionRows.set([]);
    this.optionReplacementAck.set(false);
    this.optionError.set(null);
  }

  private message(err: unknown, fallback: string): string {
    return extractProblemDetail(err) ?? fallback;
  }
}
