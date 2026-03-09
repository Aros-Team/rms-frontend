import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { RmsPageHeaderComponent } from '../../../../shared/ui/page-header/rms-page-header.component';
import { RmsInputComponent } from '../../../../shared/ui/input/rms-input.component';
import { RmsSelectComponent } from '../../../../shared/ui/select/rms-select.component';
import { RmsTextareaComponent } from '../../../../shared/ui/textarea/rms-textarea.component';
import { RmsButtonComponent } from '../../../../shared/ui/button/rms-button.component';
import { GetAreasUseCase } from '../../../../core/products/application/use-cases/get-areas.use-case';
import { GetCategoriesUseCase } from '../../../../core/products/application/use-cases/get-categories.use-case';
import { CreateProductUseCase } from '../../../../core/products/application/use-cases/create-product.use-case';
import { Area } from '../../../../core/products/domain/models/area.model';
import { Category } from '../../../../core/products/domain/models/category.model';

@Component({
  selector: 'app-product-create-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    CheckboxModule,
    RmsPageHeaderComponent,
    RmsInputComponent,
    RmsSelectComponent,
    RmsTextareaComponent,
    RmsButtonComponent,
  ],
  templateUrl: './product-create.page.html',
  styleUrl: './product-create.page.css',
})
export class ProductCreatePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly router = inject(Router);
  private readonly getAreasUseCase = inject(GetAreasUseCase);
  private readonly getCategoriesUseCase = inject(GetCategoriesUseCase);
  private readonly createProductUseCase = inject(CreateProductUseCase);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly areas = signal<Area[]>([]);
  readonly categories = signal<Category[]>([]);

  readonly areaOptions = () =>
    this.areas().map(a => ({ label: a.name, value: a.id }));

  readonly categoryOptions = () =>
    this.categories().map(c => ({ label: c.name, value: c.id }));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    categoryId: [null as number | null, Validators.required],
    areaId: [null as number | null, Validators.required],
    basePrice: [null as number | null, [Validators.required, Validators.min(0)]],
    hasOptions: [false],
    description: [''],
  });

  ngOnInit(): void {
    this.getAreasUseCase.execute().subscribe({
      next: (areas) => this.areas.set(areas),
      error: () => this.areas.set([]),
    });

    this.getCategoriesUseCase.execute().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.categories.set([]),
    });
  }

  onCategoryChange(value: string | number | null): void {
    if (typeof value === 'number') {
      this.form.patchValue({ categoryId: value });
    }
  }

  onAreaChange(value: string | number | null): void {
    if (typeof value === 'number') {
      this.form.patchValue({ areaId: value });
    }
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    const areaValid = this.areas().some(a => a.id === this.form.value.areaId);
    const categoryValid = this.categories().some(c => c.id === this.form.value.categoryId);

    if (!areaValid || !categoryValid) {
      this.errorMessage.set('Seleccione un área y categoría válidos');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    const formValue = this.form.getRawValue();
    this.createProductUseCase.execute({
      name: formValue.name,
      basePrice: formValue.basePrice!,
      hasOptions: formValue.hasOptions || false,
      categoryId: formValue.categoryId!,
      areaId: formValue.areaId!,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.successMessage.set('Producto guardado exitosamente!');
        setTimeout(() => {
          this.router.navigateByUrl('/admin/products');
        }, 1500);
      },
      error: (err) => {
        this.loading.set(false);
        const backendMessage = err?.error?.message || err?.message;
        this.errorMessage.set(backendMessage || 'No se pudo crear el producto.');
      },
    });
  }
}
