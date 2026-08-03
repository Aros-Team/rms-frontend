import { Component, inject, OnInit, signal, computed, effect, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, FormGroup, FormArray, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { of, EMPTY, forkJoin, merge, Observable } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

import { Product } from '@app/core/services/products/product';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { ProductCache } from './product-cache';
import { LazyLoad } from '@app/core/directives/lazy-load/lazy-load.directive';
import { ProductOption } from '@app/core/services/product-option/product-option';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { OptionGroup } from '@app/core/services/option-group/option-group';
import { OptionsChangedPayload } from './step3-options/step3-options';
import { Step3Options } from './step3-options/step3-options';
import { mapHttpError } from '@app/shared/lib/http-error-mapper/http-error-mapper';
import { HttpErrorResponse } from '@angular/common/http';

import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductOption as ProductOptionDTO, ProductOptionResponse } from '@app/shared/models/dto/products/product-option';
import { ProductOptionCreateRequest, RecipeItemRequest } from '@app/shared/models/dto/products/product-create-request';
import { ProductImage } from '@app/core/services/product-image/product-image';
import { ProductImageResponse } from '@app/shared/models/dto/products/product-image-response';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';
import { OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';

import { SearchInput as SearchInputComponent } from '@app/shared/components/search-input/search-input';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressBarModule } from 'primeng/progressbar';
import { ImageModule } from 'primeng/image';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService, ConfirmationService } from 'primeng/api';
import { TableSkeleton } from '@shared/skeletons/table-skeleton/table-skeleton';
import { NewOptionDialog } from './componentes/new-option-dialog/new-option-dialog';
import { PrepTimeDialog, type PrepTimeEstimate } from './componentes/prep-time-dialog/prep-time-dialog';
import { ProductDetailDialog } from './componentes/product-detail-dialog/product-detail-dialog';

// Wizard steps: 1=basic data+image, 2=insumos, 3=options, 4=finalize
type WizardStep = 1 | 2 | 3 | 4 | 5;

/** A new image held in memory until the user clicks Finalizar. */
interface StagedImage {
  file: File;
  previewUrl: string;
}

/** UI-facing image representation. Existing images carry the server id;
 *  staged new images use a negative synthetic id so the template can
 *  distinguish them. */
interface PreviewImage {
  id: number;
  mobileUrl: string;
  tabletUrl: string;
  desktopUrl: string;
  originalName: string;
  size: number;
  createdAt: string;
  staged: boolean;
}

interface RecipeCostRow {
  supplyVariantId: number | null;
  supplyName: string;
  unitLabel: string;
  unitCost: number | null;
  requiredQuantity: number;
  partial: number;
}

interface OptionFormValue {
  id: number | null;
  name: string;
  optionCategoryId: number | null;
  recipe: RecipeItemRequest[];
  isExisting: boolean;
}

@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    IftaLabelModule,
    DialogModule,
    InputNumberModule,
    ToastModule,
    ToggleSwitch,
    TagModule,
    DividerModule,
    SkeletonModule,
    MessageModule,
    TooltipModule,
    LazyLoad,
    TableSkeleton,
    FileUploadModule,
    ProgressBarModule,
    ImageModule,
    ConfirmPopupModule,
    NewOptionDialog,
    PrepTimeDialog,
    ProductDetailDialog,
    SearchInputComponent,
    Step3Options,
  ],
  templateUrl: './products.html',
  providers: [MessageService, ConfirmationService],
})
export class Products implements OnInit {
  private fb = inject(FormBuilder);
  private productService = inject(Product);
  private productOptionService = inject(ProductOption);
  private masterDataService = inject(MasterData);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private logger = inject(Logging);
  private wsService = inject(WebSocket);
  readonly cache = inject(ProductCache);
  readonly imageService = inject(ProductImage);
  private optionGroupService = inject(OptionGroup);

  title = 'Carta de Productos';
  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

  // Table - usando cache service
  filterCategories = new FormControl<number[]>([], []);

  // Table data - computed from cache with override support
  private _productsOverride = signal<ProductResponse[] | undefined>(undefined);
  products = computed(() => this._productsOverride() ?? this.cache.products.data()?.content ?? undefined);
  totalPages = computed(() => this.cache.products.data()?.totalPages ?? 0);
  currentPage = signal(0);
  pageSize = signal(6);
  includeInactive = signal(false);

  // Reference data - computed from cache with override support
  private _allProductOptionsOverride = signal<ProductOptionResponse[] | undefined>(undefined);
  areas = computed(() => this.cache.referenceData.data()?.areas ?? []);
  categories = computed(() => this.cache.referenceData.data()?.categories ?? []);
  optionCategories = computed(() => this.cache.referenceData.data()?.optionCategories ?? []);
  supplyVariantOptions = computed(() => this.cache.referenceData.data()?.variants ?? []);
  allProductOptions = computed(() => this._allProductOptionsOverride() ?? this.cache.referenceData.data()?.productOptions ?? []);

  // Supply search for step 2 autocomplete
  supplySearchTerm = signal('');
  readonly filteredSuggestions = computed(() => {
    const term = this.supplySearchTerm().toLowerCase().trim();
    if (term.length < 1) return [];
    const all = this.supplyVariantOptions();
    // Exclude variants already in the recipe
    const usedIds = new Set<number>();
    for (const g of this.existingRecipe.controls) {
      const id = (g.value as { supplyVariantId?: number | null }).supplyVariantId;
      if (id != null) usedIds.add(id);
    }
    for (const g of this.baseRecipe.controls) {
      const id = (g.value as { supplyVariantId?: number | null }).supplyVariantId;
      if (id != null) usedIds.add(id);
    }
    return all
      .filter(v => !usedIds.has(v.id) && v.displayName.toLowerCase().includes(term))
      .slice(0, 8);
  });

  // Estados de carga
  productsLoading = computed(() => this.cache.products.isLoading());
  referenceDataLoading = computed(() => this.cache.referenceData.isLoading());

  // Supply category filter maps (per recipe row)
  private baseRecipeCategoryMap = new Map<number, number | null>();
  private optionRecipeCategoryMap = new Map<string, number | null>();

