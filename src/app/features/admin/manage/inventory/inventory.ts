import { Component, OnInit, inject, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';

import { AuthService } from '@services/authentication/auth-service';
import { PurchaseService } from '@services/purchases/purchase-service';
import { SupplierService } from '@services/suppliers/supplier-service';
import { SupplyService } from '@services/supplies/supply-service';
import { LoggingService } from '@services/logging/logging-service';

import { SupplyVariantResponse } from '@models/dto/supplies/supply-variant-response';
import { SupplyCategoryResponse } from '@models/dto/supplies/supply-category-response';
import { SupplierResponse } from '@models/dto/suppliers/supplier-response';
import { PurchaseResponse } from '@models/dto/purchases/purchase-response';
import { SupplyUnitResponse } from '@models/dto/supplies/supply-unit-response';
import { SupplyResponse } from '@models/dto/supplies/supply-response';

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
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';

// Wizard step type
type VariantStep = 'category' | 'supply' | 'variant';

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
    FormsModule,
    InputNumberModule,
    TextareaModule,
    ToastModule,
    DatePickerModule,
    MultiSelectModule,
    TooltipModule,
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

  readonly wizardSteps = [
    { key: 'category' as VariantStep, label: 'Categoría' },
    { key: 'supply' as VariantStep, label: 'Insumo base' },
    { key: 'variant' as VariantStep, label: 'Presentación' },
  ];

  supplies = signal<SupplyVariantResponse[] | undefined>(undefined);
  suppliers = signal<SupplierResponse[]>([]);
  purchases = signal<PurchaseResponse[] | undefined>(undefined);
  categories = signal<SupplyCategoryResponse[]>([]);
  selectedCategoryId = signal<number | null>(null);

  // --- new variant wizard ---
  units = signal<SupplyUnitResponse[]>([]);
  allSupplies = signal<SupplyResponse[]>([]);
  variantModalIsOpen = false;
  variantStep = signal<VariantStep>('category');
  variantSubmitting = false;

  // resolved in previous steps, carried forward
  resolvedCategoryId = signal<number | null>(null);
  resolvedSupplyId = signal<number | null>(null);

  activeSuppliers = computed(() => this.suppliers().filter((s) => s.active));

  // categories filtered by what already exists (for the supply step select)
  suppliesForCategory = computed(() =>
    this.allSupplies().filter((s) => s.categoryId === this.resolvedCategoryId()),
  );

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

  // Step 1 — category
  categoryForm: FormGroup = this.fb.group({
    mode: ['existing'],          // 'existing' | 'new'
    categoryId: [null],
    categoryName: [''],
  });

  // Step 2 — supply base
  supplyForm: FormGroup = this.fb.group({
    mode: ['existing'],          // 'existing' | 'new'
    supplyId: [null],
    supplyName: [''],
  });

  // Step 3 — variant
  variantForm: FormGroup = this.fb.group({
    unitId: [null, Validators.required],
    quantity: [null, [Validators.required, Validators.min(0)]],
  });

  get items(): FormArray {
    return this.purchaseForm.get('items') as FormArray;
  }

  // --- purchase item category filter (local, per-row) ---
  private itemCategoryMap = new Map<number, number | null>();

  getItemCategory(index: number): number | null {
    return this.itemCategoryMap.get(index) ?? null;
  }

  setItemCategory(index: number, categoryId: number | null): void {
    this.itemCategoryMap.set(index, categoryId);
    // clear selected variant when category changes
    this.items.at(index).get('supplyVariantId')?.setValue(null);
  }

  filteredVariantsForItem(index: number): SupplyVariantResponse[] {
    const all = this.supplies() ?? [];
    const catId = this.itemCategoryMap.get(index) ?? null;
    return catId ? all.filter(v => v.categoryId === catId) : all;
  }

  // --- new supplier dialog ---
  newSupplierDialogOpen = false;
  newSupplierSubmitting = signal(false);
  newSupplierForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    contact: ['', Validators.maxLength(255)],
  });

  // --- new category dialog ---
  newCategoryDialogOpen = false;
  newCategorySubmitting = signal(false);
  newCategoryForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });

  ngOnInit(): void {
    this.loadSupplies();
    this.loadSuppliers();
    this.loadPurchases();
    this.loadCategories();
    this.loadUnits();
    this.loadAllSupplies();
  }

  filterByCategory(categoryId: number | null): void {
    this.selectedCategoryId.set(categoryId);
    this.supplies.set(undefined);
    if (categoryId === null) {
      this.loadSupplies();
    } else {
      this.supplyService.getVariantsByCategory(categoryId).subscribe({
        next: (res) => this.supplies.set(res),
        error: (err) => this.logger.error('Error filtering supplies', err),
      });
    }
  }

  openPurchaseModal(): void {
    this.purchaseForm.reset();
    this.items.clear();
    this.itemCategoryMap.clear();
    this.addItem();
    this.modalIsOpen = true;
  }

  openVariantModal(): void {
    this.categoryForm.reset({ mode: 'existing', categoryId: null, categoryName: '' });
    this.supplyForm.reset({ mode: 'existing', supplyId: null, supplyName: '' });
    this.variantForm.reset();
    this.resolvedCategoryId.set(null);
    this.resolvedSupplyId.set(null);
    this.variantStep.set('category');
    this.variantModalIsOpen = true;
  }

  closeVariantModal(): void {
    this.variantModalIsOpen = false;
  }

  // Step 1 → Step 2
  confirmCategory(): void {
    const mode = this.categoryForm.get('mode')?.value;
    if (mode === 'existing') {
      const id = this.categoryForm.get('categoryId')?.value;
      if (!id) { this.categoryForm.get('categoryId')?.markAsTouched(); return; }
      this.resolvedCategoryId.set(id);
      this.variantStep.set('supply');
    } else {
      const name: string = (this.categoryForm.get('categoryName')?.value ?? '').trim();
      if (!name) { this.categoryForm.get('categoryName')?.markAsTouched(); return; }
      this.variantSubmitting = true;
      this.supplyService.createCategory({ name }).subscribe({
        next: (cat) => {
          this.variantSubmitting = false;
          this.categories.update((list) => [...list, cat]);
          this.resolvedCategoryId.set(cat.id);
          this.variantStep.set('supply');
        },
        error: (err: { status?: number }) => {
          this.variantSubmitting = false;
          const detail = err.status === 409 ? 'Esa categoría ya existe.' : 'No se pudo crear la categoría.';
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
          this.logger.error('Error creating category', err);
        },
      });
    }
  }

  // Step 2 → Step 3
  confirmSupply(): void {
    const mode = this.supplyForm.get('mode')?.value;
    if (mode === 'existing') {
      const id = this.supplyForm.get('supplyId')?.value;
      if (!id) { this.supplyForm.get('supplyId')?.markAsTouched(); return; }
      this.resolvedSupplyId.set(id);
      this.variantStep.set('variant');
    } else {
      const name: string = (this.supplyForm.get('supplyName')?.value ?? '').trim();
      if (!name) { this.supplyForm.get('supplyName')?.markAsTouched(); return; }
      const categoryId = this.resolvedCategoryId()!;
      this.variantSubmitting = true;
      this.supplyService.createSupply({ name, categoryId }).subscribe({
        next: (supply) => {
          this.variantSubmitting = false;
          this.allSupplies.update((list) => [...list, supply]);
          this.resolvedSupplyId.set(supply.id);
          this.variantStep.set('variant');
        },
        error: (err: { status?: number }) => {
          this.variantSubmitting = false;
          const detail = err.status === 409 ? 'Ese insumo ya existe.' : 'No se pudo crear el insumo.';
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
          this.logger.error('Error creating supply', err);
        },
      });
    }
  }

  // Step 3 — final submit
  submitVariant(): void {
    if (this.variantForm.invalid) {
      this.variantForm.markAllAsTouched();
      return;
    }
    this.variantSubmitting = true;
    this.supplyService
      .createVariant({
        supplyId: this.resolvedSupplyId()!,
        unitId: this.variantForm.get('unitId')?.value,
        quantity: this.variantForm.get('quantity')?.value,
      })
      .subscribe({
        next: (created) => {
          this.variantSubmitting = false;
          this.closeVariantModal();
          this.supplies.update((list) => [...(list ?? []), created]);
          this.messageService.add({
            severity: 'success',
            summary: 'Insumo registrado',
            detail: `${created.supplyName} (${created.unitAbbreviation}) agregado al inventario.`,
          });
        },
        error: (err: { status?: number }) => {
          this.variantSubmitting = false;
          const detail =
            err.status === 409
              ? 'Ya existe esa combinación de insumo y unidad.'
              : 'No se pudo registrar la variante. Verifica los datos.';
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
          this.logger.error('Error creating supply variant', err);
        },
      });
  }

  openNewSupplierDialog(): void {
    this.newSupplierForm.reset();
    this.newSupplierDialogOpen = true;
  }

  closeNewSupplierDialog(): void {
    this.newSupplierDialogOpen = false;
  }

  openCategoryDialog(): void {
    this.newCategoryForm.reset();
    this.newCategoryDialogOpen = true;
  }

  closeCategoryDialog(): void {
    this.newCategoryDialogOpen = false;
  }

  submitNewCategory(): void {
    if (this.newCategoryForm.invalid) {
      this.newCategoryForm.markAllAsTouched();
      return;
    }
    this.newCategorySubmitting.set(true);
    const { name } = this.newCategoryForm.value as { name: string };
    this.supplyService.createCategory({ name: name.trim() }).subscribe({
      next: (created) => {
        this.newCategorySubmitting.set(false);
        this.categories.update((list) => [...list, created]);
        this.closeCategoryDialog();
        this.messageService.add({
          severity: 'success',
          summary: 'Categoría creada',
          detail: created.name,
        });
      },
      error: (err: { status?: number }) => {
        this.newCategorySubmitting.set(false);
        const detail = err.status === 409 ? 'Ya existe una categoría con ese nombre.' : 'No se pudo crear la categoría.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
        this.logger.error('Error creating supply category', err);
      },
    });
  }

  submitNewSupplier(): void {
    if (this.newSupplierForm.invalid) {
      this.newSupplierForm.markAllAsTouched();
      return;
    }
    this.newSupplierSubmitting.set(true);
    const { name, contact } = this.newSupplierForm.value as { name: string; contact: string };
    this.supplierService.createSupplier({ name: name.trim(), contact: contact?.trim() || undefined }).subscribe({
      next: (created) => {
        this.newSupplierSubmitting.set(false);
        this.suppliers.update(list => [...list, created]);
        this.purchaseForm.get('supplierId')?.setValue(created.id);
        this.closeNewSupplierDialog();
        this.messageService.add({ severity: 'success', summary: 'Distribuidor creado', detail: created.name });
      },
      error: (err: { status?: number }) => {
        this.newSupplierSubmitting.set(false);
        const detail = err.status === 400 ? 'El nombre es requerido y no puede superar 255 caracteres.' : 'No se pudo crear el distribuidor.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
        this.logger.error('Error creating supplier', err);
      },
    });
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
    this.itemCategoryMap.delete(index);
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
    return this.supplies()?.find((s) => s.id === id)?.supplyName ?? String(id);
  }

  private loadCategories(): void {
    this.supplyService.getCategories().subscribe({
      next: (res) => this.categories.set(res),
      error: (err) => this.logger.error('Error loading categories', err),
    });
  }

  private loadUnits(): void {
    this.supplyService.getUnits().subscribe({
      next: (res) => this.units.set(res),
      error: (err) => this.logger.error('Error loading units', err),
    });
  }

  private loadAllSupplies(): void {
    this.supplyService.getSupplies().subscribe({
      next: (res) => this.allSupplies.set(res),
      error: (err) => this.logger.error('Error loading all supplies', err),
    });
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
