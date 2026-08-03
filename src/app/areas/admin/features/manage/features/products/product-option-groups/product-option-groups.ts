import { Component, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { OptionGroup } from '@app/core/services/option-group/option-group';
import { Product } from '@app/core/services/products/product';
import { OptionGroupRequest, OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';
import { ProductOption } from '@app/shared/models/dto/products/product-option';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { toApi } from '@app/shared/lib/option-selection-type-mapper/option-selection-type-mapper';

import { TreeNodeCardComponent } from '@app/shared/components/tree-node-card/tree-node-card';
import { OptionGroupBadgeComponent } from '@app/shared/components/option-group-badge/option-group-badge';
import { TreeNodeSkeletonComponent } from '@app/shared/skeletons/tree-node-skeleton/tree-node-skeleton';
import { InlineCreatePopover, InlineCreateField } from '@app/shared/components/inline-create-popover/inline-create-popover';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

/** UI tree node types */
export type TreeMode = 'product' | 'group' | 'option';

export interface ProductNode {
  type: 'product';
  product: ProductResponse;
  expanded: boolean;
  loading: boolean;
}

export interface GroupNode {
  type: 'group';
  group: OptionGroupResponse;
  product: ProductResponse;
  expanded: boolean;
  loading: boolean;
}

export interface OptionLeaf {
  type: 'option';
  option: ProductOption;
  group: OptionGroupResponse;
}

export type TreeNode = ProductNode | GroupNode | OptionLeaf;

@Component({
  selector: 'app-option-groups-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TreeNodeCardComponent,
    OptionGroupBadgeComponent,
    TreeNodeSkeletonComponent,
    InlineCreatePopover,
    ButtonModule,
    TooltipModule,
  ],
  templateUrl: './product-option-groups.html',
  styleUrl: './product-option-groups.css',
})
export class OptionGroupsView {
  private optionGroupService = inject(OptionGroup);
  private productService = inject(Product);

  /** All products with option groups */
  products = signal<ProductResponse[]>([]);

  /** Expanded state per product id */
  private expandedProducts = signal<Set<number>>(new Set());

  /** Expanded state per group id */
  private expandedGroups = signal<Set<number>>(new Set());

  /** Groups fetched per product id */
  private groupsByProduct = signal<Map<number, OptionGroupResponse[]>>(new Map());

  /** Options fetched per group id */
  private optionsByGroup = signal<Map<number, ProductOption[]>>(new Map());

  /** Loading state per product id (expanding product) */
  private productLoading = signal<Set<number>>(new Set());

  /** Loading state per group id (expanding group) */
  private groupLoading = signal<Set<number>>(new Set());

  /** Submitting state for inline creation */
  createSubmitting = signal(false);

  /** Build the flat tree for the template */
  treeNodes = computed<TreeNode[]>(() => {
    const result: TreeNode[] = [];
    const expandedProds = this.expandedProducts();
    const expandedGrps = this.expandedGroups();
    const groupsMap = this.groupsByProduct();
    const optionsMap = this.optionsByGroup();
    const loadingProds = this.productLoading();
    const loadingGrps = this.groupLoading();

    for (const product of this.products()) {
      const isExpanded = expandedProds.has(product.id);
      const isLoading = loadingProds.has(product.id);
      const groups = groupsMap.get(product.id) ?? [];

      result.push({
        type: 'product',
        product,
        expanded: isExpanded,
        loading: isLoading,
      });

      if (isExpanded) {
        if (isLoading) {
          // show skeleton
        } else {
          for (const group of groups) {
            const isGroupExpanded = expandedGrps.has(group.id);
            const isGroupLoading = loadingGrps.has(group.id);
            const options = optionsMap.get(group.id) ?? [];

            result.push({
              type: 'group',
              group,
              product,
              expanded: isGroupExpanded,
              loading: isGroupLoading,
            });

            if (isGroupExpanded) {
              if (!isGroupLoading) {
                for (const option of options) {
                  result.push({ type: 'option', option, group });
                }
              }
            }
          }
        }
      }
    }

    return result;
  });

  /** Check if a product is expanded */
  isProductExpanded(productId: number): boolean {
    return this.expandedProducts().has(productId);
  }

  /** Check if a group is expanded */
  isGroupExpanded(groupId: number): boolean {
    return this.expandedGroups().has(groupId);
  }

  /** Check if product is loading */
  isProductLoading(productId: number): boolean {
    return this.productLoading().has(productId);
  }

  /** Check if group is loading */
  isGroupLoading(groupId: number): boolean {
    return this.groupLoading().has(groupId);
  }

  /** Get groups for a product */
  getGroupsForProduct(productId: number): OptionGroupResponse[] {
    return this.groupsByProduct().get(productId) ?? [];
  }

  /** Get options for a group */
  getOptionsForGroup(groupId: number): ProductOption[] {
    return this.optionsByGroup().get(groupId) ?? [];
  }

  /** Load products on init */
  loadProducts(): void {
    this.productService.getProducts().pipe(
      catchError(() => of([]))
    ).subscribe(products => {
      this.products.set(products);
    });
  }

  /** Toggle product expand — lazy load groups + options */
  toggleProduct(product: ProductResponse): void {
    const isExpanded = this.isProductExpanded(product.id);

    if (isExpanded) {
      this.expandedProducts.update(s => {
        const next = new Set(s);
        next.delete(product.id);
        return next;
      });
      return;
    }

    // Expand and load
    this.expandedProducts.update(s => new Set(s).add(product.id));

    // Already loaded?
    if (this.groupsByProduct().has(product.id)) return;

    this.productLoading.update(s => new Set(s).add(product.id));

    forkJoin([
      this.optionGroupService.getProductOptionGroups(product.id).pipe(catchError(() => of([]))),
      this.productService.getOptions(product.id).pipe(catchError(() => of([]))),
    ]).subscribe(([groups, options]) => {
      this.groupsByProduct.update(m => new Map(m).set(product.id, groups));

      // Bucket options by optionGroupId
      const optionsMap = new Map(this.optionsByGroup());
      for (const option of options) {
        if (option.optionGroupId == null) continue;
        const existing = optionsMap.get(option.optionGroupId) ?? [];
        existing.push(option);
        optionsMap.set(option.optionGroupId, existing);
      }
      this.optionsByGroup.set(optionsMap);

      this.productLoading.update(s => {
        const next = new Set(s);
        next.delete(product.id);
        return next;
      });
    });
  }

  /** Toggle group expand — lazy load options if not already loaded */
  toggleGroup(group: OptionGroupResponse): void {
    const isExpanded = this.isGroupExpanded(group.id);

    if (isExpanded) {
      this.expandedGroups.update(s => {
        const next = new Set(s);
        next.delete(group.id);
        return next;
      });
      return;
    }

    this.expandedGroups.update(s => new Set(s).add(group.id));
  }

  /** Get the selection type for a group (mapped from API) */
  getSelectionType(group: OptionGroupResponse): OptionSelectionType {
    // OptionGroupResponse.selectionType is ApiSelectionType
    // We need to convert it using fromApi
    const apiType = group.selectionType;
    switch (apiType) {
      case 'SINGLE_CHOICE': return OptionSelectionType.SINGLE_CHOICE;
      case 'MULTI_CHOICE': return OptionSelectionType.MULTI_SELECT;
      case 'ADD_ON': return OptionSelectionType.EXTRA;
      case 'REMOVAL': return OptionSelectionType.REMOVE;
      default: return OptionSelectionType.SINGLE_CHOICE;
    }
  }

  /** Fields for creating a new group inline */
  get groupFields(): InlineCreateField[] {
    return [
      { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Adiciones' },
      {
        name: 'selectionType',
        label: 'Tipo de selección',
        type: 'select',
        required: true,
        placeholder: 'Seleccionar tipo',
        options: [
          { label: 'Única opción', value: OptionSelectionType.SINGLE_CHOICE },
          { label: 'Selección múltiple', value: OptionSelectionType.MULTI_SELECT },
          { label: 'Extra', value: OptionSelectionType.EXTRA },
          { label: 'Quitar', value: OptionSelectionType.REMOVE },
        ],
      },
      { name: 'description', label: 'Descripción', type: 'text', placeholder: 'Descripción opcional' },
    ];
  }

  /** Fields for creating a new option inline */
  optionFields: InlineCreateField[] = [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Tocineta' },
    { name: 'cost', label: 'Costo', type: 'number', placeholder: '0' },
    { name: 'extraPrice', label: 'Precio extra', type: 'number', placeholder: '0' },
  ];

  /** Handle group creation from inline popover */
  onCreateGroup(productId: number, values: Record<string, unknown>): void {
    const nameRaw = values['name'];
    const name = (typeof nameRaw === 'string' ? nameRaw : '').trim();
    const selectionType = values['selectionType'] as OptionSelectionType;
    const descRaw = values['description'];
    const description = (typeof descRaw === 'string' ? descRaw : '').trim();

    if (!name) return;

    this.createSubmitting.set(true);

    const request: OptionGroupRequest = {
      name,
      productIds: [productId],
      selectionType: toApi(selectionType),
      description: description || undefined,
    };

    this.optionGroupService.createOptionGroup(request).pipe(
      switchMap(() => this.optionGroupService.getProductOptionGroups(productId)),
      catchError(() => of([])),
    ).subscribe(groups => {
      this.groupsByProduct.update(m => new Map(m).set(productId, groups));
      this.createSubmitting.set(false);
    });
  }

  /** Handle option creation from inline popover */
  onCreateOption(groupId: number, values: Record<string, unknown>): void {
    const nameRaw = values['name'];
    const name = (typeof nameRaw === 'string' ? nameRaw : '').trim();

    if (!name) return;

    this.createSubmitting.set(true);

    // Find the product id from the groupsByProduct map
    let productId = 0;
    for (const [pid, groups] of this.groupsByProduct()) {
      if (groups.some(g => g.id === groupId)) {
        productId = pid;
        break;
      }
    }

    // Create option via product service
    this.productService.createProductOption({
      name,
      optionCategoryId: groupId,
      recipe: [],
    }).pipe(
      switchMap(() => productId ? this.productService.getOptions(productId) : of([])),
      catchError(() => of([])),
    ).subscribe(options => {
      // Re-bucket options
      const optionsMap = new Map(this.optionsByGroup());
      // Remove old options for this group
      optionsMap.delete(groupId);
      // Add all options for this group from the fresh list
      const groupOptions = options.filter((opt: ProductOption) => opt.optionGroupId === groupId);
      optionsMap.set(groupId, groupOptions);
      this.optionsByGroup.set(optionsMap);
      this.createSubmitting.set(false);
    });
  }

  /** Format money amount */
  formatMoney(amount: number | undefined | null): string {
    if (amount == null) return '$0';
    return '$' + amount.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  /** Node type accessor for template */
  getNodeType(node: TreeNode): TreeMode {
    return node.type;
  }
}
