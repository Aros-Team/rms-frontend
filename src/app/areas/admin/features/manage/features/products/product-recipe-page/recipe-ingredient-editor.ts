import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsEmptyState } from '@app/shared/ui/empty-state/empty-state';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSelect } from '@app/shared/ui/select/select';
import type { Money } from '@app/shared/models/dto/common/money';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';

import { currencyOf, lineCostMicro, microToMoney, moneyToMicro } from './recipe-costing';
import {
  createRecipeRow,
  issuesForRow,
  validateRecipeRows,
  type RecipeRow,
  type RecipeRowIssues,
} from './recipe-rows';

/** The subset of a supply variant the editor needs. */
export interface RecipeVariantView {
  id: number;
  supplyName: string;
  categoryId: number;
  categoryName: string;
  unitAbbreviation: string;
  quantity: number;
  unitCost: Money;
  displayName: string;
}

/**
 * `app-recipe-ingredient-editor` — the recipe rows of a product or option.
 *
 * Behavior:
 *  - Search the supply-variant catalogue, filter by supply category and add a
 *    row. Already-used variants are excluded from the suggestions.
 *  - Each row can change its ingredient (which changes the unit, because the
 *    API keys the unit off the variant), edit the quantity as text and remove
 *    itself.
 *  - Zero, negative, non-numeric, over-precise and duplicate rows are reported
 *    inline (`aria-invalid` + `role="alert"`); the raw text is preserved so the
 *    user can correct it instead of the component silently clamping to 0.
 *  - An empty recipe is allowed; the page decides how to warn about it.
 *
 * The editor never saves: the parent owns the draft, the unsaved-changes guard
 * and the `PUT /v1/products/{id}` request.
 */
@Component({
  selector: 'app-recipe-ingredient-editor',
  templateUrl: './recipe-ingredient-editor.html',
  styleUrl: './recipe-ingredient-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RmsBadge, RmsEmptyState, RmsIconButton, RmsInput, RmsSelect, MoneyPipe],
})
export class RecipeIngredientEditor {
  private readonly host: ElementRef<HTMLElement> = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly rowsState = signal<RecipeRow[]>([]);
  private readonly variantsState = signal<RecipeVariantView[]>([]);

  @Input() set rows(value: RecipeRow[] | null | undefined) {
    this.rowsState.set(value ?? []);
  }
  get rows(): RecipeRow[] {
    return this.rowsState();
  }

  @Input() set variants(value: RecipeVariantView[] | null | undefined) {
    this.variantsState.set(value ?? []);
  }
  get variants(): RecipeVariantView[] {
    return this.variantsState();
  }

  @Input() disabled = false;
  @Input() showCategoryFilter = true;
  @Input() emptyTitle = 'Sin insumos en la receta';
  @Input() emptyMessage =
    'Busca un insumo arriba para agregarlo. Un producto sin receta tiene costo de material 0.';

  @Output() rowsChange = new EventEmitter<RecipeRow[]>();

  readonly search = signal('');
  readonly categoryId = signal<number | null>(null);

  private readonly variantById = computed(
    () => new Map(this.variantsState().map((variant) => [variant.id, variant])),
  );

  private readonly knownVariantIds = computed(
    () => new Set(this.variantsState().map((variant) => variant.id)),
  );

  readonly validation = computed(() =>
    validateRecipeRows(this.rowsState(), this.knownVariantIds()),
  );

  readonly usedVariantIds = computed(() => {
    const used = new Set<number>();
    for (const row of this.rowsState()) {
      if (row.supplyVariantId !== null) used.add(row.supplyVariantId);
    }
    return used;
  });

