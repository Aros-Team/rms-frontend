import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormArray, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, EMPTY, switchMap } from 'rxjs';

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
    ).subscribe(opts => this.existingOptions.set(opts));
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
      name: ['', Validators.required],
      optionCategoryId: [null, Validators.required],
      recipe: this.fb.array([]),
    }));
  }

  removeOption(i: number): void { this.optionsArray.removeAt(i); }

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

  // ── Validación: una sola opción por categoría ────────────────────

  /** Devuelve true si hay categorías duplicadas en optionsArray */
  hasDuplicateCategories(): boolean {
    const ids = (this.optionsArray.value as { optionCategoryId: number | null }[])
      .map(o => o.optionCategoryId)
      .filter(id => id !== null);
    return ids.length !== new Set(ids).size;
  }

  /** Devuelve los ids de categorías que están duplicadas */
  duplicateCategoryIds(): Set<number> {
    const ids = (this.optionsArray.value as { optionCategoryId: number | null }[])
      .map(o => o.optionCategoryId)
      .filter((id): id is number => id !== null);
    const seen = new Set<number>();
    const dupes = new Set<number>();
    for (const id of ids) {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    }
    return dupes;
  }

  isCategoryDuplicated(optionIndex: number): boolean {
    const id = this.optionsArray.at(optionIndex).get('optionCategoryId')?.value as number | null;
    if (!id) return false;
    return this.duplicateCategoryIds().has(id);
  }

  // ── Wizard navigation ────────────────────────────────────────────

  submitStep1(): void {
    if (this.baseForm.invalid) { this.baseForm.markAllAsTouched(); return; }

    this.isSubmitting.set(true);
    const v = this.baseForm.value;

    if (this.modalMode() === 'create') {
      this.productService.createProduct({
        name: v.name,
        basePrice: v.basePrice,
        hasOptions: v.hasOptions,
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
        if (v.hasOptions) {
          // Producto creado, ahora el usuario define las opciones
          this.currentStep.set(2);
        } else {
          // Sin opciones: flujo terminado
          this.refreshProducts();
          this.currentStep.set(3);
        }
      });
    } else {
      const id = v.id;
      this.productService.updateProduct(id, {
        id, name: v.name, basePrice: v.basePrice,
        hasOptions: v.hasOptions, categoryId: v.categoryId, areaId: v.areaId,
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
        this.currentStep.set(v.hasOptions ? 2 : 3);
      });
    }
  }

  submitStep2(): void {
    if (this.optionsArray.length === 0) { this.currentStep.set(3); return; }
    if (this.optionsArray.invalid) { this.optionsArray.markAllAsTouched(); return; }
    if (this.hasDuplicateCategories()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Categorías duplicadas',
        detail: 'Solo puedes agregar una opción por categoría',
      });
      return;
    }

    const productId = this.createdProduct()?.id;
    if (!productId) return;

    this.isSubmitting.set(true);

    // Crear todas las opciones en paralelo
    const optionPayloads = (this.optionsArray.value as { name: string; optionCategoryId: number; recipe: { supplyVariantId: number; requiredQuantity: number }[] }[])
      .map(opt => {
        const payload: ProductOptionCreateRequest = {
          name: opt.name,
          optionCategoryId: opt.optionCategoryId,
          productId,
          recipe: opt.recipe,
        };
        return this.productService.createProductOption(payload);
      });

    forkJoin(optionPayloads).pipe(
      // Después de crear todas, consultar las opciones guardadas del producto
      switchMap(() => this.masterDataService.getProductOptions(productId)),
      catchError(err => {
        this.logger.error('Error saving options', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron guardar algunas opciones' });
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
    this.refreshProducts();
    this.currentStep.set(3);
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
}
