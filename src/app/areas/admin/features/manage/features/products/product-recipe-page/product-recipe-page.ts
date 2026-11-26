import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Product } from '@app/core/services/products/product';
import { ProductOption as ProductOptionService } from '@app/core/services/product-option/product-option';
import { ProductImage } from '@app/core/services/product-image/product-image';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { ProductCache } from '../product-cache';

import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import type { ProductUpdateRequest } from '@app/shared/models/dto/products/product-update-request';
import type { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';
import type { ProductCostBreakdownResponse } from '@app/shared/models/dto/products/product-cost-breakdown-response';
import type { ProductPrepTimeResponse } from '@app/shared/models/dto/products/product-prep-time-response';
import type { ProductImageResponse } from '@app/shared/models/dto/products/product-image-response';
import type {
  ProductOption,
  ProductOptionRequest,
} from '@app/shared/models/dto/products/product-option';
import type { Money } from '@app/shared/models/dto/common/money';
import { toAmount } from '@app/shared/models/dto/common/money';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { getSelectionTypeConfig } from '@app/shared/lib/option-selection-type-helper/option-selection-type-helper';
import { fromApiString } from '@app/shared/lib/option-selection-type-mapper/option-selection-type-mapper';

import { RmsBadge } from '@app/shared/ui/badge/badge';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsCard } from '@app/shared/ui/card/card';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsSelect, type RmsSelectOption } from '@app/shared/ui/select/select';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';
import { RmsStatTile } from '@app/shared/ui/stat-tile/stat-tile';
import { TooltipModule } from 'primeng/tooltip';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';

import { RecipeIngredientEditor, type RecipeVariantView } from './recipe-ingredient-editor';
import { OptionGroupsManager } from '../option-groups-manager/option-groups-manager';
import { RecipeLaborMode, laborModeLabel } from './recipe-labor-mode';
import {
  currencyOf,
  decimalToScaled,
  formatAmountInput,
  formatPercent,
  hourlyRateMicro,
  laborForPreparation,
  lineCostMicro,
  marginOf,
  microToMoney,
  moneyToMicro,
  parseDecimal,
  suggestedPriceMicro,
  sumMicro,
} from './recipe-costing';
import {
  recipeRowsFromRecipe,
  recipeSnapshot,
  validateRecipeRows,
  type RecipeRow,
} from './recipe-rows';

/** Product fields the recipe page owns. Description and prep time are read-only. */
interface RecipeDraft {
  name: string;
  categoryId: number | null;
  areaId: number | null;
  salePrice: string;
  requiredWorkers: string;
  estimatedPrepMinutes: string;
  prepTimeMode: 'ESTIMATED' | 'REAL' | 'AUTO';
}

interface PageFailure {
  status: number;
  title: string;
  detail: string;
  forbidden: boolean;
  notFound: boolean;
}

interface OptionGroupView {
  id: number;
  name: string;
  selectionType: string;
  options: ProductOption[];
}

interface OptionEditorTarget {
  option: ProductOption;
  groupName: string;
  cost: Money | null;
  costed: boolean;
}

const EMPTY_DRAFT: RecipeDraft = {
  name: '',
  categoryId: null,
  areaId: null,
  salePrice: '',
  requiredWorkers: '1',
  estimatedPrepMinutes: '0',
  prepTimeMode: 'ESTIMATED',
};

/**
 * Product recipe and costing page (`/admin/manage/products/:id/recipe`).
 *
 * Contract with the API:
 *  - `GET /v1/products/{id}` returns the recipe; `PUT /v1/products/{id}` replaces
 *    the whole aggregate (there is no recipe-only endpoint, P3-BE-RL-12).
 *  - `GET /v1/products/{id}/cost` and `/cost-breakdown` are the server truth for
 *    material, labor, total and per-option costs.
 *  - Option recipes are read through the option-group endpoints and written with
 *    `PUT /v1/product-options/{id}`. Option-to-product associations use the
 *    dedicated `/products/{id}/options` endpoints.
 *  - `PUT /v1/products/{id}` preserves option associations when `optionIds` is
 *    omitted, so the recipe save no longer rewrites them (ADR-0001/0002).
 *
 * The page keeps `description` and `active` read-only. Preparation time is shown
 * but not edited here; the number of people required is editable because it
 * participates in the labor formula (ADR-0004).
 */