  readonly categoryOptions = computed(() => {
    const seen = new Map<number, string>();
    for (const variant of this.variantsState()) {
      if (!seen.has(variant.categoryId)) seen.set(variant.categoryId, variant.categoryName);
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });

  readonly variantOptions = computed(() =>
    this.variantsState().map((variant) => ({ label: variant.displayName, value: variant.id })),
  );

  readonly suggestions = computed(() => {
    const term = this.search().trim().toLowerCase();
    const category = this.categoryId();
    const used = this.usedVariantIds();
    const pool = this.variantsState().filter(
      (variant) => !used.has(variant.id) && (category === null || variant.categoryId === category),
    );
    if (term.length === 0) {
      // With no search text, a chosen category lists its first options; with no
      // filter at all, the catalogue is too large to dump into the page.
      return category === null ? [] : pool.slice(0, 8);
    }
    return pool.filter((variant) => variant.displayName.toLowerCase().includes(term)).slice(0, 8);
  });

  readonly hasQuery = computed(() => this.search().trim().length > 0 || this.categoryId() !== null);

  readonly searchHint = computed(() => {
    if (this.variantsState().length === 0) return 'Cargando catálogo de insumos…';
    if (this.hasQuery()) return '';
    return 'Escribe el nombre del insumo o elige una categoría.';
  });

  issuesFor(row: RecipeRow): RecipeRowIssues {
    return issuesForRow(this.validation(), row);
  }

  variantFor(row: RecipeRow): RecipeVariantView | null {
    if (row.supplyVariantId === null) return null;
    return this.variantById().get(row.supplyVariantId) ?? null;
  }

  variantName(row: RecipeRow): string {
    return this.variantFor(row)?.supplyName ?? 'Insumo sin seleccionar';
  }

  unitLabel(row: RecipeRow): string {
    const variant = this.variantFor(row);
    if (variant === null) return '—';
    return `${String(variant.quantity)} ${variant.unitAbbreviation}`;
  }

  unitCost(row: RecipeRow): { amount: string; currency: string } | null {
    const variant = this.variantFor(row);
    if (variant === null) return null;
    const micro = moneyToMicro(variant.unitCost);
    if (micro === null) return null;
    return microToMoney(micro, currencyOf(variant.unitCost));
  }

  hasMissingCost(row: RecipeRow): boolean {
    const variant = this.variantFor(row);
    return variant !== null && moneyToMicro(variant.unitCost) === null;
  }

  partialCost(row: RecipeRow): { amount: string; currency: string } | null {
    const variant = this.variantFor(row);
    if (variant === null) return null;
    const micro = lineCostMicro(row.quantity, variant.unitCost);
    return micro === null ? null : microToMoney(micro, currencyOf(variant.unitCost));
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  onCategoryChange(value: string | number | null): void {
    this.categoryId.set(typeof value === 'number' ? value : null);
  }

  onVariantChange(row: RecipeRow, value: string | number | null): void {
    const variantId = typeof value === 'number' ? value : null;
    this.replaceRow(row, { ...row, supplyVariantId: variantId });
  }

  onQuantityInput(row: RecipeRow, value: string): void {
    this.replaceRow(row, { ...row, quantity: value });
  }

  addVariant(variant: RecipeVariantView): void {
    if (this.disabled) return;
    this.commit([...this.rowsState(), createRecipeRow(variant.id, '1')]);
    this.search.set('');
    this.focusSearch();
  }

  addFirstSuggestion(): void {
    const suggestions = this.suggestions();
    if (suggestions.length > 0) this.addVariant(suggestions[0]);
  }

  removeRow(row: RecipeRow): void {
    if (this.disabled) return;
    this.commit(this.rowsState().filter((candidate) => candidate.key !== row.key));
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.suggestions().length > 0) {
      event.preventDefault();
      this.addFirstSuggestion();
      return;
    }
    if (event.key === 'ArrowDown') {
      const firstResult =
        this.host.nativeElement.querySelector<HTMLButtonElement>('[data-recipe-result]');
      if (firstResult !== null) {
        event.preventDefault();
        firstResult.focus();
      }
      return;
    }
    if (event.key === 'Escape') {
      this.search.set('');
    }
  }

  focusSearch(): void {
    const input = this.host.nativeElement.querySelector<HTMLInputElement>(
      '.ingredient-search input',
    );
    input?.focus();
  }

  private replaceRow(row: RecipeRow, next: RecipeRow): void {
    this.commit(
      this.rowsState().map((candidate) => (candidate.key === row.key ? next : candidate)),
    );
  }

  private commit(rows: RecipeRow[]): void {
    this.rowsState.set(rows);
    this.rowsChange.emit(rows);
  }
}
