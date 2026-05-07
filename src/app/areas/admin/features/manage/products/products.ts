import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy, effect } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, FormArray, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { of, EMPTY, forkJoin } from 'rxjs';
import { catchError, switchMap, map } from 'rxjs/operators';

import { Product } from '@app/core/services/products/product';
import { MasterData } from '@app/core/services/master-data/master-data';
import { Logging } from '@app/core/services/logging/logging';
import { ProductCacheService } from './product-cache.service';
import { LazyLoadDirective } from '@app/core/directives/lazy-load.directive';
import { ProductOptionService } from '@app/core/services/product-option/product-option';
import { WebSocket } from '@app/core/services/websocket/websocket';

import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { ProductRecipeItem, ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductOption as ProductOptionDTO, ProductOptionResponse } from '@app/shared/models/dto/products/product-option.model';
import { ProductOptionCreateRequest, RecipeItemRequest } from '@app/shared/models/dto/products/product-create-request';
import { ProductImage } from '@app/core/services/product-image';
import { ProductImageResponse } from '@app/shared/models/dto/products/product-image-response';

import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressBarModule } from 'primeng/progressbar';
import { ImageModule } from 'primeng/image';
import { GalleriaModule } from 'primeng/galleria';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CurrencyPipe } from '@angular/common';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';

// Wizard steps: 1=base+recipe, 2=options, 3=summary
type WizardStep = 1 | 2 | 3;

interface OptionFormValue {
  id?: number | null;
  name?: string;
  optionCategoryId?: number | null;
  recipe?: unknown[];
  isExisting?: boolean;
}

@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    CurrencyPipe,
    TableModule,
    ButtonModule,
    IconFieldModule,
    InputTextModule,
    InputIconModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
    IftaLabelModule,
    DialogModule,
    InputNumberModule,
    ToastModule,
    TagModule,
    DividerModule,
    SkeletonModule,
    LazyLoadDirective,
    TableSkeleton,
    FileUploadModule,
    ProgressBarModule,
    ImageModule,
    GalleriaModule,
    ConfirmPopupModule,
    ConfirmDialogModule,
  ],
  templateUrl: './products.html',
  providers: [MessageService, ConfirmationService],
})
export class Products implements OnInit {
  private fb = inject(FormBuilder);
  private productService = inject(Product);
  private productOptionService = inject(ProductOptionService);
  private masterDataService = inject(MasterData);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private logger = inject(Logging);
  private wsService = inject(WebSocket);
  readonly cache = inject(ProductCacheService);
  readonly imageService = inject(ProductImage);

  title = 'Carta de Productos';
  description = 'Gestión completa de todos los productos del restaurante';
  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

  // Table - usando cache service
  filterCategories = new FormControl<number[]>([], []);
  tableSearch = signal('');

  // Thumbnails map (productId -> first image url)
  productThumbnails = signal<Map<number, string>>(new Map());
  thumbnailsLoading = signal(false);

  // Table data - computed from cache with override support
  private _productsOverride = signal<ProductResponse[] | undefined>(undefined);
  products = computed(() => this._productsOverride() ?? this.cache.products.data() ?? undefined);

  // Effect to load thumbnails when products are loaded
  private readonly thumbnailsEffect = effect(() => {
    const prods = this.products();
    if (prods && prods.length > 0) {
      this.ensureThumbnails();
    }
  });
  
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

  filteredProducts = computed(() => {
    const all = this.products();
    if (all === undefined) return undefined;
    const search = this.tableSearch().toLowerCase().trim();
    if (!search) return all;
    return all.filter((p) => p.name.toLowerCase().includes(search));
  });

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

  // Modal state
  modalIsOpen = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  currentStep = signal<WizardStep>(1);
  isSubmitting = signal(false);
  createdProduct = signal<ProductResponse | null>(null);
  existingOptions = signal<ProductOptionDTO[]>([]);
  existingRecipe = signal<ProductRecipeItem[]>([]);

  // Detail dialog
  detailDialogOpen = signal(false);
  detailProduct = signal<ProductResponse | null>(null);
  detailOptions = signal<ProductOptionDTO[]>([]);
  detailOptionsLoading = signal(false);

  // Image gallery state
  productImages = signal<ProductImageResponse[]>([]);
  imagesLoading = signal(false);
  selectedImageIndex = signal(0);
  galleriaVisible = signal(false);

  // Wizard images state
  wizardProductImages = signal<ProductImageResponse[]>([]);
  wizardImagesLoading = signal(false);

  // Upload state
  localUploadProgress = signal(0);
  isUploadingImage = signal(false);

  // Galleria responsive options
  galleriaResponsiveOptions = [
    { breakpoint: '1024px', numVisible: 5 },
    { breakpoint: '768px', numVisible: 3 }
  ];