@Component({
  selector: 'app-product-recipe-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RmsBadge,
    RmsButton,
    RmsCard,
    RmsDialog,
    RmsInput,
    RmsPageHeader,
    RmsSelect,
    RmsSkeleton,
    RmsStatTile,
    TooltipModule,
    RecipeIngredientEditor,
    OptionGroupsManager,
    MoneyPipe,
  ],
  templateUrl: './product-recipe-page.html',
  styleUrl: './product-recipe-page.css',
})
export class ProductRecipePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(Product);
  private readonly productOptionService = inject(ProductOptionService);
  private readonly imageService = inject(ProductImage);
  private readonly cache = inject(ProductCache);
  private readonly laborModeService = inject(RecipeLaborMode);
  private readonly wsService = inject(WebSocket);
  private readonly destroyRef = inject(DestroyRef);

  private productId = 0;

  // ── Load state ───────────────────────────────────────────────────
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly failure = signal<PageFailure | null>(null);
  readonly product = signal<ProductResponse | null>(null);

  // ── Draft ────────────────────────────────────────────────────────
  readonly draft = signal<RecipeDraft>(EMPTY_DRAFT);
  readonly recipeRows = signal<RecipeRow[]>([]);
  private readonly baseline = signal('');
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal<string | null>(null);

  // ── Server cost ──────────────────────────────────────────────────
  readonly cost = signal<ProductCostResponse | null>(null);
  readonly breakdown = signal<ProductCostBreakdownResponse | null>(null);
  readonly costLoading = signal(false);
  readonly costError = signal<string | null>(null);
  readonly costLoadedAt = signal<Date | null>(null);
  readonly prepTime = signal<ProductPrepTimeResponse | null>(null);
  readonly prepTimeLoading = signal(false);
  readonly prepTimeError = signal<string | null>(null);

  // ── Options, images, labor mode ──────────────────────────────────
  readonly options = signal<ProductOption[]>([]);
  readonly optionsLoading = signal(true);
  readonly optionsError = signal<string | null>(null);
  readonly images = signal<ProductImageResponse[]>([]);
  readonly imageBusy = signal(false);
  readonly imageError = signal<string | null>(null);
  readonly laborMode = signal<string | null>(null);

  // ── Option recipe editor ─────────────────────────────────────────
  readonly optionEditorOpen = signal(false);
  readonly optionTarget = signal<OptionEditorTarget | null>(null);
  readonly optionRows = signal<RecipeRow[]>([]);
  readonly optionReplacementAck = signal(false);
  readonly optionSaving = signal(false);
  readonly optionError = signal<string | null>(null);

  readonly leaveDialogOpen = signal(false);

  // ── Reference data (shared cache) ────────────────────────────────
  readonly variants = computed<RecipeVariantView[]>(
    () => this.cache.referenceData.data()?.variants ?? [],
  );
  readonly variantsLoading = computed(() => this.cache.referenceData.isLoading());
  readonly variantsError = computed(() => this.cache.referenceData.error());
  readonly categories = computed(() => this.cache.referenceData.data()?.categories ?? []);
  readonly areas = computed(() => this.cache.referenceData.data()?.areas ?? []);

  readonly categoryOptions = computed(() =>
    this.categories().map((category) => ({ label: category.name, value: category.id })),
  );
  readonly areaOptions = computed(() =>
    this.areas().map((area) => ({ label: area.name, value: area.id })),
  );

  readonly variantById = computed(
    () => new Map(this.variants().map((variant) => [variant.id, variant])),
  );
  readonly knownVariantIds = computed(
    () => new Set(this.variants().map((variant) => variant.id)),
  );

  // ── Validation ───────────────────────────────────────────────────
  readonly recipeValidation = computed(() =>
    validateRecipeRows(this.recipeRows(), this.knownVariantIds()),
  );

  readonly nameError = computed(() =>
    this.draft().name.trim().length === 0 ? 'El nombre es obligatorio' : '',
  );
  readonly categoryError = computed(() =>
    this.draft().categoryId === null ? 'La categoría es obligatoria' : '',
  );
  readonly areaError = computed(() =>
    this.draft().areaId === null ? 'El área de preparación es obligatoria' : '',
  );

  readonly priceValue = computed(() => parseDecimal(this.draft().salePrice));
  readonly priceError = computed(() => {
    const raw = this.draft().salePrice.trim();
    const price = this.priceValue();
    if (raw.length === 0) return 'Indica el precio de venta';
    if (price === null) return 'Usa un número, por ejemplo 28000';
    if (price < 0) return 'El precio no puede ser negativo';
    if (price > 1_000_000_000) return 'El precio es demasiado alto';
    if (decimalToScaled(raw, 2) === null) {
      return 'Usa máximo 2 decimales y sin separador de miles';
    }
    return '';
  });

  readonly formErrors = computed(() => {
    const errors: string[] = [];
    if (this.nameError().length > 0) errors.push(this.nameError());
    if (this.categoryError().length > 0) errors.push(this.categoryError());
    if (this.areaError().length > 0) errors.push(this.areaError());
    if (this.priceError().length > 0) errors.push(this.priceError());
    if (this.workersError().length > 0) errors.push(this.workersError());
    if (this.estimatedMinutesError().length > 0) errors.push(this.estimatedMinutesError());
    errors.push(...this.recipeValidation().errors);
    if (this.variantsError() !== undefined) {
      errors.push('No se pudo cargar el catálogo de insumos: no se puede validar la receta.');
    }
    return errors;
  });

  private draftSnapshot(): string {
    const draft = this.draft();
    const price = this.priceValue();
    return JSON.stringify({
      name: draft.name.trim(),
      categoryId: draft.categoryId,
      areaId: draft.areaId,
      salePrice: price === null ? draft.salePrice.trim() : String(price),
      requiredWorkers: this.workersValue() ?? draft.requiredWorkers.trim(),
      estimatedPrepMinutes:
        this.estimatedMinutesValue() ?? draft.estimatedPrepMinutes.trim(),
      prepTimeMode: draft.prepTimeMode,
      recipe: recipeSnapshot(this.recipeRows()),
    });
  }

  readonly dirty = computed(
    () => this.state() === 'ready' && this.baseline().length > 0 && this.draftSnapshot() !== this.baseline(),
  );

  readonly canSave = computed(
    () =>
      this.dirty() &&
      !this.saving() &&
      this.formErrors().length === 0 &&
      !this.optionsLoading(),
  );

  // ── Live cost ────────────────────────────────────────────────────
  readonly currency = computed(() =>
    currencyOf(this.cost()?.totalCost ?? this.product()?.basePrice),
  );

  readonly missingCostCount = computed(
    () =>
      this.recipeRows().filter((row) => {
        if (row.supplyVariantId === null) return false;
        const variant = this.variantById().get(row.supplyVariantId);
        return variant !== undefined && moneyToMicro(variant.unitCost) === null;
      }).length,
  );

  readonly materialMicro = computed(() =>
    sumMicro(
      this.recipeRows().map((row) => {
        if (row.supplyVariantId === null) return null;
        const variant = this.variantById().get(row.supplyVariantId);
        return variant === undefined ? null : lineCostMicro(row.quantity, variant.unitCost);
      }),
    ),
  );

  readonly workersValue = computed(() => {
    const raw = this.draft().requiredWorkers.trim();
    if (raw.length === 0) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
  });

  readonly workersError = computed(() => {
    const raw = this.draft().requiredWorkers.trim();
    if (raw.length === 0) return 'Indica cuántas personas preparan el producto';
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) return 'Usa un número entero de personas';
    if (parsed < 1) return 'Debe haber al menos una persona';
    if (parsed > 50) return 'Máximo 50 personas';
    return '';
  });

  readonly serverWorkers = computed(() => this.product()?.requiredWorkers ?? 1);

  readonly estimatedMinutesValue = computed(() => {
    const raw = this.draft().estimatedPrepMinutes.trim();
    if (raw.length === 0) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  });

  readonly estimatedMinutesError = computed(() => {
    const raw = this.draft().estimatedPrepMinutes.trim();
    if (raw.length === 0) return 'Indica el tiempo estimado en minutos';
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 'Usa un número de minutos';
    if (parsed < 0) return 'El tiempo no puede ser negativo';
    if (parsed > 600) return 'Máximo 600 minutos';
    return '';
  });

  readonly prepTimeModeOptions: RmsSelectOption[] = [
    { label: 'Estimado (base editable)', value: 'ESTIMATED' },
    { label: 'Real medido', value: 'REAL' },
    { label: 'Automático: real si hay datos', value: 'AUTO' },
  ];

  readonly realPrepLabel = computed(() => {
    const prep = this.prepTime();
    if (prep?.realPrepMinutes == null) return 'Sin datos';
    return `${String(Number(prep.realPrepMinutes.toFixed(1)))} min · ${String(prep.realPrepSampleCount)} muestra(s)`;
  });

  readonly realPrepAvailable = computed(() => {
    const prep = this.prepTime();
    return prep !== null
      && prep.realPrepMinutes !== null
      && prep.realPrepSampleCount >= prep.minimumSamples;
  });

  readonly effectivePrepMinutes = computed(() => {
    const draft = this.draft();
    const estimated = this.estimatedMinutesValue();
    const real = this.prepTime()?.realPrepMinutes ?? null;
    if (draft.prepTimeMode === 'REAL' && real !== null && this.realPrepAvailable()) return real;
    if (draft.prepTimeMode === 'AUTO' && real !== null && this.realPrepAvailable()) return real;
    return estimated;
  });

  readonly effectivePrepSource = computed<'ESTIMATED' | 'REAL'>(() => {
    const draft = this.draft();
    const real = this.prepTime()?.realPrepMinutes ?? null;
    return draft.prepTimeMode !== 'ESTIMATED' && real !== null && this.realPrepAvailable()
      ? 'REAL'
      : 'ESTIMATED';
  });

  readonly laborMicro = computed(() => {
    const cost = this.cost();
    if (cost === null) return null;
    const serverLabor = moneyToMicro(cost.laborCost);
    const serverMinutes =
      cost.prepTimeUsedMinutes ?? this.product()?.estimatedPrepMinutes ?? null;
    return laborForPreparation(
      serverLabor,
      serverMinutes,
      this.serverWorkers(),
      this.effectivePrepMinutes(),
      this.workersValue() ?? this.serverWorkers(),
    );
  });

  readonly totalMicro = computed(() => this.materialMicro() + (this.laborMicro() ?? 0n));
  readonly totalPartial = computed(
    () => this.costError() !== null || this.cost() === null || this.missingCostCount() > 0,
  );

  readonly materialMoney = computed(() => microToMoney(this.materialMicro(), this.currency()));
  readonly laborMoney = computed(() => {
    const labor = this.laborMicro();
    return labor === null ? null : microToMoney(labor, this.currency());
  });
  readonly totalMoney = computed(() => microToMoney(this.totalMicro(), this.currency()));

  readonly serverMaterialMicro = computed(() => {
    const cost = this.cost();
    return cost === null ? null : moneyToMicro(cost.materialCost);
  });
  readonly serverTotalMoney = computed(() => this.cost()?.totalCost ?? null);

  readonly materialDiffers = computed(() => {
    const server = this.serverMaterialMicro();
    return server !== null && server !== this.materialMicro();
  });

  readonly materialPeriod = computed(() => {
    if (this.costLoading()) return 'Consultando el costo guardado…';
    if (this.missingCostCount() > 0) {
      const count = this.missingCostCount();
      return `${String(count)} ${count === 1 ? 'insumo sin costo unitario' : 'insumos sin costo unitario'}: material parcial`;
    }
    if (this.materialDiffers()) return 'Difiere del material guardado';
    return 'Igual al material guardado';
  });

  readonly hourlyRateMoney = computed(() => {
    const cost = this.cost();
    const serverLabor = cost === null ? null : moneyToMicro(cost.laborCost);
    const micro = hourlyRateMicro(
      serverLabor,
      this.cost()?.prepTimeUsedMinutes ?? this.product()?.estimatedPrepMinutes ?? null,
      this.serverWorkers(),
    );
    return micro === null ? null : microToMoney(micro, this.currency());
  });

  readonly laborPeriod = computed(() => {
    const minutes = this.effectivePrepMinutes();
    if (minutes === null || minutes <= 0) return 'El producto no tiene tiempo de preparación';
    const workers = this.workersValue() ?? this.serverWorkers();
    const source = this.effectivePrepSource() === 'REAL' ? 'tiempo real' : 'tiempo estimado';
    return `${String(Number(minutes.toFixed(1)))} min (${source}) · ${String(workers)} persona(s)`;
  });

  readonly laborTooltip = computed(() => {
    const minutes = this.effectivePrepMinutes();
    const workers = this.workersValue() ?? this.serverWorkers();
    const rate = this.hourlyRateMoney();
    const mode = this.laborModeText();
    const real = this.prepTime();
    const formula =
      minutes !== null && minutes > 0 && rate !== null
        ? `Mano de obra = (${String(Number(minutes.toFixed(1)))} min ÷ 60) × ${this.moneyText(rate)}/h por persona × ${String(workers)} persona(s).`
        : 'Mano de obra = (minutos de preparación ÷ 60) × tarifa del área por persona × personas.';
    const realText =
      real === null
        ? 'Todavía no hay suficientes tiempos reales medidos.'
        : `Tiempo real: ${real.realPrepMinutes === null ? 'sin datos' : String(Number(real.realPrepMinutes.toFixed(1))) + ' min'} · ${String(real.realPrepSampleCount)} muestra(s); se requieren ${String(real.minimumSamples)}.`;
    return `${formula} ${realText} El costo usa ${this.effectivePrepSource() === 'REAL' ? 'el tiempo real' : 'el tiempo estimado'}. La tarifa se obtiene de la nómina o de los salarios de los trabajadores del área. Modo de tarifa: ${mode}.`;
  });

  readonly totalPeriod = computed(() => {
    if (this.costLoading()) return 'Recalculando…';
    if (this.dirty()) return 'Estimado con los cambios sin guardar';
    if (this.totalPartial()) return 'Parcial: falta algún costo de material o de mano de obra';
    return 'Coincide con el costo guardado';
  });

  readonly priceMicro = computed(() => decimalToScaled(this.draft().salePrice, 6));
  readonly margin = computed(() => {
    const price = this.priceMicro();
    return price === null || price <= 0n ? null : marginOf(price, this.totalMicro());
  });
  readonly marginLabel = computed(() => formatPercent(this.margin()?.percent ?? null));
  readonly marginPeriod = computed(() => {
    const margin = this.margin();
    if (margin === null) return 'Define el precio de venta';
    return `Costo primo ${formatPercent(margin.foodCostPercent)}`;
  });
  readonly marginNegative = computed(() => {
    const price = this.priceMicro();
    return price !== null && price > 0n && price < this.totalMicro();
  });

  readonly suggestedMicro = computed(() => suggestedPriceMicro(this.totalMicro()));
  readonly suggestedMoney = computed(() => microToMoney(this.suggestedMicro(), this.currency()));
  readonly canUseSuggested = computed(
    () => this.suggestedMicro() > 0n && this.priceMicro() !== this.suggestedMicro(),
  );

  readonly updatedLabel = computed(() => {
    const loadedAt = this.costLoadedAt();
    if (loadedAt === null) return '';
    return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(loadedAt);
  });

  readonly projectedEffectiveMoney = computed(
    () => this.breakdown()?.projectedEffectiveCost ?? null,
  );
  readonly projectedOptionMoney = computed(() => this.breakdown()?.projectedOptionCost ?? null);
  readonly baseCostMoney = computed(() => this.breakdown()?.baseCost ?? null);

  readonly warnings = computed(() => {
    const warnings: string[] = [];
    if (this.recipeRows().length === 0) {
      warnings.push('La receta está vacía: el costo de material será 0.');
    }
    if (this.missingCostCount() > 0) {
      warnings.push(
        'Hay insumos sin costo unitario configurado; el costo de material es parcial.',
      );
    }
    const minutes = this.effectivePrepMinutes();
    if (minutes === null || minutes <= 0) {
      warnings.push('El producto no tiene tiempo de preparación: el costo de mano de obra es 0.');
    }
    if (this.priceValue() === 0) {
      warnings.push('El precio de venta es 0: no se puede calcular el margen.');
    }
    return warnings;
  });

  // ── Options ──────────────────────────────────────────────────────
  private readonly optionCostById = computed(() => {
    const map = new Map<number, Money>();
    for (const option of this.breakdown()?.options ?? []) {
      map.set(option.optionId, option.cost);
    }
    return map;
  });

  readonly optionGroups = computed<OptionGroupView[]>(() => {
    const groups = new Map<number, OptionGroupView>();
    for (const option of this.options()) {
      const existing = groups.get(option.optionGroupId);
      if (existing === undefined) {
        groups.set(option.optionGroupId, {
          id: option.optionGroupId,
          name: option.optionGroupName,
          selectionType: option.categorySelectionType ?? 'SINGLE_CHOICE',
          options: [option],
        });
      } else {
        existing.options.push(option);
      }
    }
    return [...groups.values()];
  });

  readonly costedCount = computed(
    () => this.options().filter((option) => this.optionCosted(option)).length,
  );
  readonly uncostedCount = computed(() => this.options().length - this.costedCount());

  // ── Option editor validation ─────────────────────────────────────
  readonly optionValidation = computed(() =>
    validateRecipeRows(this.optionRows(), this.knownVariantIds()),
  );
  readonly optionNeedsAck = computed(() => this.optionTarget()?.costed === true);

  readonly optionDialogHeader = computed(() => {
    const target = this.optionTarget();
    return target === null ? '' : `Receta de la opción: ${target.option.name}`;
  });
  readonly canSaveOption = computed(() => {
    const target = this.optionTarget();
    if (target === null || this.optionSaving()) return false;
    if (this.optionRows().length === 0) return false;
    if (!this.optionValidation().valid) return false;
    return !target.costed || this.optionReplacementAck();
  });

  // ── Lifecycle ────────────────────────────────────────────────────
  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    const id = rawId === null ? Number.NaN : Number(rawId);
    if (!Number.isFinite(id) || id <= 0) {
      void this.router.navigate(['/admin/manage/products']);
      return;
    }
    this.productId = id;
    this.cache.referenceData.loadIfStale();
    this.loadLaborMode();
    this.loadProduct(id);
  }

  private loadProduct(id: number): void {
    this.state.set('loading');
    this.failure.set(null);
    this.productService
      .findProduct(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.applyProduct(product);
          this.state.set('ready');
          this.loadCosts();
          this.loadOptions(id);
          this.loadImages(id);
        },
        error: (err: unknown) => {
          this.failure.set(this.toFailure(err));
          this.state.set('error');
        },
      });
  }

  retry(): void {
    if (this.productId > 0) this.loadProduct(this.productId);
  }

  retryReferenceData(): void {
    this.cache.referenceData.refresh();
  }

  retryOptions(): void {
    if (this.productId > 0) this.loadOptions(this.productId);
  }

  retryCosts(): void {
    this.loadCosts();
  }

  private loadLaborMode(): void {
    this.laborModeService
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mode) => {
        this.laborMode.set(mode);
      });
  }

  private applyProduct(product: ProductResponse): void {
    this.product.set(product);
    this.draft.set({
      name: product.name,
      categoryId: product.categoryId,
      areaId: product.areaId,
      salePrice: formatAmountInput(product.basePrice),
      requiredWorkers: String(product.requiredWorkers ?? 1),
      estimatedPrepMinutes: String(product.estimatedPrepMinutes ?? 0),
      prepTimeMode: product.prepTimeMode ?? 'ESTIMATED',
    });
    this.recipeRows.set(recipeRowsFromRecipe(product.recipe));
    this.baseline.set(this.draftSnapshot());
    this.saveError.set(null);
    this.saveSuccess.set(null);
  }

  private loadCosts(silent = false): void {
    const id = this.product()?.id;
    if (id === undefined) return;
    if (!silent) {
      this.costLoading.set(true);
      this.prepTimeLoading.set(true);
    }
    this.costError.set(null);

    forkJoin({
      prepTime: this.productService.getPrepTime(id).pipe(
        catchError((err: unknown) => {
          this.prepTimeError.set(this.problemMessage(err, 'No se pudieron leer los tiempos reales'));
          return of(null);
        }),
      ),
      cost: this.productService.getCost(id).pipe(
        catchError((err: unknown) => {
          this.costError.set(this.problemMessage(err, 'No se pudo calcular el costo del producto'));
          return of(null);
        }),
      ),
      breakdown: this.productService.getCostBreakdown(id).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ prepTime, cost, breakdown }) => {
        if (prepTime !== null) this.prepTime.set(prepTime);
        if (cost !== null) {
          this.cost.set(cost);
          this.costLoadedAt.set(new Date());
        }
        if (breakdown !== null) this.breakdown.set(breakdown);
        this.costLoading.set(false);
        this.prepTimeLoading.set(false);
      });
  }

  private loadOptions(id: number, silent = false): void {
    if (!silent) this.optionsLoading.set(true);
    this.optionsError.set(null);
    this.productService
      .getOptions(id)
      .pipe(
        catchError((err: unknown) => {
          this.optionsError.set(
            this.problemMessage(err, 'No se pudieron cargar las opciones del producto'),
          );
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((options) => {
        if (options !== null) this.options.set(options);
        this.optionsLoading.set(false);
      });
  }

  private loadImages(id: number): void {
    this.imageService
      .getImages(id)
      .pipe(
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((images) => {
        this.images.set(images);
      });
  }

  // ── Draft edits ──────────────────────────────────────────────────
  updateName(value: string): void {
    this.draft.update((draft) => ({ ...draft, name: value }));
    this.clearSaveState();
  }

  updateCategory(value: string | number | null): void {
    this.draft.update((draft) => ({
      ...draft,
      categoryId: typeof value === 'number' ? value : null,
    }));
    this.clearSaveState();
  }

  updateArea(value: string | number | null): void {
    this.draft.update((draft) => ({
      ...draft,
      areaId: typeof value === 'number' ? value : null,
    }));
    this.clearSaveState();
  }

  updatePrice(value: string): void {
    this.draft.update((draft) => ({ ...draft, salePrice: value }));
    this.clearSaveState();
  }

  updateRequiredWorkers(value: string): void {
    this.draft.update((draft) => ({ ...draft, requiredWorkers: value }));
    this.clearSaveState();
  }

  updateEstimatedPrepMinutes(value: string): void {
    this.draft.update((draft) => ({ ...draft, estimatedPrepMinutes: value }));
    this.clearSaveState();
  }

  updatePrepTimeMode(value: string | number | null): void {
    const mode = value === 'REAL' || value === 'AUTO' ? value : 'ESTIMATED';
    this.draft.update((draft) => ({ ...draft, prepTimeMode: mode }));
    this.clearSaveState();
  }

  updateRecipeRows(rows: RecipeRow[]): void {
    this.recipeRows.set(rows);
    this.clearSaveState();
  }

  useSuggestedPrice(): void {
    const suggested = this.suggestedMicro();
    if (suggested <= 0n) return;
    this.updatePrice(formatAmountInput(microToMoney(suggested, this.currency())));
  }

  discardChanges(): void {
    const product = this.product();
    if (product === null) return;
    this.applyProduct(product);
  }

  private clearSaveState(): void {
    this.saveError.set(null);
    this.saveSuccess.set(null);
  }

  // ── Save product ─────────────────────────────────────────────────
  save(): void {
    const product = this.product();
    const price = this.priceValue();
    const draft = this.draft();
    if (product === null || price === null) return;
    if (draft.categoryId === null || draft.areaId === null) return;
    if (!this.canSave()) return;

    this.saving.set(true);
    this.clearSaveState();

    const request: ProductUpdateRequest = {
      name: draft.name.trim(),
      description: product.description,
      basePrice: price,
      categoryId: draft.categoryId,
      areaId: draft.areaId,
      requiredWorkers: this.workersValue() ?? 1,
      estimatedPrepMinutes: this.estimatedMinutesValue() ?? 0,
      prepTimeMode: this.draft().prepTimeMode,
      recipe: this.recipeValidation().payload,
      // Option associations are owned by the option-groups manager through
      // dedicated endpoints; omitting optionIds makes the API preserve them.
    };

    this.productService
      .updateProduct(product.id, request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => this.productService.findProduct(product.id)),
        catchError((err: unknown) => {
          this.saving.set(false);
          this.saveError.set(this.problemMessage(err, 'No se pudieron guardar los cambios'));
          return EMPTY;
        }),
      )
      .subscribe((updated) => {
        this.applyProduct(updated);
        this.saving.set(false);
        this.saveSuccess.set(
          'Cambios guardados. El costo guardado se recalculó con la nueva receta.',
        );
        this.cache.invalidateProductList();
        this.wsService.emitCacheInvalidation('products', 'update', product.id);
        this.loadCosts(true);
        this.loadOptions(product.id, true);
      });
  }

  // ── Option recipes ───────────────────────────────────────────────
  onOptionsChanged(): void {
    if (this.productId > 0) {
      this.loadCosts(true);
      this.loadOptions(this.productId, true);
    }
  }

  optionCost(option: ProductOption): Money | null {
    return this.optionCostById().get(option.id) ?? option.cost ?? null;
  }

  optionCosted(option: ProductOption): boolean {
    const micro = moneyToMicro(this.optionCost(option));
    return micro !== null && micro > 0n;
  }

  optionCostLabel(option: ProductOption): string {
    if (this.optionCosted(option)) return 'Con costo';
    return 'Sin costo';
  }

  optionCostTone(option: ProductOption): 'success' | 'warning' {
    return this.optionCosted(option) ? 'success' : 'warning';
  }

  selectionLabel(selectionType: string): string {
    return getSelectionTypeConfig(fromApiString(selectionType)).label;
  }

  openOptionEditor(group: OptionGroupView, option: ProductOption): void {
    this.optionTarget.set({
      option,
      groupName: group.name,
      cost: this.optionCost(option),
      costed: this.optionCosted(option),
    });
    this.optionRows.set([]);
    this.optionReplacementAck.set(false);
    this.optionError.set(null);
    this.optionEditorOpen.set(true);
  }

  onOptionDialogVisible(visible: boolean): void {
    this.optionEditorOpen.set(visible);
    if (!visible) this.resetOptionEditor();
  }

  closeOptionEditor(): void {
    if (this.optionSaving()) return;
    this.optionEditorOpen.set(false);
    this.resetOptionEditor();
  }

  private resetOptionEditor(): void {
    this.optionTarget.set(null);
    this.optionRows.set([]);
    this.optionReplacementAck.set(false);
    this.optionError.set(null);
  }

  updateOptionRows(rows: RecipeRow[]): void {
    this.optionRows.set(rows);
  }

  updateOptionAck(value: boolean): void {
    this.optionReplacementAck.set(value);
  }

  saveOptionRecipe(): void {
    const target = this.optionTarget();
    if (target === null || !this.canSaveOption()) return;

    this.optionSaving.set(true);
    this.optionError.set(null);

    const request: ProductOptionRequest = {
      name: target.option.name,
      optionGroupId: target.option.optionGroupId,
      recipe: this.optionValidation().payload,
    };

    this.productOptionService
      .updateOption(target.option.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const productId = this.product()?.id;
          this.optionSaving.set(false);
          this.optionEditorOpen.set(false);
          this.resetOptionEditor();
          this.saveError.set(null);
          this.saveSuccess.set(`Receta de la opción «${target.option.name}» guardada.`);
          this.wsService.emitCacheInvalidation('products', 'update', productId);
          if (productId !== undefined) {
            this.loadCosts(true);
            this.loadOptions(productId, true);
          }
        },
        error: (err: unknown) => {
          this.optionSaving.set(false);
          this.optionError.set(
            this.problemMessage(err, 'No se pudo guardar la receta de la opción'),
          );
        },
      });
  }

  // ── Images ───────────────────────────────────────────────────────
  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) return;

    const productId = this.product()?.id;
    if (productId === undefined) return;

    this.imageBusy.set(true);
    this.imageError.set(null);
    this.imageService
      .uploadImage(productId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          const image = result.image;
          if (image !== undefined) this.images.update((images) => [...images, image]);
          this.imageBusy.set(false);
        },
        error: (err: unknown) => {
          this.imageBusy.set(false);
          this.imageError.set(this.problemMessage(err, 'No se pudo subir la imagen'));
        },
      });
  }

  deleteImage(imageId: number): void {
    this.imageBusy.set(true);
    this.imageError.set(null);
    this.imageService
      .deleteImage(imageId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.images.update((images) => images.filter((image) => image.id !== imageId));
          this.imageBusy.set(false);
        },
        error: (err: unknown) => {
          this.imageBusy.set(false);
          this.imageError.set(this.problemMessage(err, 'No se pudo eliminar la imagen'));
        },
      });
  }

  get primaryImage(): ProductImageResponse | null {
    return this.images()[0] ?? null;
  }

  get monogram(): string {
    const name = this.draft().name.trim();
    if (name.length === 0) return '?';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  }

  // ── Navigation and unsaved-changes guard ─────────────────────────
  /** Public for a future `canDeactivate` route guard; the Shell lane owns routes. */
  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  goBack(): void {
    if (this.dirty()) {
      this.leaveDialogOpen.set(true);
      return;
    }
    void this.router.navigate(['/admin/manage/products']);
  }

  cancelLeave(): void {
    this.leaveDialogOpen.set(false);
  }

  onLeaveDialogVisible(visible: boolean): void {
    this.leaveDialogOpen.set(visible);
  }

  leaveWithoutSaving(): void {
    this.leaveDialogOpen.set(false);
    this.baseline.set(this.draftSnapshot());
    void this.router.navigate(['/admin/manage/products']);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.dirty()) return;
    event.preventDefault();
  }

  // ── Helpers ──────────────────────────────────────────────────────
  laborModeText(): string {
    return laborModeLabel(this.laborMode());
  }

  private moneyText(value: Money): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: this.currency(),
      maximumFractionDigits: 0,
    }).format(toAmount(value));
  }

  private toFailure(err: unknown): PageFailure {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const detail = extractProblemDetail(err) ?? this.fallbackDetail(status);
    return {
      status,
      title:
        status === 403
          ? 'Sin permiso para ver esta receta'
          : status === 404
            ? 'Producto no encontrado'
            : 'No se pudo cargar la receta',
      detail,
      forbidden: status === 403,
      notFound: status === 404,
    };
  }

  private fallbackDetail(status: number): string {
    if (status === 403) {
      return 'Tu rol no tiene acceso a la receta y el costeo de productos.';
    }
    if (status === 404) {
      return 'El producto no existe o fue eliminado.';
    }
    if (status === 0) {
      return 'No hay conexión con el servidor. Revisa la red e intenta de nuevo.';
    }
    return 'El servidor respondió con un error inesperado.';
  }

  private problemMessage(err: unknown, fallback: string): string {
    const detail = extractProblemDetail(err);
    if (detail !== null) return detail;
    if (err instanceof HttpErrorResponse) {
      if (err.status === 403) return 'No tienes permiso para modificar recetas.';
      if (err.status === 404) return 'El producto o la opción ya no existe.';
      if (err.status === 409) return 'El servidor rechazó el cambio por un conflicto de datos.';
      if (err.status === 0) return 'No hay conexión con el servidor.';
      if (err.status >= 500) return 'Error del servidor. Intenta de nuevo en unos minutos.';
    }
    return fallback;
  }
}
