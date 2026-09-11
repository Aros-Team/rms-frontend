import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { of, EMPTY, forkJoin } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Product } from '@app/core/services/products/product';
import { OptionGroup } from '@app/core/services/option-group/option-group';
import { ProductImage } from '@app/core/services/product-image/product-image';
import { ProductCache } from '../product-cache';
import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from '@app/core/services/websocket/websocket';

import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductUpdateRequest } from '@app/shared/models/dto/products/product-update-request';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';
import { ProductCostBreakdownResponse } from '@app/shared/models/dto/products/product-cost-breakdown-response';
import { ProductImageResponse } from '@app/shared/models/dto/products/product-image-response';
import { OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { fromApi, toApi } from '@app/shared/lib/option-selection-type-mapper/option-selection-type-mapper';
import { mapHttpError } from '@app/shared/lib/http-error-mapper/http-error-mapper';

import { InlineCreatePopover, InlineCreateField } from '@app/shared/components/inline-create-popover/inline-create-popover';
import { OptionGroupBadgeComponent } from '@app/shared/components/option-group-badge/option-group-badge';
import { CostBreakdownPanelComponent } from '@app/shared/components/cost-breakdown-panel/cost-breakdown-panel';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';

interface RecipeItemEditable {
  supplyVariantId: number;
  requiredQuantity: number;
}

@Component({
  selector: 'app-product-recipe-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    SelectModule,
    ToggleSwitch,
    TableModule,
    ToastModule,
    TagModule,
    TooltipModule,
    SkeletonModule,
    InlineCreatePopover,
    OptionGroupBadgeComponent,
    CostBreakdownPanelComponent,
  ],
  providers: [MessageService],
  templateUrl: './product-recipe-page.html',
  styleUrl: './product-recipe-page.css',
})
export class ProductRecipePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(Product);
  private readonly optionGroupService = inject(OptionGroup);
  private readonly imageService = inject(ProductImage);
  private readonly cache = inject(ProductCache);
  private readonly logger = inject(Logging);
  private readonly wsService = inject(WebSocket);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  private currencyFormat = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  // ── State signals ────────────────────────────────────────────────
  readonly product = signal<ProductResponse | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly optionGroups = signal<OptionGroupResponse[]>([]);
  readonly cost = signal<ProductCostResponse | null>(null);
  readonly costBreakdown = signal<ProductCostBreakdownResponse | null>(null);
  readonly images = signal<ProductImageResponse[]>([]);
  readonly recipeItems = signal<RecipeItemEditable[]>([]);
  readonly salePrice = signal<number>(0);
  readonly formData = signal<{
    name: string;
    description: string;
    categoryId: number | null;
    areaId: number | null;
    estimatedPrepMinutes: number | null;
    active: boolean;
  }>({
    name: '',
    description: '',
    categoryId: null,
    areaId: null,
    estimatedPrepMinutes: null,
    active: true,
  });

  readonly inlineCreateSubmitting = signal(false);

  // ── Computed ──────────────────────────────────────────────────────
  readonly areas = computed(() => this.cache.referenceData.data()?.areas ?? []);
  readonly categories = computed(() => this.cache.referenceData.data()?.categories ?? []);
  readonly supplyVariants = computed(() => this.cache.referenceData.data()?.variants ?? []);

  readonly recipeTotal = computed(() => {
    const items = this.recipeItems();
    const variants = this.supplyVariants();
    const variantById = new Map(variants.map(v => [v.id, v]));
    let total = 0;
    for (const item of items) {
      const variant = variantById.get(item.supplyVariantId);
      if (variant?.unitCost != null && item.requiredQuantity > 0) {
        total += variant.unitCost * item.requiredQuantity;
      }
    }
    return total;
  });

  readonly suggestedSalePrice = computed(() => {
    const c = this.cost();
    if (!c) return 0;
    return Math.round(c.totalCost * 1.3);
  });

  readonly categoryOptions = computed(() =>
    this.categories().map(c => ({ label: c.name, value: c.id }))
  );

  readonly areaOptions = computed(() =>
    this.areas().map(a => ({ label: a.name, value: a.id }))
  );

  readonly createGroupFields: InlineCreateField[] = [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Tipo de masa' },
    {
      name: 'selectionType',
      label: 'Tipo de selección',
      type: 'select',
      required: true,
      placeholder: 'Seleccionar',
      options: [
        { label: 'Única opción', value: OptionSelectionType.SINGLE_CHOICE },
        { label: 'Selección múltiple', value: OptionSelectionType.MULTI_SELECT },
        { label: 'Extra (cargo adicional)', value: OptionSelectionType.EXTRA },
        { label: 'Quitar (remoción)', value: OptionSelectionType.REMOVE },
      ],
    },
    { name: 'description', label: 'Descripción', type: 'text', required: false, placeholder: 'Opcional' },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/admin/manage/products']);
      return;
    }
    const parsed = Number(id);
    if (isNaN(parsed)) {
      void this.router.navigate(['/admin/manage/products']);
      return;
    }
    this.cache.referenceData.loadIfStale();
    this.loadProduct(parsed);
  }

  // ── Data loading ──────────────────────────────────────────────────
  loadProduct(id: number): void {
    this.loading.set(true);

    this.productService.findProduct(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap((p) => {
        this.product.set(p);
        this.salePrice.set(p.basePrice);
        this.formData.set({
          name: p.name,
          description: p.description ?? '',
          categoryId: p.categoryId,
          areaId: p.areaId,
          estimatedPrepMinutes: p.estimatedPrepMinutes ?? null,
          active: p.active,
        });
        this.recipeItems.set(
          p.recipe.map(r => ({
            supplyVariantId: r.supplyVariantId,
            requiredQuantity: r.requiredQuantity,
          }))
        );
      }),
      switchMap((p) => forkJoin({
        cost: this.productService.getCost(p.id).pipe(catchError(() => of(null))),
        costBreakdown: this.productService.getCostBreakdown(p.id).pipe(catchError(() => of(null))),
        images: this.imageService.getImages(p.id).pipe(catchError(() => of([]))),
        optionGroups: this.optionGroupService.getProductOptionGroups(p.id).pipe(catchError(() => of([]))),
      })),
      catchError((err) => {
        this.logger.error('Error loading product data', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo cargar el producto',
        });
        return of(null);
      }),
    ).subscribe((result) => {
      if (result) {
        this.cost.set(result.cost);
        this.costBreakdown.set(result.costBreakdown);
        this.images.set(result.images);
        this.optionGroups.set(result.optionGroups);
      }
      this.loading.set(false);
    });
  }

  // ── Save ──────────────────────────────────────────────────────────
  save(): void {
    const p = this.product();
    if (!p) return;

    this.saving.set(true);
    const fd = this.formData();

    const request: ProductUpdateRequest = {
      name: fd.name,
      description: fd.description || undefined,
      basePrice: this.salePrice(),
      categoryId: fd.categoryId ?? p.categoryId,
      areaId: fd.areaId ?? p.areaId,
      estimatedPrepMinutes: fd.estimatedPrepMinutes ?? undefined,
      recipe: this.recipeItems().map(item => ({
        supplyVariantId: item.supplyVariantId,
        requiredQuantity: item.requiredQuantity,
      })),
    };

    this.productService.updateProduct(p.id, request).pipe(
      switchMap(() => {
        this.saving.set(false);
        this.wsService.emitCacheInvalidation('products', 'update');
        return this.productService.findProduct(p.id).pipe(
          catchError(() => of(null)),
        );
      }),
      catchError((err) => {
        this.logger.error('Error saving product', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: mapHttpError(err as HttpErrorResponse, 'product'),
        });
        this.saving.set(false);
        return EMPTY;
      }),
    ).subscribe((updated) => {
      if (updated) {
        this.product.set(updated);
      }
      this.saving.set(false);
      this.messageService.add({
        severity: 'success',
        summary: 'Guardado',
        detail: 'Los cambios se guardaron correctamente',
      });
    });
  }

  // ── Recipe management ─────────────────────────────────────────────
  addRecipeItem(item: { supplyVariantId: number; requiredQuantity: number }): void {
    this.recipeItems.update(items => [...items, {
      supplyVariantId: item.supplyVariantId,
      requiredQuantity: item.requiredQuantity,
    }]);
  }

  removeRecipeItem(index: number): void {
    this.recipeItems.update(items => items.filter((_, i) => i !== index));
  }

  updateRecipeQuantity(index: number, qty: number): void {
    this.recipeItems.update(items => items.map((item, i) =>
      i === index ? { ...item, requiredQuantity: qty } : item
    ));
  }

  updateRecipeVariant(index: number, variantId: number): void {
    this.recipeItems.update(items => items.map((item, i) =>
      i === index ? { ...item, supplyVariantId: variantId } : item
    ));
  }

  getVariantName(variantId: number): string {
    const variant = this.supplyVariants().find(v => v.id === variantId);
    return variant?.supplyName ?? 'Insumo desconocido';
  }

  getVariantUnit(variantId: number): string {
    const variant = this.supplyVariants().find(v => v.id === variantId);
    return variant ? `${String(variant.quantity)} ${variant.unitAbbreviation}` : '—';
  }

  getVariantUnitCost(variantId: number): number {
    return this.supplyVariants().find(v => v.id === variantId)?.unitCost ?? 0;
  }

  getPartialCost(variantId: number, qty: number): number {
    return this.getVariantUnitCost(variantId) * qty;
  }

  formatMoney(amount: number): string {
    return this.currencyFormat.format(amount);
  }

  // ── Image management ──────────────────────────────────────────────
  onImageSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const p = this.product();
    if (!p) return;

    this.imageService.uploadImage(p.id, file).pipe(
      catchError((err) => {
        this.logger.error('Error uploading image', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo subir la imagen',
        });
        // Reset the input even on error so the same file can be re-selected
        input.value = '';
        return EMPTY;
      }),
    ).subscribe((result) => {
      // Reset the input so the same file can be re-selected
      input.value = '';
      if (result.image) {
        const img = result.image;
        this.images.update(imgs => [...imgs, img]);
        this.messageService.add({
          severity: 'success',
          summary: 'Imagen subida',
          detail: 'La imagen se subió correctamente',
        });
      }
    });
  }

  deleteImage(imageId: number): void {
    this.imageService.deleteImage(imageId).pipe(
      catchError((err) => {
        this.logger.error('Error deleting image', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo eliminar la imagen',
        });
        return EMPTY;
      }),
    ).subscribe(() => {
      this.images.update(imgs => imgs.filter(i => i.id !== imageId));
      this.messageService.add({
        severity: 'success',
        summary: 'Imagen eliminada',
        detail: 'La imagen se eliminó correctamente',
      });
    });
  }

  // ── Option group management ───────────────────────────────────────
  createOptionGroup(values: Record<string, unknown>): void {
    const name = (values['name'] as string).trim();
    const selectionType = values['selectionType'] as OptionSelectionType;
    const description = (values['description'] as string) || '';

    if (!name) return;

    const p = this.product();
    if (!p) return;

    this.inlineCreateSubmitting.set(true);
    this.optionGroupService.createOptionGroup({
      name,
      description,
      productIds: [p.id],
      selectionType: toApi(selectionType),
    }).pipe(
      switchMap((created) => {
        this.cache.referenceData.refresh();
        return of(created);
      }),
      catchError((err) => {
        this.logger.error('Error creating option group', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: mapHttpError(err as HttpErrorResponse, 'option-group'),
        });
        this.inlineCreateSubmitting.set(false);
        return EMPTY;
      }),
    ).subscribe((created) => {
      this.inlineCreateSubmitting.set(false);
      this.optionGroups.update(groups => [...groups, created]);
      this.messageService.add({
        severity: 'success',
        summary: 'Grupo creado',
        detail: `"${created.name}" agregado correctamente`,
      });
    });
  }

  goBack(): void {
    void this.router.navigate(['/admin/manage/products']);
  }

  /** Expose fromApi to template for OptionGroupBadge binding. */
  readonly fromApiMapper = fromApi;
}
