import { Component, inject, OnInit, signal, computed, effect, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, FormGroup, FormArray, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { of, EMPTY, forkJoin, merge } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { Product } from '@app/core/services/products/product';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { ProductCache } from './product-cache';
import { LazyLoad } from '@app/core/directives/lazy-load/lazy-load.directive';
import { ProductOption } from '@app/core/services/product-option/product-option';
import { WebSocket } from '@app/core/services/websocket/websocket';

import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductOption as ProductOptionDTO, ProductOptionResponse } from '@app/shared/models/dto/products/product-option';
import { ProductOptionCreateRequest, RecipeItemRequest } from '@app/shared/models/dto/products/product-create-request';
import { ProductImage } from '@app/core/services/product-image/product-image';
import { ProductImageResponse } from '@app/shared/models/dto/products/product-image-response';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';

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

interface OptionFormValue {
  id?: number | null;
  name?: string;
  optionCategoryId?: number | null;
  recipe?: unknown[];
  isExisting?: boolean;
}

interface RecipeCostRow {
  supplyVariantId: number | null;
  supplyName: string;
  unitLabel: string;
  unitCost: number | null;
  requiredQuantity: number;
  partial: number;
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

  // Upload state
  isUploadingImage = signal(false);

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

  closeModal(): void {
    this.modalIsOpen.set(false);
    this.wizardProductImages.set([]);
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

    const v = this.baseForm.value as {
      id?: number | null;
      name: string;
      categoryId: number;
      areaId: number;
    };

    this.isSubmitting.set(true);

    if (this.modalMode() === 'create') {
      // Create product first before proceeding to step 2 (insumos)
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

  submitStep3(): void {
    if (this.optionsArray.invalid) { this.optionsArray.markAllAsTouched(); return; }
    if (this.hasDuplicateOptions()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No puedes agregar la misma opción más de una vez'
      });
      return;
    }

    this.isSubmitting.set(true);

    // IDs de opciones existentes que el usuario NO eliminó (siguen en existingOptions)
    const keptExistingIds: number[] = this.existingOptions().map(o => o.id);

    // Separate new options added via the form from existing ones
    const addedExistingIds: number[] = [];
    const newOptions: { name: string; optionCategoryId: number; recipe: { supplyVariantId: number; requiredQuantity: number }[] }[] = [];

    for (const opt of this.optionsArray.value as OptionFormValue[]) {
      if (opt.isExisting && opt.id) {
        addedExistingIds.push(opt.id);
      } else {
        newOptions.push({
          name: opt.name ?? '',
          optionCategoryId: opt.optionCategoryId ?? 0,
          recipe: opt.recipe as { supplyVariantId: number; requiredQuantity: number }[],
        });
      }
    }

    // Merge: kept existing + newly added existing (deduplicated)
    const existingOptionIds = [...new Set([...keptExistingIds, ...addedExistingIds])];

    // Create new options first (if any)
    const createNewOptions$ = newOptions.length > 0
      ? forkJoin(newOptions.map(opt => this.productService.createProductOption(opt)))
      : of([]);

    createNewOptions$.pipe(
      switchMap((createdOptions: object[]) => {
        // Collect all option IDs (existing + newly created)
        const allOptionIds = [
          ...existingOptionIds,
          ...createdOptions.map(opt => (opt as { id: number }).id)
        ];

        // Refresh allProductOptions to include newly created options
        if (createdOptions.length > 0) {
          return this.productOptionService.getOptions().pipe(
            switchMap(allOpts => {
              this._allProductOptionsOverride.set(allOpts);
              return of(allOptionIds);
            })
          );
        }
        return of(allOptionIds);
      }),
      switchMap((allOptionIds: number[]) => {
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
        return this.productService.updateProduct(productId, {
          name: v.name,
          description: v.description || undefined,
          basePrice: this.salePrice(),
          categoryId: v.categoryId,
          areaId: v.areaId,
          estimatedPrepMinutes: v.estimatedPrepMinutes ?? undefined,
          recipe: recipeItems,
          optionIds: allOptionIds,
        }).pipe(
          catchError(err => {
            this.logger.error('Error saving product with options', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo guardar el producto con sus opciones'
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
        );
      }),
      catchError(err => {
        this.logger.error('Error saving product with options', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar el producto con sus opciones'
        });
        this.isSubmitting.set(false);
        return EMPTY;
      })
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
    this.closeModal();
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

  onWizardImageSelect(event: { files: File[] }): void {
    const file = event.files[0];
    const productId = this.createdProduct()?.id;
    if (!productId) return;

    this.isUploadingImage.set(true);
    this.imageService.uploadImage(productId, file).subscribe({
      next: (result) => {
        const image = result.image;
        if (image != null) {
          this.wizardProductImages.update(imgs => [...imgs, image]);
        }
      },
      complete: () => { 
        this.isUploadingImage.set(false);
        // Reload to ensure we have latest data including server-generated URLs
        if (productId) {
          this.loadWizardProductImages(productId);
        }
      }
    });
  }

  deleteWizardImage(image: ProductImageResponse): void {
    const productId = this.createdProduct()?.id;
    if (!productId) return;
    this.imageService.deleteImage(image.id).pipe(
      catchError(() => of(false))
    ).subscribe(result => {
      if (result) {
        // Reload to ensure UI matches server state
        this.loadWizardProductImages(productId);
      }
    });
  }

  showDetailDialog(product: ProductResponse): void {
    this.detailProduct.set(product);
    this.detailDialogOpen.set(true);
  }

  closeDetailDialog(): void {
    this.detailDialogOpen.set(false);
    this.detailProduct.set(null);
  }

  getImageUrl(image: ProductImageResponse, type: 'mobile' | 'tablet' | 'desktop' = 'desktop'): string {
    return type === 'mobile' ? image.mobileUrl : type === 'tablet' ? image.tabletUrl : image.desktopUrl;
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
