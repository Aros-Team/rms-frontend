import { Component, inject, signal, Output, EventEmitter, Input, ChangeDetectionStrategy, effect } from '@angular/core';
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
import { Money } from '@app/shared/pipes/money/money';
import { toAmount } from '@app/shared/models/dto/common/money';

import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsInput } from '@app/shared/ui/input/input';

@Component({
  selector: 'app-new-option-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    IftaLabelModule,
    InputNumberModule,
    SelectModule,
    DividerModule,
    ToastModule,
    Money,
    RmsButton,
    RmsIconButton,
    RmsInput,
  ],
  providers: [MessageService],
  templateUrl: './new-option-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOptionDialog {
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

  newOptionForm = this.fb.group({
    optionCategoryId: [null as number | null, (control: AbstractControl) => Validators.required(control)],
    name: ['', (control: AbstractControl) => Validators.required(control)],
  });

  newOptionRecipe: FormArray = this.fb.array([]);

  private readonly newOptionRecipeCategoryMap = new Map<number, number | null>();

  // Field initializers run in an injection context; lifecycle hooks do not,
  // so effect() must be created here (not in ngOnInit) or it throws NG0203.
  private readonly referenceDataEffect = effect(() => {
    const refData = this.cache.referenceData.data();
    if (refData) {
      this.applyReferenceData(refData);
    }
  });

  private applyReferenceData(ref: ProductReferenceData): void {
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

  /**
   * `unitCost` is a MoneyDto ({ amount: string, currency: string }) on the wire,
   * so it can never be compared to a number directly.
   */
  hasNoCost(variant: SupplyVariantResponse): boolean {
    return toAmount(variant.unitCost) === 0;
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
      optionGroupId: optionCategoryId ?? 0,
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