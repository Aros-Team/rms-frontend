import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { TreeNode } from 'primeng/api';

import { OptionGroup } from '@app/core/services/option-group/option-group';
import { Product } from '@app/core/services/products/product';
import { OptionGroupRequest, OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';
import { ProductOption } from '@app/shared/models/dto/products/product-option';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { OptionSelectionType, ApiSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

import { OrganizationChartModule } from 'primeng/organizationchart';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { InlineCreatePopover, InlineCreateField } from '@app/shared/components/inline-create-popover/inline-create-popover';
import { OptionGroupBadgeComponent } from '@app/shared/components/option-group-badge/option-group-badge';

/** Extended TreeNode data for our domain */
export interface ProductNodeData {
  nodeType: 'product';
  product: ProductResponse;
}

export interface GroupNodeData {
  nodeType: 'group';
  group: OptionGroupResponse;
  product: ProductResponse;
}

export interface OptionNodeData {
  nodeType: 'option';
  option: ProductOption;
  group: OptionGroupResponse;
}

export type OrgChartData = ProductNodeData | GroupNodeData | OptionNodeData;

@Component({
  selector: 'app-option-groups-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    OrganizationChartModule,
    ButtonModule,
    TooltipModule,
    SkeletonModule,
    InlineCreatePopover,
    OptionGroupBadgeComponent,
  ],
  templateUrl: './product-option-groups.html',
  styleUrl: './product-option-groups.css',
})
export class OptionGroupsView implements OnInit {
  private optionGroupService = inject(OptionGroup);
  private productService = inject(Product);

  ngOnInit(): void {
    this.loadProducts();
  }

  /** All products */
  products = signal<ProductResponse[]>([]);

  /** Groups fetched per product id */
  private groupsByProduct = signal<Map<number, OptionGroupResponse[]>>(new Map());

  /** Options fetched per group id */
  private optionsByGroup = signal<Map<number, ProductOption[]>>(new Map());

  /** Loading state per product id */
  private productLoading = signal<Set<number>>(new Set());

  /** Check if a product is loading */
  isProductLoading(productId: number): boolean {
    return this.productLoading().has(productId);
  }

  /** Track which nodes are expanded (key: "product-{id}" or "group-{id}") */
  private expandedKeys = signal<Set<string>>(new Set());

  /** Submitting state for inline creation */
  createSubmitting = signal(false);

  /** Build the recursive tree for p-organizationChart */
  chartData = computed<TreeNode<OrgChartData>[]>(() => {
    const groupsMap = this.groupsByProduct();
    const optionsMap = this.optionsByGroup();
    const loadingProds = this.productLoading();
    const expanded = this.expandedKeys();

    return this.products().map(product => {
      const productKey = `product-${String(product.id)}`;
      const groups = groupsMap.get(product.id) ?? [];
      const isLoading = loadingProds.has(product.id);

      const children: TreeNode<OrgChartData>[] = isLoading
        ? []
        : groups.map(group => {
            const groupKey = `group-${String(group.id)}`;
            const options = optionsMap.get(group.id) ?? [];
            return {
              label: group.name,
              data: { nodeType: 'group', group, product } as GroupNodeData,
              expanded: expanded.has(groupKey),
              children: options.map(option => ({
                label: option.name,
                data: { nodeType: 'option', option, group } as OptionNodeData,
              })),
            };
          });

      return {
        label: product.name,
        data: { nodeType: 'product', product } as ProductNodeData,
        expanded: expanded.has(productKey),
        children,
      };
    });
  });

  /** Load products on init */
  loadProducts(): void {
    this.productService.getProductsPaginated(0, 100).pipe(
      catchError(() => of({ content: [] as ProductResponse[], totalElements: 0, totalPages: 0 }))
    ).subscribe(page => {
      this.products.set(page.content);
    });
  }

  /** Handle node expand — lazy load groups + options */
  onNodeExpand(event: { node: TreeNode<OrgChartData> }): void {
    const data = event.node.data;
    if (!data) return;

    if (data.nodeType === 'product') {
      const key = `product-${String(data.product.id)}`;
      this.expandedKeys.update(s => new Set(s).add(key));
      this.loadProductChildren(data.product);
    } else if (data.nodeType === 'group') {
      const key = `group-${String(data.group.id)}`;
      this.expandedKeys.update(s => new Set(s).add(key));
    }
  }

  /** Handle node collapse */
  onNodeCollapse(event: { node: TreeNode<OrgChartData> }): void {
    const data = event.node.data;
    if (!data) return;

    if (data.nodeType === 'product') {
      const key = `product-${String(data.product.id)}`;
      this.expandedKeys.update(s => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    } else if (data.nodeType === 'group') {
      const key = `group-${String(data.group.id)}`;
      this.expandedKeys.update(s => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  /** Load groups + options for a product */
  private loadProductChildren(product: ProductResponse): void {
    if (this.groupsByProduct().has(product.id)) return;

    this.productLoading.update(s => new Set(s).add(product.id));

    forkJoin([
      this.optionGroupService.getProductOptionGroups(product.id).pipe(catchError(() => of([]))),
      this.productService.getOptions(product.id).pipe(catchError(() => of([]))),
    ]).subscribe(([groups, options]) => {
      this.groupsByProduct.update(m => new Map(m).set(product.id, groups));

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

  /** Get the selection type for a group (mapped from API) */
  getSelectionType(group: OptionGroupResponse): OptionSelectionType {
    switch (group.selectionType) {
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
          { label: 'Única opción', value: 'SINGLE_CHOICE' },
          { label: 'Selección múltiple', value: 'MULTI_CHOICE' },
          { label: 'Extra', value: 'ADD_ON' },
          { label: 'Quitar', value: 'REMOVAL' },
        ],
      },
      { name: 'description', label: 'Descripción', type: 'text', placeholder: 'Descripción opcional' },
    ];
  }

  /** Fields for creating a new option inline */
  optionFields: InlineCreateField[] = [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Tocineta' },
  ];

  /** Handle group creation from inline popover */
  onCreateGroup(productId: number, values: Record<string, unknown>): void {
    const nameRaw = values['name'];
    const name = (typeof nameRaw === 'string' ? nameRaw : '').trim();
    const selectionType = values['selectionType'] as string;
    const descRaw = values['description'];
    const description = (typeof descRaw === 'string' ? descRaw : '').trim();

    if (!name) return;

    this.createSubmitting.set(true);

    const request: OptionGroupRequest = {
      name,
      productIds: [productId],
      selectionType: selectionType as ApiSelectionType,
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

    let productId = 0;
    for (const [pid, groups] of this.groupsByProduct()) {
      if (groups.some(g => g.id === groupId)) {
        productId = pid;
        break;
      }
    }

    this.productService.createProductOption({
      name,
      optionCategoryId: groupId,
      recipe: [],
    }).pipe(
      switchMap(() => productId ? this.productService.getOptions(productId) : of([])),
      catchError(() => of([])),
    ).subscribe(options => {
      const optionsMap = new Map(this.optionsByGroup());
      optionsMap.delete(groupId);
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
}
