import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RmsPageHeaderComponent } from '../../../../shared/ui/page-header/rms-page-header.component';
import { RmsInputComponent } from '../../../../shared/ui/input/rms-input.component';
import { RmsSelectComponent } from '../../../../shared/ui/select/rms-select.component';
import { RmsTextareaComponent } from '../../../../shared/ui/textarea/rms-textarea.component';
import { RmsButtonComponent } from '../../../../shared/ui/button/rms-button.component';

@Component({
  selector: 'app-product-create-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    RmsPageHeaderComponent,
    RmsInputComponent,
    RmsSelectComponent,
    RmsTextareaComponent,
    RmsButtonComponent,
  ],
  templateUrl: './product-create.page.html',
  styleUrl: './product-create.page.css',
})
export class ProductCreatePageComponent {
  private readonly fb = inject(FormBuilder);
  readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly categories = [
    { label: 'Entradas', value: 'entradas' },
    { label: 'Platos Fuertes', value: 'platos_fuertes' },
    { label: 'Bebidas', value: 'bebidas' },
    { label: 'Postres', value: 'postres' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    category: ['', Validators.required],
    price: [null as number | null, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0)]],
    description: [''],
    imageUrl: [''],
  });

  onCategoryChange(value: string | number | null): void {
    this.form.patchValue({ category: value as string });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    setTimeout(() => {
      this.loading.set(false);
      this.successMessage.set('Producto guardado exitosamente!');
      setTimeout(() => {
        this.router.navigateByUrl('/admin/products');
      }, 1500);
    }, 1000);
  }
}