  supplyCategories = computed(() => {
    const seen = new Set<number>();
    return this.supplyVariantOptions()
      .filter(v => { if (seen.has(v.categoryId)) return false; seen.add(v.categoryId); return true; })
      .map(v => ({ id: v.categoryId, name: v.categoryName }));
  });

  getBaseRecipeCategory(i: number): number | null {
    return this.baseRecipeCategoryMap.get(i) ?? null;
  }

  setBaseRecipeCategory(i: number, catId: number | null): void {
    this.baseRecipeCategoryMap.set(i, catId);
    this.baseRecipe.at(i).get('supplyVariantId')?.setValue(null);
  }

  filteredVariantsForBaseRecipe(i: number): (SupplyVariantResponse & { displayName: string })[] {
    const catId = this.baseRecipeCategoryMap.get(i) ?? null;
    return catId ? this.supplyVariantOptions().filter(v => v.categoryId === catId) : this.supplyVariantOptions();
  }

  getOptionRecipeCategory(optIdx: number, riIdx: number): number | null {
    return this.optionRecipeCategoryMap.get(`${String(optIdx)}-${String(riIdx)}`) ?? null;
  }

  setOptionRecipeCategory(optIdx: number, riIdx: number, catId: number | null): void {
    this.optionRecipeCategoryMap.set(`${String(optIdx)}-${String(riIdx)}`, catId);
    this.getOptionRecipe(optIdx).at(riIdx).get('supplyVariantId')?.setValue(null);
  }

  filteredVariantsForOptionRecipe(optIdx: number, riIdx: number): (SupplyVariantResponse & { displayName: string })[] {
    const catId = this.optionRecipeCategoryMap.get(`${String(optIdx)}-${String(riIdx)}`) ?? null;
    return catId ? this.supplyVariantOptions().filter(v => v.categoryId === catId) : this.supplyVariantOptions();
  }

  getExistingRecipeCategory(i: number): number | null {
    const rowId = this.existingRecipeRowIds[i];
    return this.existingRecipeCategoryMap.get(rowId) ?? null;
  }

  setExistingRecipeCategory(i: number, catId: number | null): void {
    const rowId = this.existingRecipeRowIds[i];
    this.existingRecipeCategoryMap.set(rowId, catId);
    this.existingRecipe.at(i).get('supplyVariantId')?.setValue(null);
  }

  filteredVariantsForExistingRecipe(i: number): (SupplyVariantResponse & { displayName: string })[] {
    const rowId = this.existingRecipeRowIds[i];
    const catId = this.existingRecipeCategoryMap.get(rowId) ?? null;
    return catId ? this.supplyVariantOptions().filter(v => v.categoryId === catId) : this.supplyVariantOptions();
  }

  // Modal state
  modalIsOpen = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  currentStep = signal<WizardStep>(1);
  isSubmitting = signal(false);
  createdProduct = signal<ProductResponse | null>(null);
  existingOptions = signal<ProductOptionDTO[]>([]);
  optionGroups = signal<OptionGroupResponse[]>([]);
  existingRecipe: FormArray = this.fb.array([]);
  private existingRecipeCategoryMap = new Map<number, number | null>();
  private existingRecipeRowIds: number[] = [];
  private nextExistingRecipeRowId = 1;

  // Detail dialog
  detailDialogOpen = signal(false);
  detailProduct = signal<ProductResponse | null>(null);

  // Wizard images state
  wizardProductImages = signal<ProductImageResponse[]>([]);
  wizardImagesLoading = signal(false);

  /** Per-product timestamp of the last image mutation in this session.
   *  Used to bust the browser HTTP cache when the backend returns the same
   *  imageUrl string but the underlying image has changed. */
  private imageRefreshMarker = signal<Map<number, number>>(new Map());

  /** Staged images to upload on save (Finalizar). Each holds the raw File
   *  and a blob URL used for the preview. Blob URLs are revoked on
   *  finalize or discard. */
  readonly stagedNewImages = signal<StagedImage[]>([]);

  /** IDs of existing images the user marked for deletion. Applied on save. */
  readonly stagedDeletedImageIds = signal<number[]>([]);

  /** UI-facing image list: existing images (minus staged deletions) plus
   *  staged new images. Staged new images use a negative synthetic id so
   *  the template can branch on "is this a brand new image?" */
  readonly previewImage = computed<PreviewImage[]>(() => {
    const toDelete = new Set(this.stagedDeletedImageIds());
    const existing = this.wizardProductImages()
      .filter(i => !toDelete.has(i.id))
      .map<PreviewImage>(i => ({ ...i, staged: false }));
    const newOnes = this.stagedNewImages().map<PreviewImage>((s, idx) => ({
      id: -1 - idx,
      mobileUrl: s.previewUrl,
      tabletUrl: s.previewUrl,
      desktopUrl: s.previewUrl,
      originalName: s.file.name,
      size: s.file.size,
      createdAt: new Date().toISOString(),
      staged: true,
    }));
    return [...existing, ...newOnes];
  });

  /** `true` only when there are pending image changes (uploads or deletes). */
  readonly hasUnsavedImageChanges = computed(() =>
    this.stagedNewImages().length > 0 || this.stagedDeletedImageIds().length > 0
  );

  /** Loading state for any image-related async op (creating the draft,
   *  running the final upload on save). */
  isProcessingImage = signal(false);

  // Cost panel state
  cost = signal<ProductCostResponse | null>(null);
  costLoading = signal(false);
  costError = signal<string | null>(null);

  // Sale price (set in step 4 after seeing production cost)
  salePrice = signal<number>(0);

  // Prep time estimation dialog (step 1)
  prepTimeDialogOpen = signal(false);
  prepTimeEstimate = signal<PrepTimeEstimate | null>(null);

  // When editing, seed the dialog from the stored single estimate so the
  // admin can split it across the three scenarios.
  prepTimeInitialEstimate = computed<PrepTimeEstimate | null>(() => {
    const stored = this.prepTimeEstimate();
    if (stored) return stored;
    const current = this.baseForm.get('estimatedPrepMinutes')?.value as number | null;
    if (current == null) return null;
    return { calmMinutes: current, peakMinutes: current, interruptionMinutes: current, estimatedPrepMinutes: current };
  });

