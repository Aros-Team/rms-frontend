import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { Order } from '@core/services/orders/order';
import { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request.model';
import { MessageService } from 'primeng/api';
import { Product } from '@core/services/products/product';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Logging } from '@core/services/logging/logging';
import { Cart } from '@core/services/cart/cart';
import { MasterData } from '@app/core/services/master-data/master-data';
import { OptionCategory } from '@app/core/services/option-category/option-category';

@Component({
  selector: 'app-order-creation-form',
  templateUrl: './order-creation-form.html',
  imports: [CommonModule, ReactiveFormsModule]
})
export class OrderCreationForm implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private orderService = inject(Order);
  private messageService = inject(MessageService);
  private productService = inject(Product);
  private destroyRef = inject(DestroyRef);
  private logger = inject(Logging);

  title = 'Crear pedido';
  description = 'Registra un nuevo pedido indicando la mesa y los productos para cada orden de cliente.';

  form: FormGroup = this.fb.group({
    table: new FormControl<number | null>(null, { nonNullable: false, validators: [Validators.required, Validators.min(1)] }),
    clientOrders: this.fb.array([this.createClientOrderGroup()])
  });

  products: ProductListResponse[] = [];
  productsLoading = false;
  get isSubmitDisabled(): boolean {
    return this.form.invalid || this.productsLoading;
  }

  get clientOrders(): FormArray<FormGroup> {
    return this.form.get('clientOrders') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  createClientOrderGroup(): FormGroup {
    return this.fb.group({
      details: this.fb.array([this.createDetailGroup()])
    });
  }

  createDetailGroup(): FormGroup {
    return this.fb.group({
      product: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
      quantity: new FormControl<number>(1, [Validators.required, Validators.min(1)]),
      observations: new FormControl<string>('', []),
      subProducts: new FormControl<string>('', []) // comma-separated ids
    });
  }

  detailsAt(index: number): FormArray<FormGroup> {
    return (this.clientOrders.at(index).get('details') as FormArray<FormGroup>);
  }

  addClientOrder(): void {
    this.clientOrders.push(this.createClientOrderGroup());
  }

  removeClientOrder(index: number): void {
    if (this.clientOrders.length > 1) {
      this.clientOrders.removeAt(index);
    }
  }

  addDetail(clientIndex: number): void {
    this.detailsAt(clientIndex).push(this.createDetailGroup());
  }

  removeDetail(clientIndex: number, detailIndex: number): void {
    const details = this.detailsAt(clientIndex);
    if (details.length > 1) {
      details.removeAt(detailIndex);
    }
  }

  submit(): void {
    this.logger.debug('OrderCreationForm.submit called');
    this.logger.debug('Form status', this.form.status);
    this.logger.debug('Form value', this.form.getRawValue());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.logger.warn('OrderCreationForm.submit aborted: form invalid', this.form.errors);
      return;
    }

    interface DetailFormValue { product: number | null; quantity: number; observations: string; subProducts: string }
    interface ClientOrderFormValue { details: DetailFormValue[] }

    const raw = this.form.getRawValue() as { table: number | null; clientOrders: ClientOrderFormValue[] };

    const request: CreateOrderRequest = {
      tableId: Number(raw.table),
      details: raw.clientOrders.flatMap((co) =>
        co.details.map((d) => {
          const parsedSubProducts = (d.subProducts)
            ? d.subProducts.split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !isNaN(Number(s)))
                .map(n => Number(n))
            : [];

          return {
            productId: Number(d.product),
            instructions: d.observations?.trim() ?? '',
            selectedOptionIds: parsedSubProducts,
          };
        })
      )
    };
    this.logger.debug('CreateOrder request payload', request);

    this.orderService.createOrder(request).subscribe({
      next: () => {
        this.logger.info('CreateOrder success');
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Pedido creado correctamente.' });
      },
      error: (err) => {
        this.logger.error('CreateOrder failed', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: this.resolveCreateOrderError(err) });
      }
    });
  }

  private resolveCreateOrderError(err: { status?: number; error?: { message?: string } }): string {
    const status = err?.status;
    const message = err?.error?.message ?? '';

    if (status === 409) {
      if (message.startsWith('Table not available')) return 'La mesa no está disponible.';
      if (message.startsWith('Insufficient stock')) return 'Stock insuficiente para completar la orden.';
      return message || 'Conflicto al procesar la orden.';
    }

    if (status === 404) {
      if (message.startsWith('Table not found')) return 'Mesa no encontrada.';
      if (message.startsWith('Product not found')) return 'Producto no encontrado.';
      return message || 'Recurso no encontrado.';
    }

    if (status === 400) {
      if (message.startsWith('Option') && message.includes('is not valid for product')) return 'Opción no válida para este producto.';
      if (message) return `Datos inválidos: ${message}`;
      return 'Datos inválidos, revisa el formulario.';
    }

    return message || 'No se pudo crear el pedido.';
  }

  private loadProducts(): void {
    this.productsLoading = true;
    this.productService.getAllProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          this.products = products;
          this.productsLoading = false;
        },
        error: (err) => {
          console.error('Error loading products', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los productos.' });
          this.products = [];
          this.productsLoading = false;
        }
      });
  }
}
