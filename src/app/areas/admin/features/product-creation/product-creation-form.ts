import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { Area } from '@app/core/services/areas/area';
import { Category } from '@app/core/services/category/category';
import { Logging } from '@app/core/services/logging/logging';
import { Product } from '@app/core/services/products/product';
import { AreaSimpleResponse } from '@app/shared/models/dto/areas/area-simple-response';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsTextarea } from '@app/shared/ui/textarea/textarea';

/**
 * Minimal product form. It posts to `POST /v1/products` through the `Product`
 * service, using the real `ProductRequest` field names (`basePrice`,
 * `categoryId`, `areaId`, `estimatedPrepMinutes`).
 */
@Component({
  selector: 'app-product-creation-form',
  templateUrl: './product-creation-form.html',
  imports: [ReactiveFormsModule, RmsButton, RmsInput, RmsTextarea],
})
export class ProductCreationForm implements OnInit {
  private productService = inject(Product);
  private areaService = inject(Area);
  private categoryService = inject(Category);
  private logger = inject(Logging);

  readonly areas = signal<AreaSimpleResponse[]>([]);
  readonly categories = signal<CategorySimpleResponse[]>([]);

  form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [(control) => Validators.required(control)],
    }),
    basePrice: new FormControl(0, {
      nonNullable: true,
      validators: [(control) => Validators.required(control), (control) => Validators.min(0)(control)],
    }),
    description: new FormControl('', { nonNullable: true }),
    estimatedPrepMinutes: new FormControl<number | null>(null),
    categoryId: new FormControl<number | null>(null, [(control) => Validators.required(control)]),
    areaId: new FormControl<number | null>(null, [(control) => Validators.required(control)]),
  });

  ngOnInit(): void {
    this.areaService.getAreas().subscribe({
      next: (areas) => { this.areas.set(areas); },
      error: (err: unknown) => { this.logger.error('Error loading areas', err); },
    });
    this.categoryService.getCategories().subscribe({
      next: (categories) => { this.categories.set(categories); },
      error: (err: unknown) => { this.logger.error('Error loading categories', err); },
    });
  }

  createProduct(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, basePrice, description, estimatedPrepMinutes, categoryId, areaId } = this.form.getRawValue();
    if (categoryId == null || areaId == null) return;

    this.productService.createProduct({
      name,
      basePrice,
      description: description || undefined,
      estimatedPrepMinutes: estimatedPrepMinutes ?? undefined,
      categoryId,
      areaId,
      recipe: [],
    }).subscribe({
      next: (product) => {
        this.logger.debug('Product created:', product);
        this.form.reset({ name: '', basePrice: 0, description: '', estimatedPrepMinutes: null, categoryId: null, areaId: null });
      },
      error: (err: unknown) => { this.logger.error('Error creating product:', err); },
    });
  }
}
