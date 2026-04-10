import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormArray, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, EMPTY, switchMap, map } from 'rxjs';

import { AreaService } from '@app/core/services/areas/area-service';
import { CategoryService } from '@app/core/services/category/category-service';
import { ProductService } from '@app/core/services/products/product-service';
import { OptionCategoryService } from '@app/core/services/option-category/option-category.service';
import { ProductOptionService } from '@app/core/services/product-option/product-option.service';
import { SupplyService } from '@app/core/services/supplies/supply-service';
import { MasterDataService } from '@app/core/services/master-data/master-data.service';
import { LoggingService } from '@app/core/services/logging/logging-service';

import { AreaSimpleResponse } from '@app/shared/models/dto/areas/area-simple-response';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { OptionCategoryResponse } from '@app/shared/models/dto/category/option-category.model';
import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductOption, ProductOptionResponse } from '@app/shared/models/dto/products/product-option.model';
import { ProductOptionCreateRequest } from '@app/shared/models/dto/products/product-create-request';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { CurrencyPipe } from '@angular/common';

// Wizard steps: 1=base+recipe, 2=options (only if hasOptions), 3=summary
type WizardStep = 1 | 2 | 3;

@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    CurrencyPipe,
    TableModule,
    ProgressSpinnerModule,
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
  ],
  templateUrl: './products.html',
  providers: [MessageService],
})
export class Products implements OnInit {
  private fb = inject(FormBuilder);
  private productService = inject(ProductService);
  private areaService = inject(AreaService);
  private categoryService = inject(CategoryService);
  private optionCategoryService = inject(OptionCategoryService);
  private productOptionService = inject(ProductOptionService);
  private supplyService = inject(SupplyService);
  private masterDataService = inject(MasterDataService);
  private messageService = inject(MessageService);
  private logger = inject(LoggingService);

  title = 'Carta de Productos';
  description = 'Gestión completa de todos los productos del restaurante';
  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

  // Table
  products = signal<ProductResponse[] | undefined>(undefined);
  filterCategories = new FormControl<number[]>([], []);