  // ── Step 1: product base + base recipe ──────────────────────────
  baseForm: FormGroup = this.fb.group({
    id: [null],
    name: ['', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.minLength(2)(control)]],
    description: [''],
    estimatedPrepMinutes: [null, (control: AbstractControl) => Validators.min(0)(control)],
    categoryId: [null, (control: AbstractControl) => Validators.required(control)],
    areaId: [null, (control: AbstractControl) => Validators.required(control)],
  });

  baseRecipe: FormArray = this.fb.array([]);

  private destroyRef = inject(DestroyRef);

  /**
   * Re-exposes the base form value as a signal so computed signals
   * (e.g. `canUploadImage`) can recompute reactively when the user edits
   * a control. Reading the observable in a `computed` doesn't work because
   * Angular's form controls don't integrate with the signal system natively.
   * Declared after `baseForm` because class field initializers run in
   * declaration order — `this.baseForm` must already exist.
   */
  private readonly baseFormValue = toSignal(this.baseForm.valueChanges, { initialValue: this.baseForm.value });

  /**
   * `true` once the user has filled the minimum required fields (name with
   * at least 2 characters, categoryId, areaId). In edit mode the product
   * already exists, so the upload is always enabled.
   *
   * Used by the image upload area to gate the file picker on Step 1 of the
   * wizard in create mode — the product is created on demand when the user
   * actually picks a file, instead of being auto-created on Step 1 entry.
   */
  readonly canUploadImage = computed(() => {
    this.baseFormValue();
    if (this.modalMode() === 'edit') return true;
    const v = this.baseFormValue() as { name?: string | null; categoryId?: number | null; areaId?: number | null } | null;
    if (!v) return false;
    const name = (v.name ?? '').trim();
    return name.length >= 2 && v.categoryId != null && v.areaId != null;
  });

  recipeCost = signal(0);
  recipeBreakdown = signal<RecipeCostRow[]>([]);

  private readonly variantsEffect = effect(() => {
    this.supplyVariantOptions();
    this.updateRecipeCost();
  });

  private recipeCostSub = merge(
    this.existingRecipe.valueChanges,
    this.baseRecipe.valueChanges,
  ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { this.updateRecipeCost(); });

  findVariantById(id: number | null): (SupplyVariantResponse & { displayName: string }) | undefined {
    if (id == null) return undefined;
    return this.supplyVariantOptions().find(v => v.id === id);
  }

  private updateRecipeCost(): void {
    const variants = this.supplyVariantOptions();
    const variantById = new Map(variants.map(v => [v.id, v]));

    const rows: RecipeCostRow[] = [];
    const merged = new Map<number, number>();

    const collect = (groups: FormArray): void => {
      for (const group of groups.controls) {
        const v = group.value as { supplyVariantId: number | null; requiredQuantity: number | null };
        const variant = v.supplyVariantId != null ? variantById.get(v.supplyVariantId) : undefined;
        const qty = v.requiredQuantity ?? 0;
        rows.push({
          supplyVariantId: v.supplyVariantId,
          supplyName: variant?.supplyName ?? 'Insumo desconocido',
          unitLabel: variant ? `${String(variant.quantity)} ${variant.unitAbbreviation}` : '—',
          unitCost: variant?.unitCost ?? null,
          requiredQuantity: qty,
          partial: variant?.unitCost != null && qty > 0 ? variant.unitCost * qty : 0,
        });
        if (v.supplyVariantId != null && qty > 0) {
          merged.set(v.supplyVariantId, qty);
        }
      }
    };

    collect(this.existingRecipe);
    collect(this.baseRecipe);

    let total = 0;
    for (const [variantId, qty] of merged) {
      const variant = variantById.get(variantId);
      if (variant?.unitCost != null) {
        total += variant.unitCost * qty;
      }
    }

    this.recipeBreakdown.set(rows);
    this.recipeCost.set(total);
  }

  suggestedSalePrice = computed(() => {
    const c = this.cost();
    if (!c) return 0;
    return Math.round(c.totalCost * 1.3);
  });

  // ── Step 2: product options, each with its own recipe ───────────
  optionsArray: FormArray = this.fb.array([]);

  // Track selected option IDs (existing options)
  selectedOptionIds = signal<number[]>([]);

  // Step 3 options state
  step3OptionsChanged = signal<OptionsChangedPayload>({ optionIds: [], optionExtras: [] });

  ngOnInit(): void {
    // Force load on first visit if no data
    if (this.cache.products.data() === null) {
      this.cache.products.refresh();
    }
  }

  loadPage(page: number): void {
    this.currentPage.set(page);
    this.cache.setProductListParams({ page });
  }

  onPage(event: { first: number; rows: number }): void {
    const page = Math.floor(event.first / event.rows);
    this.currentPage.set(page);
    this.pageSize.set(event.rows);
    this.cache.setProductListParams({ page, size: event.rows });
  }

  onVisible(): void {
    this.cache.products.loadIfStale();
  }

  setIncludeInactive(value: boolean): void {
    this.includeInactive.set(value);
    this.cache.setProductListParams({ includeInactive: value, page: 0 });
  }

  onSearch(value: string): void {
    this.cache.setProductListParams({ search: value, page: 0 });
  }

  // ── Table ────────────────────────────────────────────────────────

  filterProducts(): void {
    const nums = this.filterCategories.value;
    if (!nums || nums.length === 0) {
      this.refreshProducts();
    } else {
      this.productService.filterByCategories(nums).subscribe(res => { this._productsOverride.set(res); });
    }
  }

  // ── Modal open ───────────────────────────────────────────────────

  showCreationModal(): void {
    this.cache.referenceData.loadIfStale();
    this.baseForm.reset();
    this.prepTimeEstimate.set(null);
    this.baseRecipe.clear();
    this.optionsArray.clear();
    this.createdProduct.set(null);
    this.existingOptions.set([]);
    this.optionGroups.set([]);
    this.existingRecipe.clear();
    this.existingRecipeCategoryMap.clear();
    this.existingRecipeRowIds = [];
    this.nextExistingRecipeRowId = 1;
    this.selectedOptionIds.set([]);
    this.baseRecipeCategoryMap.clear();
    this.optionRecipeCategoryMap.clear();
    this.salePrice.set(0);
    this.currentStep.set(1);
    this.modalMode.set('create');
    this.wizardProductImages.set([]);
    this.modalIsOpen.set(true);
    // Note: no auto-create. The product is now created on demand when the
    // user uploads an image or clicks "Siguiente". The upload area is
    // disabled (via `canUploadImage`) until the user fills name + categoryId
    // + areaId. The previous draft-on-entry approach was removed because
    // the backend's `ProductRequest` validation rejects the placeholder
    // payload (e.g. `basePrice: 0` due to `@Positive`).
  }

  showModificationModal(id: number): void {
    this.cost.set(null);
    this.costLoading.set(false);
    this.costError.set(null);
    this.salePrice.set(0);
    this.prepTimeEstimate.set(null);
    this.cache.referenceData.loadIfStale();
    this.baseForm.reset();
    this.baseRecipe.clear();
    this.optionsArray.clear();
    this.createdProduct.set(null);
    this.existingOptions.set([]);
    this.optionGroups.set([]);
    this.existingRecipe.clear();
    this.existingRecipeCategoryMap.clear();
    this.existingRecipeRowIds = [];
    this.nextExistingRecipeRowId = 1;
    this.selectedOptionIds.set([]);
    this.baseRecipeCategoryMap.clear();
    this.optionRecipeCategoryMap.clear();
    this.currentStep.set(1);
    this.modalMode.set('edit');
    this.productService.findProduct(id).pipe(
      switchMap(p => {
        this.salePrice.set(p.basePrice);
        this.baseForm.patchValue({
          id: p.id, name: p.name, description: p.description ?? '',
          estimatedPrepMinutes: p.estimatedPrepMinutes ?? null,
          categoryId: p.categoryId, areaId: p.areaId,
        });
        for (const item of p.recipe) {
          const rowId = this.nextExistingRecipeRowId++;
          this.existingRecipeRowIds.push(rowId);
          this.existingRecipe.push(this.fb.group({
            supplyVariantId: [item.supplyVariantId, (control: AbstractControl) => Validators.required(control)],
            requiredQuantity: [item.requiredQuantity, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0.001)(control)]],
          }));
          const variant = this.supplyVariantOptions().find(v => v.id === item.supplyVariantId);
          this.existingRecipeCategoryMap.set(rowId, variant ? variant.categoryId : null);
        }
        this.baseRecipe.clear();
        this.baseRecipeCategoryMap.clear();
        this.createdProduct.set(p);
        if (p.id) {
          this.loadWizardProductImages(p.id);
          this.loadProductCost(p.id);
          this.loadOptionGroups(p.id);
        }
        return this.masterDataService.getProductOptions(p.id).pipe(
          catchError(() => of([]))
        );
      })
    ).subscribe(opts => {
      this.existingOptions.set(opts);
      this.selectedOptionIds.set(opts.map(o => o.id));
      this.modalIsOpen.set(true);
    });
  }

  /**
   * Cancel handler wired to the modal's "Cancelar" button. If the wizard
   * has unsaved image changes (the user uploaded a new image or deleted
   * the existing one), warn them that those changes have already been
   * committed to the server and will persist if they cancel.
   */
  confirmCancel(): void {
    this.closeModal();
  }

  closeModal(): void {
    // Discard any staged images (revoke blob URLs, clear staging arrays).
    this.discardStagedImages();

    // If the user opened the wizard in create mode and abandoned it before
    // reaching Step 5 (the explicit "finish" step), treat any draft product
    // (created on demand during the wizard) as disposable and hard-delete it.
    const draft = this.createdProduct();
    const draftId = draft?.id;
    const shouldCleanupDraft =
      this.modalMode() === 'create' &&
      draftId != null &&
      this.currentStep() < 5;

    if (shouldCleanupDraft) {
      // Fire-and-forget: delete the draft product (server cascades image deletes).
      this.productService.deleteProduct(draftId).pipe(
        catchError(() => of(null))
      ).subscribe();
    }

    this.modalIsOpen.set(false);
    this.wizardProductImages.set([]);
    this.createdProduct.set(null);
  }

  /**
   * Programmatically opens the file picker on a hidden `<p-fileupload>`.
   * The `p-fileupload` component exposes its underlying `<input type="file">`
   * as `basicFileInput` (ElementRef) when rendered in `mode="basic"`.
   */
  triggerFileInput(fu: { basicFileInput?: { nativeElement?: HTMLInputElement | null } }): void {
    fu.basicFileInput?.nativeElement?.click();
  }

  // ── Prep time estimation dialog ──────────────────────────────────

  openPrepTimeDialog(): void {
    this.prepTimeDialogOpen.set(true);
  }

  applyPrepTime(estimate: PrepTimeEstimate): void {
    this.prepTimeEstimate.set(estimate);
    this.baseForm.patchValue({ estimatedPrepMinutes: estimate.estimatedPrepMinutes });
  }

  // ── Base recipe rows ─────────────────────────────────────────────

  addBaseRecipeItem(): void {
    this.baseRecipe.push(this.fb.group({
      supplyVariantId: [null, (control: AbstractControl) => Validators.required(control)],
      requiredQuantity: [null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0.001)(control)]],
    }));
  }

  /** Adds a supply variant to the base recipe with default qty=1. */
  addSupplyVariant(variant: SupplyVariantResponse): void {
    this.baseRecipe.push(this.fb.group({
      supplyVariantId: [variant.id, (control: AbstractControl) => Validators.required(control)],
      requiredQuantity: [1, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0.001)(control)]],
    }));
    this.supplySearchTerm.set('');
  }

  incrementQty(formArray: FormArray, idx: number): void {
    const ctrl = formArray.at(idx).get('requiredQuantity');
    if (!ctrl) return;
    const current = Number(ctrl.value) || 0;
    ctrl.setValue(Math.round((current + 1) * 1000) / 1000);
  }

  decrementQty(formArray: FormArray, idx: number): void {
    const ctrl = formArray.at(idx).get('requiredQuantity');
    if (!ctrl) return;
    const current = Number(ctrl.value) || 0;
    ctrl.setValue(Math.max(Math.round((current - 1) * 1000) / 1000, 0.001));
  }

  onSupplySearch(term: string): void {
    this.supplySearchTerm.set(term);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const suggestions = this.filteredSuggestions();
    if (suggestions.length === 0) return;
    if (event.key === 'Enter' && suggestions.length > 0) {
      event.preventDefault();
      this.addSupplyVariant(suggestions[0]);
    }
  }

  /** Cost per unit for a given variant, shown in the table row. */
  getUnitCost(variantId: number | null): number {
    if (variantId == null) return 0;
    return this.supplyVariantOptions().find(v => v.id === variantId)?.unitCost ?? 0;
  }

  /** Partial cost for a recipe row (unitCost × qty). */
  getRowPartial(variantId: number | null, qty: number | null): number {
    return this.getUnitCost(variantId) * (qty ?? 0);
  }

  removeBaseRecipeItem(i: number): void { this.baseRecipe.removeAt(i); }

  removeExistingRecipeItem(i: number): void {
    const rowId = this.existingRecipeRowIds[i];
    this.existingRecipeCategoryMap.delete(rowId);
    this.existingRecipeRowIds.splice(i, 1);
    this.existingRecipe.removeAt(i);
  }

  // ── Option rows ──────────────────────────────────────────────────

  addOption(): void {
    this.optionsArray.push(this.fb.group({
      id: [null], // ID if selecting existing option
      name: ['', (control: AbstractControl) => Validators.required(control)],
      optionCategoryId: [null, (control: AbstractControl) => Validators.required(control)],
      recipe: this.fb.array([]),
      isExisting: [false], // Flag to track if this is an existing option
    }));
  }

  removeOption(i: number): void { 
    const opt = this.optionsArray.at(i).value as OptionFormValue;
    if (opt.isExisting && opt.id) {
      this.selectedOptionIds.update(ids => ids.filter(id => id !== opt.id));
    }
    this.optionsArray.removeAt(i); 
  }

  removeExistingOption(optionId: number): void {
    this.existingOptions.update(opts => opts.filter(o => o.id !== optionId));
    this.selectedOptionIds.update(ids => ids.filter(id => id !== optionId));
  }

  getOptionRecipe(i: number): FormArray {
    return this.optionsArray.at(i).get('recipe') as FormArray;
  }

  addOptionRecipeItem(optionIndex: number): void {
    this.getOptionRecipe(optionIndex).push(this.fb.group({
      supplyVariantId: [null, (control: AbstractControl) => Validators.required(control)],
      requiredQuantity: [null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0.001)(control)]],
    }));
  }

  removeOptionRecipeItem(optionIndex: number, recipeIndex: number): void {
    this.getOptionRecipe(optionIndex).removeAt(recipeIndex);
  }

  // ── Helpers de opciones ──────────────────────────────────────────

  /** Opciones disponibles filtradas por categoría para el combobox de nombre */
  optionsByCategory(categoryId: number | null): ProductOptionResponse[] {
    if (!categoryId) return [];
    return this.allProductOptions().filter(o => o.optionCategoryId === categoryId);
  }

  findOptionByName(categoryId: number | null, name: string): ProductOptionResponse | null {
    if (!categoryId || !name) return null;
    return this.optionsByCategory(categoryId).find(o => o.name === name) ?? null;
  }

  /** Handler when user selects an existing option from dropdown */
  onExistingOptionSelected(optionIndex: number, selectedOption: ProductOptionResponse | null): void {
    const optGroup = this.optionsArray.at(optionIndex) as FormGroup;
    
    if (selectedOption) {
      // User selected an existing option
      optGroup.patchValue({
        id: selectedOption.id,
        name: selectedOption.name,
        isExisting: true,
      });
      // Clear recipe since existing options already have their recipe
      this.getOptionRecipe(optionIndex).clear();
      // Add to selected IDs
      if (!this.selectedOptionIds().includes(selectedOption.id)) {
        this.selectedOptionIds.update(ids => [...ids, selectedOption.id]);
      }
    } else {
      // User cleared selection - reset to new option mode
      optGroup.patchValue({
        id: null,
        name: '',
        isExisting: false,
      });
    }
  }

  /** Check if option at index is an existing option */
  isExistingOption(optionIndex: number): boolean {
    return this.optionsArray.at(optionIndex).get('isExisting')?.value === true;
  }

  // ── Validación: opciones duplicadas por ID o nombre ──────────────

  /** Devuelve true si hay opciones duplicadas (mismo ID o mismo nombre+categoría) */
  hasDuplicateOptions(): boolean {
    const options = this.optionsArray.value as { id: number | null; name: string; optionCategoryId: number | null; isExisting: boolean }[];
    
    // Check for duplicate IDs (existing options)
    const existingIds = options
      .filter(o => o.isExisting && o.id !== null)
      .map(o => o.id);
    if (existingIds.length !== new Set(existingIds).size) {
      return true;
    }

    // Check for duplicate name+category combinations (new options)
    const newOptionKeys = options
      .filter(o => !o.isExisting && o.name && o.optionCategoryId)
        .map(o => `${String(o.optionCategoryId)}-${o.name.trim().toLowerCase()}`);
    if (newOptionKeys.length !== new Set(newOptionKeys).size) {
      return true;
    }

    // Check if trying to add an existing option that's already selected
    for (const opt of options) {
      if (opt.isExisting && opt.id) {
        const count = options.filter(o => o.isExisting && o.id === opt.id).length;
        if (count > 1) return true;
      }
    }

    return false;
  }

  /** Devuelve los índices de las opciones que están duplicadas */
  duplicatedOptionIndices(): Set<number> {
    const options = this.optionsArray.value as { id: number | null; name: string; optionCategoryId: number | null; isExisting: boolean }[];
    const duplicates = new Set<number>();

    // Check existing options by ID
    const idMap = new Map<number, number[]>();
    options.forEach((opt, idx) => {
      if (opt.isExisting && opt.id) {
        if (!idMap.has(opt.id)) idMap.set(opt.id, []);
        const idIndices = idMap.get(opt.id);
        if (idIndices) idIndices.push(idx);
        else idMap.set(opt.id, [idx]);
      }
    });
    idMap.forEach(indices => {
      if (indices.length > 1) {
        indices.forEach(idx => duplicates.add(idx));
      }
    });

    // Check new options by name+category
    const nameMap = new Map<string, number[]>();
    options.forEach((opt, idx) => {
      if (!opt.isExisting && opt.name && opt.optionCategoryId) {
        const key = `${String(opt.optionCategoryId)}-${opt.name.trim().toLowerCase()}`;
        if (!nameMap.has(key)) nameMap.set(key, []);
        const nameIndices = nameMap.get(key);
        if (nameIndices) nameIndices.push(idx);
        else nameMap.set(key, [idx]);
      }
    });
    nameMap.forEach(indices => {
      if (indices.length > 1) {
        indices.forEach(idx => duplicates.add(idx));
      }
    });

    return duplicates;
  }

  isOptionDuplicated(optionIndex: number): boolean {
    return this.duplicatedOptionIndices().has(optionIndex);
  }

  // ── Wizard navigation ────────────────────────────────────────────

  submitStep1(): void {
    if (this.baseForm.invalid) { this.baseForm.markAllAsTouched(); return; }

    // If a draft product has already been created (e.g. via an early
    // image upload in create mode), don't POST again — just advance. The
    // form values are pushed to the server later in submitStep3.
    if (this.modalMode() === 'create' && this.createdProduct()?.id) {
      this.currentStep.set(2);
      return;
    }

    const v = this.baseForm.value as {
      id?: number | null;
      name: string;
      categoryId: number;
      areaId: number;
    };

    this.isSubmitting.set(true);

    if (this.modalMode() === 'create') {
      // Legacy path: no draft exists yet (e.g., reference data was empty
      // and the auto-create was skipped). Fall back to creating now.
      this.productService.createProduct({
        name: v.name,
        basePrice: this.salePrice(),
        categoryId: v.categoryId,
        areaId: v.areaId,
        recipe: [],
        optionIds: [],
      }).pipe(
        switchMap((product: ProductResponse) => {
          this.createdProduct.set(product);
          return of(product);
        }),
        catchError(err => {
          this.logger.error('Error creating product', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo crear el producto'
          });
          this.isSubmitting.set(false);
          return EMPTY;
        })
      ).subscribe(() => {
        this.isSubmitting.set(false);
        this.currentStep.set(2);
      });
    } else {
      // Edit mode: product already exists, just go to step 2
      this.isSubmitting.set(false);
      this.currentStep.set(2);
    }
  }

  submitStep2(): void {
    // Step 2 is now about insumos only - validate base recipe and proceed to step 3 (options)
    this.currentStep.set(3);
  }

  goToStep1(): void {
    this.currentStep.set(1);
  }

  goToStep2(): void {
    this.currentStep.set(2);
  }

  goToStep3(): void {
    this.currentStep.set(3);
  }

  goToStep4(): void {
    if (this.salePrice() === 0 && this.cost()) {
      this.salePrice.set(this.suggestedSalePrice());
    }
    this.currentStep.set(4);
  }

  // ── Step 3 options handler ───────────────────────────────────────

  onOptionsChanged(payload: OptionsChangedPayload): void {
    this.step3OptionsChanged.set(payload);
  }

  submitStep3(): void {
    this.isSubmitting.set(true);

    const { optionIds, optionExtras } = this.step3OptionsChanged();

    const v = this.baseForm.value as {
      id?: number | null;
      name: string;
      categoryId: number;
      areaId: number;
      description: string;
      estimatedPrepMinutes: number | null;
    };
    const merged = new Map<number, RecipeItemRequest>();
    for (const r of this.existingRecipe.value as RecipeItemRequest[]) {
      merged.set(r.supplyVariantId, r);
    }
    for (const r of this.baseRecipe.value as RecipeItemRequest[]) {
      merged.set(r.supplyVariantId, r);
    }
    const recipeItems = Array.from(merged.values());

    const productId = this.createdProduct()?.id ?? 0;
    this.productService.updateProduct(productId, {
      name: v.name,
      description: v.description || undefined,
      basePrice: this.salePrice(),
      categoryId: v.categoryId,
      areaId: v.areaId,
      estimatedPrepMinutes: v.estimatedPrepMinutes ?? undefined,
      recipe: recipeItems,
      optionIds,
      optionExtras: optionExtras.length > 0 ? optionExtras : undefined,
    }).pipe(
      catchError(err => {
        this.logger.error('Error saving product with options', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: mapHttpError(err as HttpErrorResponse, 'product-options'),
        });
        this.isSubmitting.set(false);
        return EMPTY;
      }),
      switchMap(() => this.productService.findProduct(productId).pipe(
        catchError(err => {
          this.logger.error('Could not refetch updated product', err);
          this.messageService.add({
            severity: 'warn',
            summary: 'Guardado con observaciones',
            detail: 'Los cambios se guardaron, pero no se pudo recargar el detalle. Recarga la página si ves datos desactualizados.'
          });
          return of(null);
        }),
      )),
      switchMap((product: ProductResponse | null) => {
        if (!product) {
          this.isSubmitting.set(false);
          this.wsService.emitCacheInvalidation('products', 'update');
          this.refreshProducts();
          this.currentStep.set(4);
          return of(null);
        }
        this.createdProduct.set(product);
        return this.masterDataService.getProductOptions(product.id);
      }),
    ).subscribe(savedOptions => {
      if (savedOptions === null) return;
      this.existingOptions.set(savedOptions);
      this.isSubmitting.set(false);
      this.wsService.emitCacheInvalidation('products', 'update');
      this.refreshProducts();
      this.currentStep.set(4);
      this.loadProductCost(this.createdProduct()?.id ?? 0);
    });
  }

  confirmPrice(): void {
    if (this.salePrice() <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Precio inválido',
        detail: 'Debes definir un precio de venta válido'
      });
      return;
    }
    const saved = this.createdProduct();
    if (!saved) return;
    const v = this.baseForm.value as { name: string; description: string | null; categoryId: number; areaId: number; estimatedPrepMinutes: number | null };
    const merged = new Map<number, RecipeItemRequest>();
    for (const r of this.existingRecipe.value as RecipeItemRequest[]) {
      merged.set(r.supplyVariantId, r);
    }
    for (const r of this.baseRecipe.value as RecipeItemRequest[]) {
      merged.set(r.supplyVariantId, r);
    }
    this.productService.updateProduct(saved.id, {
      name: v.name,
      description: v.description ?? undefined,
      basePrice: this.salePrice(),
      categoryId: v.categoryId,
      areaId: v.areaId,
      estimatedPrepMinutes: v.estimatedPrepMinutes ?? undefined,
      recipe: Array.from(merged.values()),
      optionIds: this.selectedOptionIds(),
    }).subscribe({
      next: () => {
        this.wsService.emitCacheInvalidation('products', 'update');
        this.refreshProducts();
        this.currentStep.set(5);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar el precio de venta'
        });
      }
    });
  }

  finish(): void {
    const productId = this.createdProduct()?.id;
    if (productId && this.hasUnsavedImageChanges()) {
      this.isProcessingImage.set(true);
      this.finalizeImages(productId).pipe(
        catchError(() => of(null)),
      ).subscribe(() => {
        this.isProcessingImage.set(false);
        this.closeModal();
      });
    } else {
      this.closeModal();
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  isInvalid(form: FormGroup | FormArray, field: string): boolean {
    const c = (form as FormGroup).get(field);
    return !!(c?.invalid && c.touched);
  }

  private refreshProducts(): void {
    this.cache.products.refresh();
  }

  loadWizardProductImages(productId: number): void {
    this.wizardImagesLoading.set(true);
    this.imageService.getImages(productId).pipe(
      catchError(() => of([]))
    ).subscribe(images => {
      this.wizardProductImages.set(images);
      this.wizardImagesLoading.set(false);
    });
  }

  loadProductCost(productId: number): void {
    if (!productId) { this.cost.set(null); return; }
    this.costLoading.set(true);
    this.costError.set(null);
    this.productService.getCost(productId).pipe(
      catchError(err => {
        this.logger.error('Error loading product cost', err);
        this.costError.set('No se pudo calcular el costo de producción');
        return of(null);
      })
    ).subscribe(c => {
      if (c) {
        this.cost.set(c);
        if (this.salePrice() === 0) {
          this.salePrice.set(this.suggestedSalePrice());
        }
      }
      this.costLoading.set(false);
    });
  }

  loadOptionGroups(productId: number): void {
    if (!productId) { this.optionGroups.set([]); return; }
    this.optionGroupService.getProductOptionGroups(productId).pipe(
      catchError(() => of([]))
    ).subscribe(groups => {
      this.optionGroups.set(groups);
    });
  }

  /**
   * Stages a new image for later upload. If the product hasn't been created
   * server-side yet (create mode, no draft), a draft product is created
   * first. The image is held in memory until "Finalizar" is clicked.
   */
  onWizardImageSelect(event: { files: File[] }): void {
    const file = event.files[0];

    if (this.createdProduct() == null) {
      this.createDraftAndStage(file);
      return;
    }

    this.stageNewImage(file);
  }

  /** Stage a file into `stagedNewImages` with a blob URL preview. */
  private stageNewImage(file: File): void {
    const url = URL.createObjectURL(file);
    this.stagedNewImages.update(images => [...images, { file, previewUrl: url }]);
  }

  /** Remove an image from the preview: stage its id for deletion or
   *  remove a staged new image. */
  removeImage(image: PreviewImage): void {
    if (image.staged) {
      const idx = this.stagedNewImages().findIndex(s => s.previewUrl === image.mobileUrl);
      if (idx >= 0) {
        URL.revokeObjectURL(image.mobileUrl);
        this.stagedNewImages.update(images => images.filter((_, i) => i !== idx));
      }
    } else {
      this.stagedDeletedImageIds.update(ids => [...ids, image.id]);
    }
  }

  /** Creates a draft product on demand using the current Step 1 form values,
   *  then stages the image in memory. */
  private createDraftAndStage(file: File): void {
    const v = this.baseForm.value as { name?: string | null; categoryId?: number | null; areaId?: number | null };
    const name = (v.name ?? '').trim();
    const categoryId = v.categoryId ?? null;
    const areaId = v.areaId ?? null;
    if (name.length < 2 || categoryId == null || areaId == null) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Datos incompletos',
        detail: 'Completa nombre, categoría y área antes de subir una imagen',
      });
      return;
    }

    this.isProcessingImage.set(true);
    this.productService.createProduct({
      name,
      basePrice: 0,
      categoryId,
      areaId,
      recipe: [],
      optionIds: [],
    }).pipe(
      catchError(err => {
        this.logger.error('Error creating draft product for image staging', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo crear el producto para subir la imagen',
        });
        this.isProcessingImage.set(false);
        return EMPTY;
      }),
    ).subscribe(product => {
      this.createdProduct.set(product);
      this.baseForm.patchValue({ id: product.id });
      this.isProcessingImage.set(false);
      this.stageNewImage(file);
    });
  }

  /** Commits all staged image changes to the server. Called from finish().
   *  Uploads new images and deletes removed ones in parallel, then refreshes
   *  the image list. Returns an Observable that completes when done. */
  finalizeImages(productId: number): Observable<unknown> {
    const uploads$ = this.stagedNewImages().length > 0
      ? forkJoin(
          this.stagedNewImages().map(s =>
            this.imageService.uploadImage(productId, s.file).pipe(
              catchError(err => {
                this.logger.error('Error uploading staged image', err);
                return of(null);
              })
            )
          )
        )
      : of([]);

    const deletes$ = this.stagedDeletedImageIds().length > 0
      ? forkJoin(
          this.stagedDeletedImageIds().map(id =>
            this.imageService.deleteImage(id).pipe(
              catchError(err => {
                this.logger.error('Error deleting staged image', err);
                return of(null);
              })
            )
          )
        )
      : of([]);

    return forkJoin([uploads$, deletes$]).pipe(
      tap(() => {
        this.markProductImageUpdated(productId);
        this.discardStagedImages();
        this.loadWizardProductImages(productId);
      }),
    );
  }

  /** Revokes all blob URLs and clears staging state. Called on modal close
   *  or after finalize. */
  discardStagedImages(): void {
    for (const s of this.stagedNewImages()) {
      URL.revokeObjectURL(s.previewUrl);
    }
    this.stagedNewImages.set([]);
    this.stagedDeletedImageIds.set([]);
  }

  showDetailDialog(product: ProductResponse): void {
    this.detailProduct.set(product);
    this.detailDialogOpen.set(true);
  }

  closeDetailDialog(): void {
    this.detailDialogOpen.set(false);
    this.detailProduct.set(null);
  }

  /** Returns the table-row image src with a cache-busting query param
   *  whenever the current product's image was mutated in this session. */
  getProductImageSrc(product: ProductResponse): string {
    const url = product.imageUrl;
    if (!url) return '';
    const marker = this.imageRefreshMarker().get(product.id);
    return marker ? `${url}?v=${String(marker)}` : url;
  }

  private markProductImageUpdated(productId: number): void {
    this.imageRefreshMarker.update(m => {
      const nm = new Map(m);
      nm.set(productId, Date.now());
      return nm;
    });
  }

  confirmDeleteProduct(event: Event, product: ProductResponse): void {
    this.confirmationService.confirm({
      target: event.target as HTMLElement,
      message: `¿Estás seguro de desactivar "${product.name}"?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.disableProduct(product.id);
      }
    });
  }

  confirmEnableProduct(event: Event, product: ProductResponse): void {
    this.confirmationService.confirm({
      target: event.target as HTMLElement,
      message: `¿Estás seguro de activar "${product.name}"?`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.enableProduct(product.id);
      }
    });
  }

  private disableProduct(productId: number): void {
    this.productService.disableProduct(productId).pipe(
      switchMap(() => {
        this.wsService.emitCacheInvalidation('products', 'delete');
        this.refreshProducts();
        return of(null);
      }),
      catchError(err => {
        this.logger.error('Error deleting product', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar el producto'
        });
        return of(null);
      })
    ).subscribe(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Producto desactivado',
        detail: 'El producto fue desactivado correctamente'
      });
    });
  }

  private enableProduct(productId: number): void {
    this.productService.enableProduct(productId).pipe(
      switchMap(() => {
        this.wsService.emitCacheInvalidation('products', 'update');
        this.refreshProducts();
        return of(null);
      }),
      catchError(err => {
        this.logger.error('Error enabling product', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo activar el producto'
        });
        return of(null);
      })
    ).subscribe(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Producto activado',
        detail: 'El producto fue activado correctamente'
      });
    });
  }

  // ── Nueva opción de producto (dialog independiente) ──────────────

  newOptionDialogOpen = signal(false);
  newOptionSubmitting = signal(false);

  // todos los productos pueden tener opciones
  productsWithOptions = computed(() => this.products() ?? []);

  newOptionForm: FormGroup = this.fb.group({
    optionCategoryId: [null, (control: AbstractControl) => Validators.required(control)],
    name: ['', (control: AbstractControl) => Validators.required(control)],
  });

  // recipe rows para el dialog de nueva opción
  newOptionRecipe: FormArray = this.fb.array([]);

  newOptionRecipeCategoryMap = new Map<number, number | null>();

  getNewOptionRecipeCategory(i: number): number | null {
    return this.newOptionRecipeCategoryMap.get(i) ?? null;
  }

  setNewOptionRecipeCategory(i: number, catId: number | null): void {
    this.newOptionRecipeCategoryMap.set(i, catId);
    this.newOptionRecipe.at(i).get('supplyVariantId')?.setValue(null);
  }

  filteredVariantsForNewOptionRecipe(i: number): (SupplyVariantResponse & { displayName: string })[] {
    const catId = this.newOptionRecipeCategoryMap.get(i) ?? null;
    return catId ? this.supplyVariantOptions().filter(v => v.categoryId === catId) : this.supplyVariantOptions();
  }

  openNewOptionDialog(): void {
    this.cache.referenceData.loadIfStale();
    this.newOptionForm.reset();
    this.newOptionRecipe.clear();
    this.newOptionRecipeCategoryMap.clear();
    this.newOptionDialogOpen.set(true);
  }

  addNewOptionRecipeItem(): void {
    this.newOptionRecipe.push(this.fb.group({
      supplyVariantId: [null, (control: AbstractControl) => Validators.required(control)],
      requiredQuantity: [null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0.001)(control)]],
    }));
  }

  removeNewOptionRecipeItem(i: number): void { this.newOptionRecipe.removeAt(i); }

  submitNewOption(): void {
    if (this.newOptionForm.invalid) { this.newOptionForm.markAllAsTouched(); return; }
    const { optionCategoryId, name } = this.newOptionForm.value as { optionCategoryId: number | null; name: string };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rawItems = this.newOptionRecipe.value;
     
    const toRecipeItem = (r: unknown): RecipeItemRequest => ({ supplyVariantId: (r as RecipeItemRequest).supplyVariantId, requiredQuantity: (r as RecipeItemRequest).requiredQuantity });
    const recipeItems: RecipeItemRequest[] = Array.isArray(rawItems) ? rawItems.map(toRecipeItem) : [];
    this.newOptionSubmitting.set(true);
     
    const request: ProductOptionCreateRequest = { name, optionCategoryId: optionCategoryId ?? 0, recipe: recipeItems };
    this.productService.createProductOption(request).pipe(
      switchMap(() => this.productOptionService.getOptions()),
      catchError(err => {
        this.logger.error('Error creating product option', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear la opción' });
        this.newOptionSubmitting.set(false);
        return EMPTY;
      })
    ).subscribe(() => {
      this.cache.referenceData.refresh();
      this.newOptionSubmitting.set(false);
      this.newOptionDialogOpen.set(false);
      this.messageService.add({ severity: 'success', summary: 'Opción creada', detail: `"${name}" agregada correctamente` });
    });
  }

  onProductUpdated(): void {
    this.refreshProducts();
  }
}
