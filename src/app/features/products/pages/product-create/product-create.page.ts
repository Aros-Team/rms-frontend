import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-product-create-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
  ],
  template: `
    <main class="page-container">
      <header class="page-header">
        <div>
          <h1>Nuevo Producto</h1>
          <p>Agrega un nuevo producto al catalogo</p>
        </div>
      </header>

      <form [formGroup]="form" (ngSubmit)="submit()" class="product-form">
        <div class="form-row">
          <div class="form-group">
            <label for="name">Nombre del producto</label>
            <input
              id="name"
              type="text"
              formControlName="name"
              placeholder="Ej: Hamburguesa clasica"
              class="input-field"
            />
          </div>

          <div class="form-group">
            <label for="category">Categoria</label>
            <select id="category" formControlName="category" class="input-field select-field">
              <option value="">Selecciona una categoria</option>
              @for (let cat of categories; track cat.value) {
                <option [value]="cat.value">
                  {{ cat.label }}
                </option>
              }
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="price">Precio</label>
            <input
              id="price"
              type="number"
              formControlName="price"
              placeholder="0.00"
              step="0.01"
              min="0"
              class="input-field"
            />
          </div>

          <div class="form-group">
            <label for="stock">Stock</label>
            <input
              id="stock"
              type="number"
              formControlName="stock"
              placeholder="0"
              min="0"
              class="input-field"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="description">Descripcion</label>
          <textarea
            id="description"
            formControlName="description"
            rows="3"
            placeholder="Describe el producto..."
            class="input-field textarea"
          ></textarea>
        </div>

        <div class="form-group">
          <label for="imageUrl">URL de imagen (opcional)</label>
          <input
            id="imageUrl"
            type="url"
            formControlName="imageUrl"
            placeholder="https://ejemplo.com/imagen.jpg"
            class="input-field"
          />
        </div>

        @if (errorMessage()) {
          <p class="error-message">{{ errorMessage() }}</p>
        }
        @if (successMessage()) {
          <p class="success-message">{{ successMessage() }}</p>
        }

        <div class="form-actions">
          <button pButton type="button" routerLink="/products" label="Cancelar" class="cancel-btn"></button>
          <button pButton type="submit" [label]="loading() ? 'Guardando...' : 'Guardar Producto'" [disabled]="form.invalid || loading()"></button>
        </div>
      </form>
    </main>
  `,
  styles: [
    `
      .page-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        max-width: 800px;
      }

      .page-header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: #f1f5f9;
        margin: 0;
      }

      .page-header p {
        color: #64748b;
        font-size: 0.875rem;
        margin: 0.25rem 0 0;
      }

      .product-form {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 1rem;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      @media (max-width: 600px) {
        .form-row {
          grid-template-columns: 1fr;
        }
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .form-group label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #e2e8f0;
      }

      .input-field {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 2px solid #000;
        border-radius: 0.65rem;
        background: #fff;
        font-size: 0.95rem;
        color: #0f172a;
        box-sizing: border-box;
      }

      .input-field:focus {
        outline: none;
        border-color: #0f172a;
        box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.15);
      }

      .select-field {
        cursor: pointer;
      }

      .textarea {
        resize: vertical;
        min-height: 80px;
      }

      .error-message {
        color: #f87171;
        font-size: 0.875rem;
        margin: 0;
      }

      .success-message {
        color: #4ade80;
        font-size: 0.875rem;
        margin: 0;
      }

      .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        padding-top: 0.5rem;
      }

      .form-actions button {
        padding: 0.75rem 1.5rem;
        border-radius: 0.65rem;
        font-weight: 500;
      }

      .form-actions button[type="submit"] {
        background: #0f172a;
        border: none;
      }

      .form-actions button[type="submit"]:hover:not(:disabled) {
        background: #1e293b;
      }

      .form-actions button[type="submit"]:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .cancel-btn {
        background: transparent !important;
        border: 1px solid #475569 !important;
        color: #94a3b8 !important;
      }

      .cancel-btn:hover {
        background: #334155 !important;
        color: #e2e8f0 !important;
      }
    `,
  ],
})
export class ProductCreatePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

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
        this.router.navigateByUrl('/products');
      }, 1500);
    }, 1000);
  }
}