  // Reference data
  areas = signal<AreaSimpleResponse[]>([]);
  categories = signal<CategorySimpleResponse[]>([]);
  optionCategories = signal<OptionCategoryResponse[]>([]);
  supplyVariantOptions = signal<(SupplyVariantResponse & { displayName: string })[]>([]);
  allProductOptions = signal<ProductOptionResponse[]>([]);

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
    return this.optionRecipeCategoryMap.get(`${optIdx}-${riIdx}`) ?? null;
  }

  setOptionRecipeCategory(optIdx: number, riIdx: number, catId: number | null): void {
    this.optionRecipeCategoryMap.set(`${optIdx}-${riIdx}`, catId);
    this.getOptionRecipe(optIdx).at(riIdx).get('supplyVariantId')?.setValue(null);
  }

  filteredVariantsForOptionRecipe(optIdx: number, riIdx: number): (SupplyVariantResponse & { displayName: string })[] {
    const catId = this.optionRecipeCategoryMap.get(`${optIdx}-${riIdx}`) ?? null;
    return catId ? this.supplyVariantOptions().filter(v => v.categoryId === catId) : this.supplyVariantOptions();
  }

  // Modal state
  modalIsOpen = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  currentStep = signal<WizardStep>(1);
  isSubmitting = signal(false);
  createdProduct = signal<ProductResponse | null>(null);
  existingOptions = signal<ProductOption[]>([]);

  // Detail dialog
  detailDialogOpen = signal(false);
  detailProduct = signal<ProductResponse | null>(null);
  detailOptions = signal<ProductOption[]>([]);
  detailOptionsLoading = signal(false);

  // ── Step 1: product base + base recipe ──────────────────────────
  baseForm: FormGroup = this.fb.group({
    id: [null],
    name: ['', [Validators.required, Validators.minLength(2)]],
    basePrice: [null, [Validators.required, Validators.min(0)]],
    hasOptions: [false, Validators.required],
    categoryId: [null, Validators.required],
    areaId: [null, Validators.required],
  });

  baseRecipe: FormArray = this.fb.array([]);

  // ── Step 2: product options, each with its own recipe ───────────
  optionsArray: FormArray = this.fb.array([]);

  hasOptions = computed(() => this.baseForm.get('hasOptions')?.value === true);

  // Track selected option IDs (existing options)
  selectedOptionIds = signal<number[]>([]);

  ngOnInit(): void {
    this.refreshProducts();
    forkJoin({
      areas: this.areaService.getAreas(),
      categories: this.categoryService.getCategories(),
      optionCategories: this.optionCategoryService.getOptionCategories(),
      variants: this.supplyService.getSupplyVariants(),
      productOptions: this.productOptionService.getOptions(),
    }).subscribe({
      next: ({ areas, categories, optionCategories, variants, productOptions }) => {
        this.areas.set(areas);
        this.categories.set(categories.filter(c => c.enabled));
        this.optionCategories.set(optionCategories);
        this.supplyVariantOptions.set(
          variants.map(v => ({ ...v, displayName: `${v.supplyName} — ${v.quantity} ${v.unitAbbreviation}` }))
        );
        this.allProductOptions.set(productOptions);
      },
      error: err => this.logger.error('Error loading reference data', err),
    });
  }

  // ── Table ────────────────────────────────────────────────────────

  filterProducts(): void {
    const nums = this.filterCategories.value;
    if (!nums || nums.length === 0) {
      this.refreshProducts();
    } else {
      this.productService.filterByCategories(nums).subscribe(res => this.products.set(res));
    }
  }

  // ── Modal open ───────────────────────────────────────────────────

  showCreationModal(): void {
    this.baseForm.reset({ hasOptions: false });
    this.baseRecipe.clear();
    this.optionsArray.clear();
    this.createdProduct.set(null);
    this.existingOptions.set([]);
    this.selectedOptionIds.set([]);
    this.baseRecipeCategoryMap.clear();
    this.optionRecipeCategoryMap.clear();
    this.currentStep.set(1);
    this.modalMode.set('create');
    this.modalIsOpen.set(true);
  }

  showModificationModal(id: number): void {
    this.baseForm.reset({ hasOptions: false });
    this.baseRecipe.clear();
    this.optionsArray.clear();
    this.createdProduct.set(null);
    this.existingOptions.set([]);
    this.selectedOptionIds.set([]);
    this.baseRecipeCategoryMap.clear();
    this.optionRecipeCategoryMap.clear();
    this.currentStep.set(1);
    this.modalMode.set('edit');
    this.productService.findProduct(id).pipe(
      switchMap(p => {
        this.baseForm.patchValue({
          id: p.id, name: p.name, basePrice: p.basePrice,
          hasOptions: p.hasOptions, categoryId: p.categoryId, areaId: p.areaId,
        });
        this.createdProduct.set(p);
        return p.hasOptions
          ? this.masterDataService.getProductOptions(p.id)
          : of([]);
      })
    ).subscribe(opts => {
      this.existingOptions.set(opts);
      // Pre-populate selectedOptionIds with existing option IDs
      this.selectedOptionIds.set(opts.map(o => o.id));
    });
    this.modalIsOpen.set(true);
  }

  closeModal(): void { this.modalIsOpen.set(false); }

  // ── Base recipe rows ─────────────────────────────────────────────

  addBaseRecipeItem(): void {
    this.baseRecipe.push(this.fb.group({
      supplyVariantId: [null, Validators.required],
      requiredQuantity: [null, [Validators.required, Validators.min(0.001)]],
    }));
  }

  removeBaseRecipeItem(i: number): void { this.baseRecipe.removeAt(i); }

  // ── Option rows ──────────────────────────────────────────────────

  addOption(): void {
    this.optionsArray.push(this.fb.group({
      id: [null], // ID if selecting existing option
      name: ['', Validators.required],
      optionCategoryId: [null, Validators.required],
      recipe: this.fb.array([]),
      isExisting: [false], // Flag to track if this is an existing option
    }));
  }

  removeOption(i: number): void { 
    const opt = this.optionsArray.at(i).value;
    // If it was an existing option, remove from selectedOptionIds
    if (opt.isExisting && opt.id) {
      this.selectedOptionIds.update(ids => ids.filter(id => id !== opt.id));
    }
    this.optionsArray.removeAt(i); 
  }

  getOptionRecipe(i: number): FormArray {
    return this.optionsArray.at(i).get('recipe') as FormArray;
  }

  addOptionRecipeItem(optionIndex: number): void {
    this.getOptionRecipe(optionIndex).push(this.fb.group({
      supplyVariantId: [null, Validators.required],
      requiredQuantity: [null, [Validators.required, Validators.min(0.001)]],
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
      .map(o => `${o.optionCategoryId}-${o.name.trim().toLowerCase()}`);
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
        idMap.get(opt.id)!.push(idx);
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
        const key = `${opt.optionCategoryId}-${opt.name.trim().toLowerCase()}`;
        if (!nameMap.has(key)) nameMap.set(key, []);
        nameMap.get(key)!.push(idx);
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

    const v = this.baseForm.value;

    // If hasOptions is true, go to step 2 to select/create options
    if (v.hasOptions) {
      this.currentStep.set(2);
      return;
    }

    // If hasOptions is false, create product immediately
    this.isSubmitting.set(true);

    if (this.modalMode() === 'create') {
      this.productService.createProduct({
        name: v.name,
        basePrice: v.basePrice,
        hasOptions: false,
        categoryId: v.categoryId,
        areaId: v.areaId,
        recipe: this.baseRecipe.value,
      }).pipe(
        catchError(err => {
          this.logger.error('Error creating product', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear el producto' });
          this.isSubmitting.set(false);
          return EMPTY;
        })
      ).subscribe(product => {
        this.createdProduct.set(product);
        this.isSubmitting.set(false);
        this.refreshProducts();
        this.currentStep.set(3);
      });
    } else {
      const id = v.id;
      this.productService.updateProduct(id, {
        id, name: v.name, basePrice: v.basePrice,
        hasOptions: false, categoryId: v.categoryId, areaId: v.areaId,
        recipe: this.baseRecipe.value,
      }).pipe(
        catchError(err => {
          this.logger.error('Error updating product', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el producto' });
          this.isSubmitting.set(false);
          return EMPTY;
        })
      ).subscribe(() => {
        this.isSubmitting.set(false);
        this.refreshProducts();
        this.currentStep.set(3);
      });
    }
  }

  submitStep2(): void {
    if (this.optionsArray.length === 0) { 
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Advertencia', 
        detail: 'Debes agregar al menos una opción o cambiar "¿Tiene opciones?" a No' 
      });
      return; 
    }
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

    // Separate existing options from new ones
    const existingOptionIds: number[] = [];
    const newOptions: { name: string; optionCategoryId: number; recipe: any[] }[] = [];

    for (const opt of this.optionsArray.value) {
      if (opt.isExisting && opt.id) {
        // Existing option - just use its ID
        existingOptionIds.push(opt.id);
      } else {
        // New option - needs to be created
        newOptions.push({
          name: opt.name,
          optionCategoryId: opt.optionCategoryId,
          recipe: opt.recipe || [],
        });
      }
    }

    // Create new options first (if any)
    const createNewOptions$ = newOptions.length > 0
      ? forkJoin(newOptions.map(opt => this.productService.createProductOption(opt)))
      : of([]);

    createNewOptions$.pipe(
      switchMap((createdOptions: any[]) => {
        // Collect all option IDs (existing + newly created)
        const allOptionIds = [
          ...existingOptionIds,
          ...createdOptions.map(opt => opt.id)
        ];

        // Refresh allProductOptions to include newly created options
        if (createdOptions.length > 0) {
          return this.productOptionService.getOptions().pipe(
            switchMap(allOpts => {
              this.allProductOptions.set(allOpts);
              return of(allOptionIds);
            })
          );
        }
        return of(allOptionIds);
      }),
      switchMap((allOptionIds: number[]) => {
        // Now create or update the product with all option IDs
        const v = this.baseForm.value;
        
        if (this.modalMode() === 'create') {
          return this.productService.createProduct({
            name: v.name,
            basePrice: v.basePrice,
            hasOptions: true,
            categoryId: v.categoryId,
            areaId: v.areaId,
            recipe: this.baseRecipe.value,
            optionIds: allOptionIds,
          });
        } else {
          return this.productService.updateProduct(v.id, {
            id: v.id,
            name: v.name,
            basePrice: v.basePrice,
            hasOptions: true,
            categoryId: v.categoryId,
            areaId: v.areaId,
            recipe: this.baseRecipe.value,
            optionIds: allOptionIds,
          }).pipe(
            switchMap(() => this.productService.findProduct(v.id))
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
      this.currentStep.set(3);
    });
  }

  skipOptions(): void {
    this.messageService.add({ 
      severity: 'warn', 
      summary: 'Advertencia', 
      detail: 'Debes agregar opciones o cambiar "¿Tiene opciones?" a No en el paso 1' 
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
    this.productService.getProducts().subscribe(res => this.products.set(res));
  }

  showDetailDialog(product: ProductResponse): void {
    this.detailProduct.set(product);
    this.detailOptions.set([]);
    this.detailDialogOpen.set(true);
    if (product.hasOptions) {
      this.detailOptionsLoading.set(true);
      this.productService.getOptions(product.id).pipe(
        catchError(() => of([] as ProductOption[]))
      ).subscribe(opts => {
        this.detailOptions.set(opts);
        this.detailOptionsLoading.set(false);
      });
    }
  }

  closeDetailDialog(): void {
    this.detailDialogOpen.set(false);
    this.detailProduct.set(null);
    this.detailOptions.set([]);
  }

  groupByCategory(options: ProductOption[]): { category: string; items: ProductOption[] }[] {
    const map = new Map<string, ProductOption[]>();
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

  // productos con hasOptions: true para el selector
  productsWithOptions = computed(() => (this.products() ?? []).filter(p => p.hasOptions));

  newOptionForm: FormGroup = this.fb.group({
    optionCategoryId: [null, Validators.required],
    name: ['', Validators.required],
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
      supplyVariantId: [null, Validators.required],
      requiredQuantity: [null, [Validators.required, Validators.min(0.001)]],
    }));
  }

  removeNewOptionRecipeItem(i: number): void { this.newOptionRecipe.removeAt(i); }

  submitNewOption(): void {
    if (this.newOptionForm.invalid) { this.newOptionForm.markAllAsTouched(); return; }
    const { optionCategoryId, name } = this.newOptionForm.value;
    this.newOptionSubmitting.set(true);
    this.productService.createProductOption({
      name, optionCategoryId,
      recipe: this.newOptionRecipe.value,
    }).pipe(
      switchMap(() => this.productOptionService.getOptions()),
      catchError(err => {
        this.logger.error('Error creating product option', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear la opción' });
        this.newOptionSubmitting.set(false);
        return EMPTY;
      })
    ).subscribe(allOpts => {
      this.allProductOptions.set(allOpts);
      this.newOptionSubmitting.set(false);
      this.newOptionDialogOpen.set(false);
      this.messageService.add({ severity: 'success', summary: 'Opción creada', detail: `"${name}" agregada correctamente` });
    });
  }
}
