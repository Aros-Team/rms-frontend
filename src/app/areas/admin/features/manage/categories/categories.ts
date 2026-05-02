import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Category } from '@app/core/services/category/category';
import { OptionCategory } from '@app/core/services/option-category/option-category';
import { Logging } from '@app/core/services/logging/logging';

import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { OptionCategoryResponse } from '@app/shared/models/dto/category/option-category.model';
import { FormValidation } from '@app/shared/components/form/form-validation';

import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IftaLabelModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    FormValidation,
    ChipModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
  ],
  templateUrl: './categories.html',
  providers: [MessageService],
})
export class Categories implements OnInit {
  title = 'Categorías';
  description = 'Gestiona las categorías de productos del restaurante';

  private fb = inject(FormBuilder);
  private categoryService = inject(Category);
  private optionCategoryService = inject(OptionCategory);
  private messageService = inject(MessageService);
  private confirmService = inject(ConfirmationService);
  private logger = inject(Logging);

  // ── Product categories ───────────────────────────────────────────
  activeCategories = signal<CategorySimpleResponse[]>([]);
  inactiveCategories = signal<CategorySimpleResponse[]>([]);
  productCategoryDialogOpen = signal(false);

  productCategoryForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
  });
  productCategorySaved = signal(false);
  productCategoryError = signal<string | null>(null);

  // ── Option categories ────────────────────────────────────────────
  optionCategories = signal<OptionCategoryResponse[]>([]);
  optionCategoryDialogOpen = signal(false);

  optionCategoryForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });
  optionCategorySaved = signal(false);
  optionCategoryError = signal<string | null>(null);

  ngOnInit(): void {
    this.refreshProductCategories();
    this.refreshOptionCategories();
  }

  // ── Product category actions ─────────────────────────────────────

  openProductCategoryDialog(): void {
    this.productCategoryForm.reset();
    this.productCategorySaved.set(false);
    this.productCategoryError.set(null);
    this.productCategoryDialogOpen.set(true);
  }

  saveProductCategory(): void {
    this.productCategorySaved.set(false);
    if (this.productCategoryForm.invalid) {
      this.productCategoryForm.markAllAsTouched();
      return;
    }
    this.categoryService.createCategory({ name: this.productCategoryForm.get('name')!.value }).subscribe({
      next: () => {
        this.productCategorySaved.set(true);
        this.productCategoryForm.reset();
        this.refreshProductCategories();
        this.messageService.add({ severity: 'success', summary: 'Categoría creada', detail: 'Categoría de producto guardada.' });
        this.productCategoryDialogOpen.set(false);
      },
      error: () => {
        this.productCategoryError.set('No se pudo guardar la categoría');
        this.logger.error('Error creating product category');
      },
    });
  }

  confirmCategoryToggle(id: number): void {
    this.confirmService.confirm({
      message: '<b>¿Estás seguro de cambiar el estado de esta categoría?</b>',
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Confirmar',
      rejectLabel: 'Cancelar',
      accept: () => this.toggleCategory(id),
    });
  }

  private toggleCategory(id: number): void {
    this.categoryService.toggleCategory(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Estado actualizado', detail: 'Se actualizó el estado de la categoría.' });
        this.refreshProductCategories();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar la categoría.' });
      },
    });
  }

  private refreshProductCategories(): void {
    this.categoryService.getCategories().subscribe(res => {
      this.activeCategories.set(res.filter(c => c.enabled));
      this.inactiveCategories.set(res.filter(c => !c.enabled));
    });
  }

  // ── Option category actions ──────────────────────────────────────

  openOptionCategoryDialog(): void {
    this.optionCategoryForm.reset();
    this.optionCategorySaved.set(false);
    this.optionCategoryError.set(null);
    this.optionCategoryDialogOpen.set(true);
  }

  saveOptionCategory(): void {
    this.optionCategorySaved.set(false);
    if (this.optionCategoryForm.invalid) {
      this.optionCategoryForm.markAllAsTouched();
      return;
    }
    const { name, description } = this.optionCategoryForm.value;
    this.optionCategoryService.createOptionCategory({ name, description: description || undefined }).subscribe({
      next: () => {
        this.optionCategorySaved.set(true);
        this.optionCategoryForm.reset();
        this.refreshOptionCategories();
        this.messageService.add({ severity: 'success', summary: 'Categoría creada', detail: 'Categoría de opción guardada.' });
        this.optionCategoryDialogOpen.set(false);
      },
      error: () => {
        this.optionCategoryError.set('No se pudo guardar la categoría de opción');
        this.logger.error('Error creating option category');
      },
    });
  }

  private refreshOptionCategories(): void {
    this.optionCategoryService.getOptionCategories().subscribe(res => this.optionCategories.set(res));
  }
}
