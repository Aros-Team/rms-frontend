import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { of } from 'rxjs';

import managerHtml from './option-groups-manager.html?raw';

import { OptionGroupsManager } from './option-groups-manager';
import { Product } from '@app/core/services/products/product';
import { ProductOption as ProductOptionService } from '@app/core/services/product-option/product-option';
import { OptionGroup as OptionGroupService } from '@app/core/services/option-group/option-group';
import { ProductCache } from '../product-cache';
import { createRecipeRow } from '../product-recipe-page/recipe-rows';

const groupStub = {
  getProductOptionGroups: vi.fn(),
  createOptionGroup: vi.fn(),
  updateOptionGroup: vi.fn(),
};

const productOptionStub = {
  getOptionsByGroup: vi.fn(),
  createOption: vi.fn(),
  updateOption: vi.fn(),
};

const productStub = {
  getOptions: vi.fn(),
  associateOption: vi.fn(),
  updateOptionExtraPrice: vi.fn(),
  detachOption: vi.fn(),
  detachOptionGroup: vi.fn(),
};

const cacheStub = {
  referenceData: {
    data: vi.fn().mockReturnValue({
      variants: [
        {
          id: 5,
          supplyName: 'Huevo',
          quantity: 1,
          unitAbbreviation: 'u',
          unitCost: { amount: '500', currency: 'COP' },
          categoryId: 1,
          categoryName: 'Proteínas',
          displayName: 'Huevo — 1 u',
        },
      ],
      areas: [],
      categories: [],
      productOptions: [],
    }),
    isLoading: vi.fn().mockReturnValue(false),
    error: vi.fn().mockReturnValue(undefined),
    refresh: vi.fn(),
    loadIfStale: vi.fn(),
  },
};

const baseGroup = {
  id: 1,
  name: 'Proteína',
  description: 'Elige la proteína',
  selectionType: 'SINGLE_CHOICE' as const,
  productIds: [7, 8],
  required: true,
};

function setup(): OptionGroupsManager {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      OptionGroupsManager,
      { provide: Product, useValue: productStub },
      { provide: ProductOptionService, useValue: productOptionStub },
      { provide: OptionGroupService, useValue: groupStub },
      { provide: ProductCache, useValue: cacheStub },
    ],
  });
  const component = TestBed.inject(OptionGroupsManager);
  component.productId = 7;
  return component;
}

describe('OptionGroupsManager', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('option-groups-manager.html')) {
        return Promise.resolve(managerHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    groupStub.getProductOptionGroups.mockReturnValue(of([baseGroup]));
    productOptionStub.getOptionsByGroup.mockReturnValue(
      of([
        {
          id: 11,
          name: 'Huevo',
          optionGroupId: 1,
          optionGroupName: 'Proteína',
          recipe: [{ supplyVariantId: 5, requiredQuantity: 1 }],
        },
      ]),
    );
    productStub.getOptions.mockReturnValue(
      of([
        {
          id: 11,
          name: 'Huevo',
          optionGroupId: 1,
          optionGroupName: 'Proteína',
          extraPrice: { amount: '2500', currency: 'COP' },
        },
      ]),
    );
    groupStub.updateOptionGroup.mockReturnValue(of(baseGroup));
    groupStub.createOptionGroup.mockReturnValue(of(baseGroup));
    productOptionStub.createOption.mockReturnValue(
      of({ id: 11, name: 'Huevo', optionGroupId: 1, optionGroupName: 'Proteína' }),
    );
    productStub.associateOption.mockReturnValue(of({}));
  });

  it('merges group options with the recipe and the per-product surcharge', () => {
    const component = setup();
    component.reload();

    const group = component.groups()[0];
    expect(group.required).toBe(true);
    expect(group.options[0].associated).toBe(true);
    expect(group.options[0].extraPrice).toBe(2500);
    expect(group.options[0].recipe).toEqual([{ supplyVariantId: 5, requiredQuantity: 1 }]);
  });

  it('preserves every product association when editing a group', () => {
    const component = setup();
    component.reload();
    component.openEditGroup(component.groups()[0]);
    component.updateGroupName('Proteína principal');

    component.saveGroup();

    const [id, request] = groupStub.updateOptionGroup.mock.calls[0] as [
      number,
      { productIds: number[]; required: boolean },
    ];
    expect(id).toBe(1);
    expect(request.productIds).toEqual([7, 8]);
    expect(request.required).toBe(true);
  });

  it('creates an option and associates it with the product', () => {
    const component = setup();
    component.reload();
    const group = component.groups()[0];

    component.openCreateOption(group);
    component.updateOptionName('Huevo');
    component.updateOptionExtraPrice('1500');
    component.updateOptionRows([createRecipeRow(5, '1')]);
    component.saveOption();

    expect(productOptionStub.createOption).toHaveBeenCalledWith({
      name: 'Huevo',
      optionGroupId: 1,
      recipe: [{ supplyVariantId: 5, requiredQuantity: 1 }],
    });
    expect(productStub.associateOption).toHaveBeenCalledWith(7, 11, 1500);
  });
});
