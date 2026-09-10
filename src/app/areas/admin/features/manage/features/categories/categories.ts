import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Category } from '@app/core/services/category/category';
import { Logging } from '@app/core/services/logging/logging';
import { Supply } from '@app/core/services/supplies/supply';
import { CategoriesCache } from './categories-cache';
import { LazyLoad } from '@app/core/directives/lazy-load/lazy-load.directive';

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
    LazyLoad,
  ],
  templateUrl: './categories.html',
  providers: [MessageService],
})
export class Categories implements OnInit {
  title = 'Categorías';

  private fb = inject(FormBuilder);
  private categoryService = inject(Category);
  private supplyService = inject(Supply);
  private messageService = inject(MessageService);
  private confirmService = inject(ConfirmationService);
  private logger = inject(Logging);
  readonly cache = inject(CategoriesCache);

  // ── Product categories ───────────────────────────────────────────
  productCategories = computed(() => this.cache.productCategories.data() ?? []);
  activeCategories = computed(() => this.productCategories().filter(c => c.enabled));
  inactiveCategories = computed(() => this.productCategories().filter(c => !c.enabled));
  productCategoryDialogOpen = signal(false);

  productCategoryForm: FormGroup = this.fb.group({
    name: ['', (control: AbstractControl) => Validators.required(control)],
  });
  productCategorySaved = signal(false);
  productCategoryError = signal<string | null>(null);

  // ── Supply categories ─────────────────────────────────────────────
  supplyCategories = computed(() => this.cache.supplyCategories.data() ?? []);
  supplyCategoryDialogOpen = signal(false);

  supplyCategoryForm: FormGroup = this.fb.group({
    name: ['', (control: AbstractControl) => Validators.required(control)],
  });
  supplyCategorySaved = signal(false);
  supplyCategoryError = signal<string | null>(null);

  ngOnInit(): void {
    // Force load on first visit if no data
    if (this.cache.productCategories.data() === null) {
      this.cache.productCategories.refresh();
    }
    if (this.cache.supplyCategories.data() === null) {
      this.cache.supplyCategories.refresh();
    }
  }

  onVisible(): void {
    this.cache.productCategories.loadIfStale();
    this.cache.supplyCategories.loadIfStale();
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
    const nameControl = this.productCategoryForm.get('name');
    const name: string = (nameControl?.value as string | null | undefined) ?? '';
    this.categoryService.createCategory({ name }).subscribe({
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
      accept: () => { this.toggleCategory(id); },
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
    this.cache.productCategories.refresh();
  }

  // ── Supply category actions ───────────────────────────────────────

  openSupplyCategoryDialog(): void {
    this.supplyCategoryForm.reset();
    this.supplyCategorySaved.set(false);
    this.supplyCategoryError.set(null);
    this.supplyCategoryDialogOpen.set(true);
  }

  saveSupplyCategory(): void {
    this.supplyCategorySaved.set(false);
    if (this.supplyCategoryForm.invalid) {
      this.supplyCategoryForm.markAllAsTouched();
      return;
    }
    const nameControl = this.supplyCategoryForm.get('name');
    const name: string = (nameControl?.value as string | null | undefined) ?? '';
    this.supplyService.createCategory({ name }).subscribe({
      next: () => {
        this.supplyCategorySaved.set(true);
        this.supplyCategoryForm.reset();
        this.refreshSupplyCategories();
        this.messageService.add({ severity: 'success', summary: 'Categoría creada', detail: 'Categoría de insumo guardada.' });
        this.supplyCategoryDialogOpen.set(false);
      },
      error: () => {
        this.supplyCategoryError.set('No se pudo guardar la categoría de insumo');
        this.logger.error('Error creating supply category');
      },
    });
  }

  private refreshSupplyCategories(): void {
    this.cache.supplyCategories.refresh();
  }
}
