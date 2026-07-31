import { Component, inject, signal, OnInit, Output, EventEmitter, Input, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AbstractControl, FormBuilder, FormArray, Validators } from '@angular/forms';
import { switchMap, catchError, EMPTY } from 'rxjs';
import { Product } from '@app/core/services/products/product';
import { ProductOption } from '@app/core/services/product-option/product-option';
import { Logging } from '@app/core/services/logging/logging';
import { ProductCache, ProductReferenceData } from '../../product-cache';
import { SupplyVariantResponse } from '@app/shared/models/dto/supplies/supply-variant-response';
import { RecipeItemRequest } from '@app/shared/models/dto/products/product-create-request';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-new-option-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    IftaLabelModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    DividerModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './new-option-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOptionDialog implements OnInit {
  @Input() visible = signal(false);
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() optionCreated = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private productService = inject(Product);
  private productOptionService = inject(ProductOption);
  private logger = inject(Logging);
  private messageService = inject(MessageService);
  readonly cache = inject(ProductCache);

  optionCategories = signal<{ id: number; name: string }[]>([]);
  supplyVariantOptions = signal<(SupplyVariantResponse & { displayName: string })[]>([]);
  supplyCategories = signal<{ id: number; name: string }[]>([]);
  newOptionSubmitting = signal(false);
  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

  newOptionForm = this.fb.group({
    optionCategoryId: [null as number | null, (control: AbstractControl) => Validators.required(control)],
    name: ['', (control: AbstractControl) => Validators.required(control)],
  });

  newOptionRecipe: FormArray = this.fb.array([]);

  private readonly newOptionRecipeCategoryMap = new Map<number, number | null>();

  ngOnInit(): void {
    this.loadReferenceData();
  }

  // Field initializers run in an injection context; lifecycle hooks do not,
  // so effect() must be created here (not in ngOnInit) or it throws NG0203.
  private readonly referenceDataEffect = effect(() => {
    const refData = this.cache.referenceData.data();
    if (refData) {
      this.applyReferenceData(refData);
    }
  });

  private loadReferenceData(): void {
    this.cache.referenceData.loadIfStale();
  }

  private applyReferenceData(ref: ProductReferenceData): void {
    this.optionCategories.set(ref.optionCategories);
    this.supplyVariantOptions.set(ref.variants);
    const seen = new Set<number>();
    this.supplyCategories.set(
      ref.variants.filter((v: SupplyVariantResponse & { displayName: string }) => {
        if (seen.has(v.categoryId)) return false;
        seen.add(v.categoryId);
        return true;
      }).map((v: SupplyVariantResponse & { displayName: string }) => ({ id: v.categoryId, name: v.categoryName }))
    );
  }

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

  findVariantById(id: number | null): (SupplyVariantResponse & { displayName: string }) | undefined {
    if (id == null) return undefined;
    return this.supplyVariantOptions().find(v => v.id === id);
  }

  addNewOptionRecipeItem(): void {
    this.newOptionRecipe.push(this.fb.group({
      supplyVariantId: [null as number | null, (control: AbstractControl) => Validators.required(control)],
      requiredQuantity: [null as number | null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0.001)(control)]],
    }));
  }

  removeNewOptionRecipeItem(i: number): void {
    this.newOptionRecipe.removeAt(i);
  }

  submitNewOption(): void {
    if (this.newOptionForm.invalid) {
      this.newOptionForm.markAllAsTouched();
      return;
    }
    const { optionCategoryId, name } = this.newOptionForm.value;
    if (!name) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rawItems = this.newOptionRecipe.value;
    const toRecipeItem = (r: unknown): RecipeItemRequest => ({
      supplyVariantId: (r as RecipeItemRequest).supplyVariantId,
      requiredQuantity: (r as RecipeItemRequest).requiredQuantity,
    });
    const recipeItems: RecipeItemRequest[] = Array.isArray(rawItems) ? rawItems.map(toRecipeItem) : [];

    this.newOptionSubmitting.set(true);

    this.productService.createProductOption({
      name,
      optionCategoryId: optionCategoryId ?? 0,
      recipe: recipeItems,
    }).pipe(
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
      this.close();
      this.messageService.add({ severity: 'success', summary: 'Opción creada', detail: `"${name}" agregada correctamente` });
      this.optionCreated.emit();
    });
  }

  close(): void {
    this.visible.set(false);
    this.visibleChange.emit(false);
  }
}