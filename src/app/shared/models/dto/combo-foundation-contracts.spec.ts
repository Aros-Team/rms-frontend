import type { DockItem } from '@app/core/services/order-dock/order-dock';
import type {
  ClientOrderDetail,
} from '@app/shared/models/dto/orders/order-details-response.model';
import type {
  OrderDetailItem,
} from '@app/shared/models/dto/orders/order-response.model';
import type {
  CreateOrderDetail,
  CreateOrderRequest,
} from '@app/shared/models/dto/orders/create-order-request.model';
import type { ProductCreateRequest } from '@app/shared/models/dto/products/product-create-request';
import type { ProductListResponse } from '@app/shared/models/dto/products/product-list-response.model';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import type { ProductUpdateRequest } from '@app/shared/models/dto/products/product-update-request';
import type {
  SpecialSelectionGroupRequest,
  SpecialSelectionGroupResponse,
} from '@app/shared/models/dto/special-selections/special-selection-group';
import type { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import type { SuggestedPriceBreakdownEntry } from '@app/shared/models/dto/special-selections/special-selection-suggested-price';
import {
  SELECTION_TYPE,
  type SelectionType,
} from '@app/shared/models/dto/special-selections/selection-type';

describe('Combo foundation DTO contracts', () => {
  it('types new combo group requests with nullable ids and category-based product ids', () => {
    const request: SpecialSelectionGroupRequest = {
      id: null,
      categoryId: null,
      displayOrder: 1,
      required: true,
      minSelections: 1,
      maxSelections: 2,
      productIds: [101, 102],
    };

    expect(request).toEqual({
      id: null,
      categoryId: null,
      displayOrder: 1,
      required: true,
      minSelections: 1,
      maxSelections: 2,
      productIds: [101, 102],
    });
    expectTypeOf<SpecialSelectionGroupRequest['id']>().toEqualTypeOf<
      number | null | undefined
    >();
    expectTypeOf<SpecialSelectionGroupRequest['categoryId']>().toEqualTypeOf<number | null>();
    expectTypeOf<SpecialSelectionGroupRequest['productIds']>().toEqualTypeOf<number[]>();
  });

  it('types combo group responses with nullable categories and optional category names', () => {
    const withoutCategoryName: SpecialSelectionGroupResponse = {
      id: 12,
      categoryId: null,
      displayOrder: 2,
      required: false,
      minSelections: 0,
      maxSelections: 1,
      productIds: [],
    };
    const withCategoryName: SpecialSelectionGroupResponse = {
      ...withoutCategoryName,
      categoryId: 7,
      categoryName: 'Bebidas',
      productIds: [301],
    };

    expect(withoutCategoryName.categoryName).toBeUndefined();
    expect(withCategoryName.categoryName).toBe('Bebidas');
    expect(withCategoryName.productIds).toEqual([301]);
    expectTypeOf<SpecialSelectionGroupResponse['categoryId']>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<SpecialSelectionGroupResponse['categoryName']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<SpecialSelectionGroupResponse['productIds']>().toEqualTypeOf<number[]>();
  });

  it('keeps selected product ids separate in order request, response, and dock contracts', () => {
    const detail: CreateOrderDetail = {
      productId: 90,
      instructions: 'Sin cebolla',
      selectedOptionIds: [801],
      selectedProductIds: [201, 202],
    };
    const request: CreateOrderRequest = {
      tableId: 4,
      details: [detail],
    };
    const product: ProductListResponse = {
      id: 90,
      name: 'Combo Ejecutivo',
      basePrice: 25,
      active: true,
      categoryId: 5,
      categoryName: 'Combos',
      areaId: 2,
      selectionType: SELECTION_TYPE.SPECIAL_SELECTION,
    };
    const dockItem: DockItem = {
      product,
      instructions: 'Sin cebolla',
      selectedOptionIds: [801],
      selectedProductIds: [201, 202],
      optionNames: ['Grande'],
      quantity: 1,
    };

    expect(request.details[0].selectedProductIds).toEqual([201, 202]);
    expect(dockItem.selectedProductIds).toEqual([201, 202]);
    expectTypeOf<CreateOrderDetail['selectedProductIds']>().toEqualTypeOf<
      number[] | undefined
    >();
    expectTypeOf<DockItem['selectedProductIds']>().toEqualTypeOf<number[] | undefined>();
    expectTypeOf<OrderDetailItem['selectedProductIds']>().toEqualTypeOf<
      number[] | undefined
    >();
    expectTypeOf<ClientOrderDetail['selectedProductIds']>().toEqualTypeOf<
      number[] | undefined
    >();
  });

  it('references suggested-price breakdown entries by product id', () => {
    const entry: SuggestedPriceBreakdownEntry = {
      productId: 41,
      name: 'Sopa del día',
      cost: 3.75,
    };

    expect(entry).toEqual({ productId: 41, name: 'Sopa del día', cost: 3.75 });
    expectTypeOf<SuggestedPriceBreakdownEntry['productId']>().toEqualTypeOf<number>();
  });

  it('normalizes selection type across product, combo, and order DTOs', () => {
    const values: SelectionType[] = [
      SELECTION_TYPE.STANDARD,
      SELECTION_TYPE.SPECIAL_SELECTION,
    ];

    expect(values).toEqual(['STANDARD', 'SPECIAL_SELECTION']);
    expectTypeOf<SelectionType>().toEqualTypeOf<'STANDARD' | 'SPECIAL_SELECTION'>();
    expectTypeOf<ProductCreateRequest['selectionType']>().toEqualTypeOf<
      SelectionType | undefined
    >();
    expectTypeOf<ProductUpdateRequest['selectionType']>().toEqualTypeOf<
      SelectionType | undefined
    >();
    expectTypeOf<ProductResponse['selectionType']>().toEqualTypeOf<
      SelectionType | undefined
    >();
    expectTypeOf<ProductListResponse['selectionType']>().toEqualTypeOf<
      SelectionType | undefined
    >();
    expectTypeOf<SpecialSelectionResponse['selectionType']>().toEqualTypeOf<SelectionType>();
    expectTypeOf<OrderDetailItem['selectionType']>().toEqualTypeOf<
      SelectionType | undefined
    >();
    expectTypeOf<ClientOrderDetail['selectionType']>().toEqualTypeOf<
      SelectionType | undefined
    >();
  });
});
