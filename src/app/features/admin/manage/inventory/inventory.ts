import { Component, OnInit, inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '@services/authentication/auth-service';
import { PurchaseService } from '@services/purchases/purchase-service';
import { SupplierService } from '@services/suppliers/supplier-service';
import { SupplyService } from '@services/supplies/supply-service';
import { LoggingService } from '@services/logging/logging-service';

import { SupplyVariantResponse } from '@models/dto/supplies/supply-variant-response';
import { SupplierResponse } from '@models/dto/suppliers/supplier-response';
import { PurchaseResponse } from '@models/dto/purchases/purchase-response';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
  selector: 'app-inventory',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TableModule,
    ProgressSpinnerModule,
    ButtonModule,
    IconFieldModule,
    InputTextModule,
    InputIconModule,
    SelectModule,
    IftaLabelModule,
    DialogModule,
    ReactiveFormsModule,
    InputNumberModule,
    TextareaModule,
    ToastModule,
    DatePickerModule,
  ],
  providers: [MessageService],
  templateUrl: './inventory.html',
})
export class Inventory implements OnInit {
  private authService = inject(AuthService);
  private purchaseService = inject(PurchaseService);
  private supplierService = inject(SupplierService);
  private supplyService = inject(SupplyService);
  private logger = inject(LoggingService);
  private messageService = inject(MessageService);
  private fb = inject(FormBuilder);

  supplies = signal<SupplyVariantResponse[] | undefined>(undefined);
  suppliers = signal<SupplierResponse[]>([]);
  purchases = signal<PurchaseResponse[] | undefined>(undefined);

  activeSuppliers = computed(() => this.suppliers().filter((s) => s.active));

  modalIsOpen = false;
  submitting = false;

  currencyFormat = Intl.NumberFormat('es-Co', { style: 'currency', currency: 'COP' });

  purchaseForm: FormGroup = this.fb.group({
    supplierId: [null, Validators.required],
    purchasedAt: [null, Validators.required],
    totalAmount: [null, [Validators.required, Validators.min(0)]],
    notes: [''],
    items: this.fb.array([], Validators.required),
  });

  get items(): FormArray {
    return this.purchaseForm.get('items') as FormArray;
  }

  ngOnInit(): void {
    this.loadSupplies();
    this.loadSuppliers();
    this.loadPurchases();
  }

  openPurchaseModal(): void {
    this.purchaseForm.reset();
    this.items.clear();
    this.addItem();
    this.modalIsOpen = true;
  }

  closeModal(): void {
    this.modalIsOpen = false;
  }

  addItem(): void {
    this.items.push(
      this.fb.group({
        supplyVariantId: [null, Validators.required],
        quantityOrdered: [null, [Validators.required, Validators.min(0.001)]],
        quantityReceived: [null, [Validators.required, Validators.min(0)]],
        unitPrice: [null, [Validators.required, Validators.min(0)]],
      }),
    );
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  submitPurchase(): void {
    if (this.purchaseForm.invalid || this.items.length === 0) {
      this.purchaseForm.markAllAsTouched();
      return;
    }

    // Validate quantityReceived <= quantityOrdered per item
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);
      const ordered = item.get('quantityOrdered')?.value ?? 0;
      const received = item.get('quantityReceived')?.value ?? 0;
      if (received > ordered) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error de validación',
          detail: `Ítem ${i + 1}: la cantidad recibida no puede superar la cantidad ordenada.`,
        });
        return;
      }
    }

    const userId = this.authService.getData()?.id;
    if (!userId) {
      this.logger.error('No user ID available for purchase registration');
      return;
    }

    const rawDate: Date = this.purchaseForm.get('purchasedAt')?.value;
    const purchasedAt = this.formatDateLocal(rawDate);

    this.submitting = true;

    this.purchaseService
      .createPurchase({
        supplierId: this.purchaseForm.get('supplierId')?.value,
        registeredById: userId,
        purchasedAt,
        totalAmount: this.purchaseForm.get('totalAmount')?.value,
        notes: this.purchaseForm.get('notes')?.value || undefined,
        items: this.items.value,
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.closeModal();
          this.loadSupplies();
          this.loadPurchases();
          this.messageService.add({
            severity: 'success',
            summary: 'Compra registrada',
            detail: 'El stock fue actualizado automáticamente.',
          });
        },
        error: (err: { status?: number }) => {
          this.submitting = false;
          if (err.status === 409) {
            this.messageService.add({
              severity: 'error',
              summary: 'Distribuidor inactivo',
              detail: 'El distribuidor seleccionado está inactivo.',
            });
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'No se pudo registrar la compra. Verifica los datos.',
            });
          }
          this.logger.error('Error creating purchase', err);
        },
      });
  }

  isInvalid(group: FormGroup, field: string): boolean {
    const c = group.get(field);
    return !!(c?.invalid && c?.touched);
  }

  getSupplyName(id: number): string {
    return this.supplies()?.find((s) => s.id === id)?.name ?? String(id);
  }

  private loadSupplies(): void {
    this.supplyService.getSupplyVariants().subscribe({
      next: (res) => this.supplies.set(res),
      error: (err) => this.logger.error('Error loading supplies', err),
    });
  }

  private loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (res) => this.suppliers.set(res),
      error: (err) => this.logger.error('Error loading suppliers', err),
    });
  }

  private loadPurchases(): void {
    this.purchases.set(undefined);
    this.purchaseService.getPurchases().subscribe({
      next: (res) => this.purchases.set(res),
      error: (err) => this.logger.error('Error loading purchases', err),
    });
  }

  private formatDateLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}
