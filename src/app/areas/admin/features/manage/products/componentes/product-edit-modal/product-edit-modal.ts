import { Component, inject, Input, Output, EventEmitter, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Product } from '@app/core/services/products/product';
import { Logging } from '@app/core/services/logging/logging';
import { ProductCacheService } from '../../product-cache.service';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { AbstractControl, FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-product-edit-modal',
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
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './product-edit-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductEditModal implements OnInit {
  @Input() productId: number | null = null;
  @Input() visible = signal(false);
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() productUpdated = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private productService = inject(Product);
  private logger = inject(Logging);
  private messageService = inject(MessageService);
  readonly cache = inject(ProductCacheService);

  categories = signal<{ id: number; name: string }[]>([]);
  areas = signal<{ id: number; name: string }[]>([]);
  isLoading = signal(false);
  isSaving = signal(false);

  editForm = this.fb.group({
    id: [null as number | null],
    name: ['', [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.minLength(2)(control)]],
    basePrice: [null as number | null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0)(control)]],
    categoryId: [null as number | null, (control: AbstractControl) => Validators.required(control)],
    areaId: [null as number | null, (control: AbstractControl) => Validators.required(control)],
    active: [true],
  });

  ngOnInit(): void {
    this.loadReferenceData();
    if (this.productId) {
      this.loadProduct(this.productId);
    }
  }

  private loadReferenceData(): void {
    this.cache.referenceData.loadIfStale();
    const ref = this.cache.referenceData.data();
    this.categories.set(ref?.categories ?? []);
    this.areas.set(ref?.areas ?? []);
  }

  loadProduct(id: number): void {
    this.isLoading.set(true);
    this.productService.findProduct(id).subscribe({
      next: (product) => {
        this.editForm.patchValue({
          id: product.id,
          name: product.name,
          basePrice: product.basePrice,
          categoryId: product.categoryId,
          areaId: product.areaId,
          active: product.active,
        });
        this.isLoading.set(false);
      },
      error: (err) => {
        this.logger.error('Error loading product', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el producto',
        });
        this.isLoading.set(false);
        this.close();
      }
    });
  }

  save(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const formValue = this.editForm.value;
    const productId = formValue.id ?? 0;

    this.isSaving.set(true);
    this.productService.updateProduct(productId, {
      id: productId,
      name: formValue.name ?? '',
      basePrice: formValue.basePrice ?? 0,
      categoryId: formValue.categoryId ?? 0,
      areaId: formValue.areaId ?? 0,
      recipe: [],
      optionIds: [],
    }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Producto actualizado',
          detail: 'Los cambios fueron guardados correctamente',
        });
        this.cache.products.refresh();
        this.isSaving.set(false);
        this.productUpdated.emit();
        this.close();
      },
      error: (err) => {
        this.logger.error('Error updating product', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar los cambios',
        });
        this.isSaving.set(false);
      }
    });
  }

  close(): void {
    this.visible.set(false);
    this.visibleChange.emit(false);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.editForm.get(field);
    if (!control) return false;
    return control.invalid && control.touched;
  }
}