  // ── Step 1: product base + base recipe ──────────────────────────
  baseForm: FormGroup = this.fb.group({
    id: [null],
    name: ['', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.minLength(2)(control)]],
    basePrice: [null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0)(control)]],
    categoryId: [null, (control: AbstractControl) => Validators.required(control)],
    areaId: [null, (control: AbstractControl) => Validators.required(control)],
  });

  baseRecipe: FormArray = this.fb.array([]);

  // ── Step 2: product options, each with its own recipe ───────────
  optionsArray: FormArray = this.fb.array([]);

  // Track selected option IDs (existing options)
  selectedOptionIds = signal<number[]>([]);

  ngOnInit(): void {
    // Force load on first visit if no data
    if (this.cache.products.data() === null) {
      this.cache.products.refresh();
    }
    // Load reference data (categories, areas) for filters
    if (this.cache.referenceData.data() === null) {
      this.cache.referenceData.refresh();
    }
  }

  onVisible(): void {
    this.cache.products.loadIfStale();
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
    this.baseRecipe.clear();
    this.optionsArray.clear();
    this.createdProduct.set(null);
    this.existingOptions.set([]);
    this.existingRecipe.set([]);
    this.selectedOptionIds.set([]);
    this.baseRecipeCategoryMap.clear();
    this.optionRecipeCategoryMap.clear();
    this.currentStep.set(1);
    this.modalMode.set('create');
    this.wizardProductImages.set([]);
    this.modalIsOpen.set(true);
  }

  showModificationModal(id: number): void {
    this.cache.referenceData.loadIfStale();
    this.baseForm.reset();
    this.baseRecipe.clear();
    this.optionsArray.clear();
    this.createdProduct.set(null);
    this.existingOptions.set([]);
    this.existingRecipe.set([]);
    this.selectedOptionIds.set([]);
    this.baseRecipeCategoryMap.clear();
    this.optionRecipeCategoryMap.clear();
    this.currentStep.set(1);
    this.modalMode.set('edit');
    this.productService.findProduct(id).pipe(
      switchMap(p => {
        this.baseForm.patchValue({
          id: p.id, name: p.name, basePrice: p.basePrice,
          categoryId: p.categoryId, areaId: p.areaId,
        });
        this.existingRecipe.set(p.recipe);
        this.baseRecipe.clear();
        this.baseRecipeCategoryMap.clear();
        this.createdProduct.set(p);
        if (p.id) {
          this.loadWizardProductImages(p.id);
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

  // ── Base recipe rows ─────────────────────────────────────────────

  addBaseRecipeItem(): void {
    this.baseRecipe.push(this.fb.group({
      supplyVariantId: [null, (control: AbstractControl) => Validators.required(control)],
      requiredQuantity: [null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0.001)(control)]],
    }));
  }

  removeBaseRecipeItem(i: number): void { this.baseRecipe.removeAt(i); }

  removeExistingRecipeItem(variantId: number): void {
    this.existingRecipe.update(items => items.filter(item => item.supplyVariantId !== variantId));
  }

  /** Nombre para mostrar de un insumo existente dado su supplyVariantId */
  getVariantDisplayName(variantId: number): string {
    return this.supplyVariantOptions().find(v => v.id === variantId)?.displayName ?? `Insumo #${String(variantId)}`;
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
    // Always go to step 2 to manage options
    this.currentStep.set(2);
  }

  submitStep2(): void {
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
          basePrice: number; 
          categoryId: number; 
          areaId: number; 
        };
        const existing = this.existingRecipe();
        const baseItems = this.baseRecipe.value as RecipeItemRequest[];
        const recipeItems: RecipeItemRequest[] = [];
        Object.assign(recipeItems, existing);
        Object.assign(recipeItems, baseItems);
        if (this.modalMode() === 'create') {
          return this.productService.createProduct({
            name: v.name,
            basePrice: v.basePrice,
            categoryId: v.categoryId,
            areaId: v.areaId,
             
            recipe: recipeItems,
            optionIds: allOptionIds,
          });
        } else {
          const productId = v.id ?? 0;
          return this.productService.updateProduct(productId, {
            id: productId,
            name: v.name,
            basePrice: v.basePrice,
            categoryId: v.categoryId,
            areaId: v.areaId,
            recipe: recipeItems,
            optionIds: allOptionIds,
          }).pipe(
            switchMap(() => this.productService.findProduct(productId))
          );
        }
      }),
      switchMap((product: ProductResponse) => {
        this.createdProduct.set(product);
        // Load the associated options for display in step 3
        return this.masterDataService.getProductOptions(product.id);
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
      this.existingOptions.set(savedOptions);
      this.isSubmitting.set(false);
      this.refreshProducts();
      this.wsService.emitCacheInvalidation('products', this.modalMode() === 'create' ? 'create' : 'update');
      this.currentStep.set(3);
    });
  }

  skipOptions(): void {
    // Submit step 2 with no options (product without options)
    this.submitStep2();
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

  loadProductImages(productId: number): void {
    this.imagesLoading.set(true);
    this.imageService.getImages(productId).pipe(
      catchError(err => {
        this.logger.error('Error loading product images', err);
        return of([]);
      })
    ).subscribe(images => {
      this.productImages.set(images);
      this.imagesLoading.set(false);
    });
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

  loadProductThumbnails(productIds: number[]): void {
    if (productIds.length === 0) return;

    this.thumbnailsLoading.set(true);

    forkJoin(
      productIds.map(id =>
        this.imageService.getImages(id).pipe(
          map(images => ({ productId: id, thumbnail: images[0]?.desktopUrl ?? null })),
          catchError(() => of({ productId: id, thumbnail: null }))
        )
      )
    ).subscribe(results => {
      const map = new Map<number, string>();
      results.forEach(r => {
        if (r.thumbnail) map.set(r.productId, r.thumbnail);
      });
      this.productThumbnails.set(map);
      this.thumbnailsLoading.set(false);
    });
  }

  getThumbnailUrl(productId: number): string | null {
    return this.productThumbnails().get(productId) ?? null;
  }

  private ensureThumbnails(): void {
    const products = this.products();
    if (!products || products.length === 0) return;

    const currentThumbs = this.productThumbnails();
    if (currentThumbs.size === 0 && !this.thumbnailsLoading()) {
      const ids = products.map(p => p.id);
      this.loadProductThumbnails(ids);
    }
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
    this.imageService.deleteImage(productId, image.id).pipe(
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
    this.detailOptions.set([]);
    this.detailDialogOpen.set(true);
    this.detailOptionsLoading.set(true);
    this.loadProductImages(product.id);
    this.productService.getOptions(product.id).pipe(
      catchError(() => of([] as ProductOptionDTO[]))
    ).subscribe(opts => {
      this.detailOptions.set(opts);
      this.detailOptionsLoading.set(false);
    });
  }

  closeDetailDialog(): void {
    this.detailDialogOpen.set(false);
    this.detailProduct.set(null);
    this.detailOptions.set([]);
    this.productImages.set([]);
  }

  // ── Image gallery methods ───────────────────────────────────────

  openGalleria(index: number): void {
    this.selectedImageIndex.set(index);
    this.galleriaVisible.set(true);
  }

  closeGalleria(): void {
    this.galleriaVisible.set(false);
  }

  getImageUrl(image: ProductImageResponse, type: 'mobile' | 'tablet' | 'desktop' = 'desktop'): string {
    return type === 'mobile' ? image.mobileUrl : type === 'tablet' ? image.tabletUrl : image.desktopUrl;
  }

  onImageSelect(event: { files: File[] }): void {
    const files: File[] = event.files;
    if (files.length === 0) return;

    const productId = this.detailProduct()?.id;
    if (!productId) return;

    this.isUploadingImage.set(true);
    this.localUploadProgress.set(0);

    this.imageService.uploadImage(productId, files[0]).subscribe({
      next: (result) => {
        this.localUploadProgress.set(result.progress);
        const image = result.image;
        if (image != null) {
          this.productImages.update(imgs => [...imgs, image]);
        }
      },
      error: (err) => {
        this.logger.error('Error uploading image', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error de upload',
          detail: 'No se pudo subir la imagen'
        });
        this.isUploadingImage.set(false);
      },
      complete: () => {
        this.isUploadingImage.set(false);
        this.localUploadProgress.set(0);
        // Reload to ensure UI shows complete image data
        this.loadProductImages(productId);
      }
    });
  }

  confirmDeleteImage(event: Event, image: ProductImageResponse): void {
    const productId = this.detailProduct()?.id;
    if (!productId) return;
    this.imageService.deleteImage(productId, image.id).pipe(
      catchError(err => {
        this.logger.error('Error deleting image', err);
        return of(false);
      })
    ).subscribe(result => {
      if (result) {
        // Reload to ensure UI matches server state after delete
        this.loadProductImages(productId);
        this.messageService.add({
          severity: 'success',
          summary: 'Imagen eliminada',
          detail: 'La imagen fue eliminada correctamente'
        });
      }
    });
  }

  confirmDeleteProduct(event: Event, product: ProductResponse): void {
    this.confirmationService.confirm({
      target: event.target as HTMLElement,
      message: `¿Estás seguro de eliminar "${product.name}"? Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.deleteProduct(product.id);
      }
    });
  }

  private deleteProduct(productId: number): void {
    this.productService.deleteProduct(productId).pipe(
      switchMap(() => {
        this.refreshProducts();
        this.wsService.emitCacheInvalidation('products', 'delete');
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
        summary: 'Producto eliminado',
        detail: 'El producto fue eliminado correctamente'
      });
    });
  }

  groupByCategory(options: ProductOptionDTO[]): { category: string; items: ProductOptionDTO[] }[] {
    const map = new Map<string, ProductOptionDTO[]>();
    for (const o of options) {
      const arr = map.get(o.optionCategoryName) ?? [];
      arr.push(o);
      map.set(o.optionCategoryName, arr);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
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
}
