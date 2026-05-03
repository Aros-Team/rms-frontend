import { Component, OnInit, inject, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed, DestroyRef, NgZone } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Auth } from '@services/auth/auth';
import { InventoryService } from '@services/inventory/inventory';
import { Purchase } from '@services/purchases/purchase';
import { Supplier } from '@services/suppliers/supplier';
import { Supply } from '@services/supplies/supply';
import { Logging } from '@services/logging/logging';
import { WebSocket } from '@services/websocket/websocket';
import { environment } from '@environments/environment';

import { SupplyVariantResponse } from '@models/dto/supplies/supply-variant-response';
import { SupplyCategoryResponse } from '@models/dto/supplies/supply-category-response';
import { SupplierResponse } from '@models/dto/suppliers/supplier-response';
import { PurchaseResponse } from '@models/dto/purchases/purchase-response';
import { SupplyUnitResponse } from '@models/dto/supplies/supply-unit-response';
import { SupplyResponse } from '@models/dto/supplies/supply-response';
import { TransferItem } from '@models/dto/inventory/transfer-request';
import { InventoryStockUpdatedEvent } from '@models/dto/inventory/inventory-stock-update';

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
import { CheckboxModule } from 'primeng/checkbox';

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
    CheckboxModule,
  ],
  providers: [MessageService],
  templateUrl: './inventory.html',
})
export class Inventory implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(Auth);
  private inventoryService = inject(InventoryService);
  private purchaseService = inject(Purchase);
  private supplierService = inject(Supplier);
  private supplyService = inject(Supply);
  private logger = inject(Logging);
  private messageService = inject(MessageService);
  private fb = inject(FormBuilder);
  private wsService = inject(WebSocket);
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);

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

  filteredSupplies = computed(() => {
    const all = this.supplies();
    if (all === undefined) return undefined;
    const catId = this.selectedCategoryId();
    return catId === null ? all : all.filter((s) => s.categoryId === catId);
  });

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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    supplierId: [null, Validators.required],
    // eslint-disable-next-line @typescript-eslint/unbound-method
    purchasedAt: [null, Validators.required],
    // eslint-disable-next-line @typescript-eslint/unbound-method
    totalAmount: [null, [Validators.required, Validators.min(0)]],
    notes: [''],
    // eslint-disable-next-line @typescript-eslint/unbound-method
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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    unitId: [null, Validators.required],
    // eslint-disable-next-line @typescript-eslint/unbound-method
    quantity: [null, [Validators.required, Validators.min(0)]],
  });

  get items(): FormArray {
    return this.purchaseForm.get('items') as FormArray;
  }

  // --- purchase item category filter (local, per-row) ---
  private itemCategoryMap = new Map<number, number | null>();

  getItemCategory = (index: number): number | null => {
    return this.itemCategoryMap.get(index) ?? null;
  };

  setItemCategory = (index: number, categoryId: number | null): void => {
    this.itemCategoryMap.set(index, categoryId);
    // clear selected variant when category changes
    this.items.at(index).get('supplyVariantId')?.setValue(null);
  };

  filteredVariantsForItem = (index: number): SupplyVariantResponse[] => {
    const all = this.supplies() ?? [];
    const catId = this.itemCategoryMap.get(index) ?? null;
    return catId ? all.filter(v => v.categoryId === catId) : all;
  };

  // --- new supplier dialog ---
  newSupplierDialogOpen = false;
  newSupplierSubmitting = signal(false);
  newSupplierForm: FormGroup = this.fb.group({
    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    name: ['', [Validators.required, Validators.maxLength(255)]],
    contact: ['', Validators.maxLength(255)],
  });

  // --- new category dialog ---
  newCategoryDialogOpen = false;
  newCategorySubmitting = signal(false);
  newCategoryForm: FormGroup = this.fb.group({
    /* eslint-disable-next-line @typescript-eslint/unbound-method */
    name: ['', [Validators.required, Validators.maxLength(255)]],
  });

  // --- transfer to kitchen dialog ---
  transferDialogOpen = false;
  transferSubmitting = signal(false);
  transferQuantities = signal<Map<number, number>>(new Map());
  transferSelected = signal<Set<number>>(new Set());
  transferSearch = signal('');
  transferCategoryId = signal<number | null>(null);

  transferableSupplies = computed(() =>
    (this.supplies() ?? []).filter((s) => s.stockBodega > 0),
  );

  filteredTransferSupplies = computed(() => {
    const search = this.transferSearch().toLowerCase().trim();
    const catId = this.transferCategoryId();
    return this.transferableSupplies().filter((s) => {
      const matchesSearch = !search || s.supplyName.toLowerCase().includes(search);
      const matchesCat = catId === null || s.categoryId === catId;
      return matchesSearch && matchesCat;
    });
  });

  ngOnInit(): void {
    this.loadSupplies();
    this.loadSuppliers();
    this.loadPurchases();
    this.loadCategories();
    this.loadUnits();
    this.loadAllSupplies();
    // With OnPush, form status changes don't trigger CD automatically.
    // Subscribe so the template re-evaluates [invalid] bindings when fields become valid.
    this.purchaseForm.statusChanges.subscribe(() => { this.cdr.markForCheck(); });
    // Real-time inventory updates via WebSocket
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.logger.warn('Inventory: No token available, skipping WebSocket connection');
      return;
    }

    // Ensure the WebSocket client is connected (no-op if already connected)
    this.wsService.connect(environment.wsUrl, token);

    // Subscribe to inventory stock updates — auto-cleaned up on component destroy
    this.wsService.inventoryUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => { this.ngZone.run(() => { this.applyInventoryUpdate(event); }); });
  }

  filterByCategory(categoryId: number | null): void {
    this.selectedCategoryId.set(categoryId);
  }

  openPurchaseModal(): void {
    this.closeModal();
    this.addItem();
    this.modalIsOpen = true;
    this.cdr.markForCheck();
  }

  openVariantModal(): void {
    this.categoryForm.reset({ mode: 'existing', categoryId: null, categoryName: '' });
    this.supplyForm.reset({ mode: 'new', supplyId: null, supplyName: '' });
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
    const mode = this.categoryForm.get('mode')?.value as string | null;
    if (mode === 'existing') {
      const id = this.categoryForm.get('categoryId')?.value as number | null;
      if (!id) { this.categoryForm.get('categoryId')?.markAsTouched(); return; }
      this.resolvedCategoryId.set(id);
      this.variantStep.set('supply');
    } else {
      const name: string = (this.categoryForm.get('categoryName')?.value as string).trim();
      if (!name) { this.categoryForm.get('categoryName')?.markAsTouched(); return; }
      this.variantSubmitting = true;
      this.supplyService.createCategory({ name }).subscribe({
        next: (cat) => {
          this.variantSubmitting = false;
          this.categories.update((list) => [...list, cat]);
          this.resolvedCategoryId.set(cat.id);
          this.variantStep.set('supply');
        },
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.variantSubmitting = false;
          const errorMessage = err.error?.message;
          const detail = err.status === 409
            ? errorMessage ?? 'Esa categoría ya existe.'
            : errorMessage ?? 'No se pudo crear la categoría.';
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
          this.logger.error('Error creating category', err);
        },
      });
    }
  }

  // Step 2 → Step 3
  confirmSupply(): void {
    const mode = this.supplyForm.get('mode')?.value as string | null;
    if (mode === 'existing') {
      const id = this.supplyForm.get('supplyId')?.value as number | null;
      if (!id) { this.supplyForm.get('supplyId')?.markAsTouched(); return; }
      this.resolvedSupplyId.set(id);
      this.variantStep.set('variant');
    } else {
      const name: string = (this.supplyForm.get('supplyName')?.value as string).trim();
      if (!name) { this.supplyForm.get('supplyName')?.markAsTouched(); return; }
      const categoryId = this.resolvedCategoryId() ?? 0;
      this.variantSubmitting = true;
      this.supplyService.createSupply({ name, categoryId }).subscribe({
        next: (supply) => {
          this.variantSubmitting = false;
          this.allSupplies.update((list) => [...list, supply]);
          this.resolvedSupplyId.set(supply.id);
          this.variantStep.set('variant');
        },
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.variantSubmitting = false;
          const errorMessage = err.error?.message;
          const detail = err.status === 409
            ? errorMessage ?? 'Ese insumo ya existe.'
            : errorMessage ?? 'No se pudo crear el insumo.';
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
    const supplyId = this.resolvedSupplyId();
    if (!supplyId) {
      this.logger.error('No supply ID resolved for variant creation');
      this.variantSubmitting = false;
      return;
    }
    this.variantSubmitting = true;
    const unitId = this.variantForm.get('unitId')?.value as number | undefined;
    const quantity = this.variantForm.get('quantity')?.value as number | undefined;
    if (!unitId || !quantity) {
      this.logger.error('Missing required fields for variant creation');
      this.variantSubmitting = false;
      return;
    }
    this.supplyService
      .createVariant({
        supplyId,
        unitId,
        quantity,
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
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.variantSubmitting = false;
          const errorMessage = err.error?.message;
          const detail =
            err.status === 409
              ? errorMessage ?? 'Ya existe esa combinación de insumo y unidad.'
              : errorMessage ?? 'No se pudo registrar la variante. Verifica los datos.';
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
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.newCategorySubmitting.set(false);
        const errorMessage = err.error?.message;
        const detail = err.status === 409
          ? errorMessage ?? 'Ya existe una categoría con ese nombre.'
          : errorMessage ?? 'No se pudo crear la categoría.';
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
    this.supplierService.createSupplier({ name: name.trim(), contact: contact.trim() || undefined }).subscribe({
      next: (created) => {
        this.newSupplierSubmitting.set(false);
        this.suppliers.update(list => [...list, created]);
        this.purchaseForm.get('supplierId')?.setValue(created.id);
        this.closeNewSupplierDialog();
        this.messageService.add({ severity: 'success', summary: 'Distribuidor creado', detail: created.name });
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.newSupplierSubmitting.set(false);
        const errorMessage = err.error?.message;
        const detail = err.status === 400
          ? errorMessage ?? 'El nombre es requerido y no puede superar 255 caracteres.'
          : errorMessage ?? 'No se pudo crear el distribuidor.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
        this.logger.error('Error creating supplier', err);
      },
    });
  }

  closeModal(): void {
    this.modalIsOpen = false;
    this.items.clear();
    this.purchaseForm.reset();
    this.purchaseForm.markAsUntouched();
    this.purchaseForm.markAsPristine();
    this.itemCategoryMap.clear();
    this.cdr.markForCheck();
  }

  addItem(): void {
    this.items.push(
      this.fb.group({
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        supplyVariantId: [null, Validators.required],
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        quantityOrdered: [null, [Validators.required, Validators.min(0.001)]],
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
        quantityReceived: [null, [Validators.required, Validators.min(0)]],
        /* eslint-disable-next-line @typescript-eslint/unbound-method */
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
      this.cdr.markForCheck();
      return;
    }

    // Validate quantityReceived <= quantityOrdered per item
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);
      const ordered = (item.get('quantityOrdered')?.value as number | undefined) ?? 0;
      const received = (item.get('quantityReceived')?.value as number | undefined) ?? 0;
      if (received > ordered) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error de validación',
          detail: `Ítem ${String(i + 1)}: la cantidad recibida no puede superar la cantidad ordenada.`,
        });
        return;
      }
    }

    const userId = this.authService.getData()?.id;
    if (!userId) {
      this.logger.error('No user ID available for purchase registration');
      return;
    }

    const rawDate = this.purchaseForm.get('purchasedAt')?.value as Date | undefined;
    if (!rawDate) {
      this.logger.error('Missing purchase date');
      return;
    }
    const purchasedAt = this.formatDateLocal(rawDate);

    const supplierId = this.purchaseForm.get('supplierId')?.value as number | undefined;
    const totalAmount = this.purchaseForm.get('totalAmount')?.value as number | undefined;
    if (!supplierId || !totalAmount) {
      this.logger.error('Missing required fields for purchase');
      return;
    }

    this.submitting = true;

    this.purchaseService
      .createPurchase({
        supplierId,
        registeredById: userId,
        purchasedAt,
        totalAmount,
        notes: this.purchaseForm.get('notes')?.value as string | undefined ?? undefined,
        items: this.items.getRawValue() as {
          supplyVariantId: number;
          quantityOrdered: number;
          quantityReceived: number;
          unitPrice: number;
        }[],
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
        error: (err: { status?: number; error?: { message?: string } }) => {
          this.submitting = false;
          const errorMessage = err.error?.message;
          if (err.status === 409) {
            this.messageService.add({
              severity: 'error',
              summary: 'Distribuidor inactivo',
              detail: errorMessage ?? 'El distribuidor seleccionado está inactivo.',
            });
          } else if (err.status === 400) {
            this.messageService.add({
              severity: 'error',
              summary: 'Error de validación',
              detail: errorMessage ?? 'Verifica los datos del formulario.',
            });
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: errorMessage ?? 'No se pudo registrar la compra. Verifique los datos.',
            });
          }
          this.logger.error('Error creating purchase', err);
        },
      });
  }

  isInvalid = (group: FormGroup, field: string): boolean => {
    const c = group.get(field);
    return !!(c?.invalid && c.touched);
  };

  getSupplyName = (id: number): string => {
    return this.supplies()?.find((s) => s.id === id)?.supplyName ?? String(id);
  };

  openTransferDialog = (): void => {
    this.transferQuantities.set(new Map());
    this.transferSelected.set(new Set());
    this.transferSearch.set('');
    this.transferCategoryId.set(null);
    this.transferDialogOpen = true;
  };

  closeTransferDialog = (): void => {
    this.transferDialogOpen = false;
  };

  isTransferSelected = (variantId: number): boolean => {
    return this.transferSelected().has(variantId);
  };

  toggleTransferSelection(variantId: number, checked: boolean): void {
    const next = new Set(this.transferSelected());
    if (checked) {
      next.add(variantId);
    } else {
      next.delete(variantId);
    }
    this.transferSelected.set(next);
  }

  getTransferQty = (variantId: number): number => {
    return this.transferQuantities().get(variantId) ?? 0;
  };

  setTransferQty(variantId: number, qty: number): void {
    const next = new Map(this.transferQuantities());
    next.set(variantId, qty);
    this.transferQuantities.set(next);
  }

  submitTransfer(): void {
    const selected = this.transferSelected();
    const quantities = this.transferQuantities();

    const items: TransferItem[] = [];
    for (const variantId of selected) {
      const qty = quantities.get(variantId) ?? 0;
      const variant = (this.supplies() ?? []).find((s) => s.id === variantId);
      if (qty <= 0) {
        this.messageService.add({
          severity: 'error',
          summary: 'Cantidad inválida',
          detail: `La cantidad para "${variant?.supplyName ?? String(variantId)}" debe ser mayor a 0.`,
        });
        return;
      }
      if (variant && qty > variant.stockBodega) {
        this.messageService.add({
          severity: 'error',
          summary: 'Stock insuficiente',
          detail: `"${variant.supplyName}" solo tiene ${String(variant.stockBodega)} ${variant.unitAbbreviation} en bodega.`,
        });
        return;
      }
      items.push({ supplyVariantId: variantId, quantity: qty });
    }

    if (items.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin selección',
        detail: 'Selecciona al menos un insumo para transferir.',
      });
      return;
    }

    this.transferSubmitting.set(true);
    this.inventoryService.transferToKitchen({ items }).subscribe({
      next: () => {
        this.transferSubmitting.set(false);
        this.closeTransferDialog();
        this.loadSupplies();
        this.messageService.add({
          severity: 'success',
          summary: 'Transferencia exitosa',
          detail: `${String(items.length)} insumo(s) transferido(s) a cocina.`,
        });
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        this.transferSubmitting.set(false);
        const detail = err.error?.message ?? 'No se pudo completar la transferencia.';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
        this.logger.error('Error transferring to kitchen', err);
      },
    });
  }

  private loadCategories(): void {
    this.supplyService.getCategories().subscribe({
      next: (res) => { this.categories.set(res); },
      error: (err) => { this.logger.error('Error loading categories', err); },
    });
  }

  private loadUnits(): void {
    this.supplyService.getUnits().subscribe({
      next: (res) => { this.units.set(res); },
      error: (err) => { this.logger.error('Error loading units', err); },
    });
  }

  private loadAllSupplies(): void {
    this.supplyService.getSupplies().subscribe({
      next: (res) => { this.allSupplies.set(res); },
      error: (err) => { this.logger.error('Error loading all supplies', err); },
    });
  }

  private loadSupplies(): void {
    this.supplyService.getSupplyVariants().subscribe({
      next: (res) => { this.supplies.set(res); },
      error: (err) => { this.logger.error('Error loading supplies', err); },
    });
  }

  private loadSuppliers(): void {
    this.supplierService.getSuppliers().subscribe({
      next: (res) => { this.suppliers.set(res); },
      error: (err) => { this.logger.error('Error loading suppliers', err); },
    });
  }

  private loadPurchases(): void {
    this.purchases.set(undefined);
    this.purchaseService.getPurchases().subscribe({
      next: (res) => { this.purchases.set(res); },
      error: (err) => { this.logger.error('Error loading purchases', err); },
    });
  }

  private applyInventoryUpdate(event: InventoryStockUpdatedEvent): void {
    if (this.supplies() === undefined) return;

    this.supplies.update((list) => {
      if (list === undefined) return list;
      return list.map((supply) => {
        const match = event.updatedItems.find((item) => item.supplyVariantId === supply.id);
        if (!match) return supply;
        const location = match.locationName.toUpperCase();
        if (location === 'BODEGA') {
          return { ...supply, stockBodega: match.currentQuantity };
        }
        if (location === 'COCINA') {
          return { ...supply, stockCocina: match.currentQuantity };
        }
        return supply;
      });
    });

    this.cdr.markForCheck();
  }

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:00`;
  }
}
