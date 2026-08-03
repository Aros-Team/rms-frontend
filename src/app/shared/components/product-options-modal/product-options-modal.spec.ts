import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { ProductOptionsModal, ProductOptionsConfirmEvent } from './product-options-modal';
import { ProductOption } from '@app/shared/models/dto/products/product-option';
import { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

import productOptionsModalHtml from './product-options-modal.html?raw';
import optionSelectionListHtml from '../option-selection-list/option-selection-list.html?raw';
import optionGroupBadgeHtml from '../option-group-badge/option-group-badge.html?raw';
import removableChipHtml from '../removable-chip/removable-chip.html?raw';

const mockProduct: ProductListResponse = {
  id: 1,
  name: 'Hamburguesa',
  description: 'Deliciosa hamburguesa',
  basePrice: 15000,
  thumbnailUrl: '',
  categoryId: 1,
  categoryName: 'Platos',
  available: true,
};

const mockOptions: ProductOption[] = [
  { id: 10, name: 'Lechuga', optionGroupId: 1, optionGroupName: 'Guarniciones', categorySelectionType: OptionSelectionType.SINGLE_CHOICE },
  { id: 11, name: 'Tomate', optionGroupId: 1, optionGroupName: 'Guarniciones', categorySelectionType: OptionSelectionType.SINGLE_CHOICE },
  { id: 20, name: 'Tocineta', optionGroupId: 2, optionGroupName: 'Extras', extraPrice: { amount: 3000, currency: 'COP' }, categorySelectionType: OptionSelectionType.EXTRA },
  { id: 21, name: 'Queso', optionGroupId: 2, optionGroupName: 'Extras', extraPrice: { amount: 2000, currency: 'COP' }, categorySelectionType: OptionSelectionType.EXTRA },
];

describe('ProductOptionsModal', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('product-options-modal.html')) return Promise.resolve(productOptionsModalHtml as unknown as string);
      if (url.endsWith('option-selection-list.html')) return Promise.resolve(optionSelectionListHtml as unknown as string);
      if (url.endsWith('option-group-badge.html')) return Promise.resolve(optionGroupBadgeHtml as unknown as string);
      if (url.endsWith('removable-chip.html')) return Promise.resolve(removableChipHtml as unknown as string);
      return Promise.resolve('');
    });
  });

  function setup(): ProductOptionsModal {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ProductOptionsModal] });
    const component = TestBed.inject(ProductOptionsModal);
    component.product = mockProduct;
    component.options = mockOptions;
    component.visible = true;
    return component;
  }

  describe('groupMeta', () => {
    it('should group options by groupId', () => {
      const component = setup();
      const meta = component.groupMeta();
      expect(meta.length).toBe(2);
      expect(meta[0].groupName).toBe('Guarniciones');
      expect(meta[0].groupId).toBe(1);
      expect(meta[0].options.length).toBe(2);
      expect(meta[1].groupName).toBe('Extras');
      expect(meta[1].groupId).toBe(2);
      expect(meta[1].options.length).toBe(2);
    });

    it('should map selectionType from option', () => {
      const component = setup();
      const meta = component.groupMeta();
      expect(meta[0].selectionType).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(meta[1].selectionType).toBe(OptionSelectionType.EXTRA);
    });

    it('should map extraPrice amounts to options', () => {
      const component = setup();
      const meta = component.groupMeta();
      expect(meta[1].options[0].extraPrice).toBe(3000);
      expect(meta[1].options[1].extraPrice).toBe(2000);
      expect(meta[0].options[0].extraPrice).toBeUndefined();
    });
  });

  describe('selectedChips', () => {
    it('should create chips for selected options', () => {
      const component = setup();
      component.selectedOptionIds.set([10, 20]);

      const chips = component.selectedChips();
      expect(chips.length).toBe(2);
      expect(chips[0].label).toBe('Lechuga');
      expect(chips[0].id).toBe(10);
      expect(chips[1].label).toBe('Tocineta');
      expect(chips[1].id).toBe(20);
    });

    it('should include extraPrice meta for options with price', () => {
      const component = setup();
      component.selectedOptionIds.set([20]);

      const chips = component.selectedChips();
      expect(chips[0].meta).toContain('3000');
    });

    it('should not include meta for options without extraPrice', () => {
      const component = setup();
      component.selectedOptionIds.set([10]);

      const chips = component.selectedChips();
      expect(chips[0].meta).toBeUndefined();
    });
  });

  describe('extraCharge', () => {
    it('should sum extraPrice from all selected options', () => {
      const component = setup();
      component.selectedOptionIds.set([10, 20, 21]);

      expect(component.extraCharge()).toBe(5000);
    });

    it('should return 0 when no extra-priced options selected', () => {
      const component = setup();
      component.selectedOptionIds.set([10]);

      expect(component.extraCharge()).toBe(0);
    });

    it('should return 0 when nothing selected', () => {
      const component = setup();
      expect(component.extraCharge()).toBe(0);
    });
  });

  describe('removeSelection', () => {
    it('should remove the given optionId from selections', () => {
      const component = setup();
      component.selectedOptionIds.set([10, 20]);

      component.removeSelection(10);

      expect(component.selectedOptionIds()).toEqual([20]);
    });

    it('should not affect other options when removing', () => {
      const component = setup();
      component.selectedOptionIds.set([10, 20, 21]);

      component.removeSelection(20);

      expect(component.selectedOptionIds()).toEqual([10, 21]);
      expect(component.extraCharge()).toBe(2000);
    });
  });

  describe('getSelectedIdsForGroup', () => {
    it('should return only selected ids belonging to the group', () => {
      const component = setup();
      component.selectedOptionIds.set([10, 20]);

      expect(component.getSelectedIdsForGroup(1)).toEqual([10]);
      expect(component.getSelectedIdsForGroup(2)).toEqual([20]);
    });

    it('should return empty array when nothing selected in group', () => {
      const component = setup();
      component.selectedOptionIds.set([10]);

      expect(component.getSelectedIdsForGroup(2)).toEqual([]);
    });
  });

  describe('onGroupSelectionChange', () => {
    it('should replace selections for the given group', () => {
      const component = setup();
      component.selectedOptionIds.set([10]);

      component.onGroupSelectionChange(1, [11]);

      expect(component.selectedOptionIds()).toEqual([11]);
    });

    it('should keep selections from other groups', () => {
      const component = setup();
      component.selectedOptionIds.set([10, 20]);

      component.onGroupSelectionChange(1, [11]);

      expect(component.selectedOptionIds()).toContain(20);
      expect(component.selectedOptionIds()).toContain(11);
      expect(component.selectedOptionIds()).not.toContain(10);
    });
  });

  describe('onConfirm', () => {
    it('should emit confirm event with selected options and extraCharge', () => {
      const component = setup();
      component.selectedOptionIds.set([20]);
      component.instructions.set('sin cebolla');
      component.quantity.set(2);

      let emitted: ProductOptionsConfirmEvent | undefined;
      component.confirm.subscribe(e => emitted = e);

      component.onConfirm();

      expect(emitted).toBeDefined();
      expect(emitted?.product).toBe(mockProduct);
      expect(emitted?.selectedOptions.length).toBe(1);
      expect(emitted?.selectedOptions[0].optionName).toBe('Tocineta');
      expect(emitted?.extraCharge).toBe(3000);
      expect(emitted?.instructions).toBe('sin cebolla');
      expect(emitted?.quantity).toBe(2);
    });

    it('should not emit when product is null', () => {
      const component = setup();
      component.product = null;
      component.selectedOptionIds.set([20]);

      let emitted = false;
      component.confirm.subscribe(() => emitted = true);

      component.onConfirm();

      expect(emitted).toBe(false);
    });
  });

  describe('changeQuantity', () => {
    it('should increment quantity', () => {
      const component = setup();
      component.changeQuantity(1);
      expect(component.quantity()).toBe(2);
    });

    it('should decrement quantity', () => {
      const component = setup();
      component.quantity.set(3);
      component.changeQuantity(-1);
      expect(component.quantity()).toBe(2);
    });

    it('should not go below 1', () => {
      const component = setup();
      component.changeQuantity(-1);
      expect(component.quantity()).toBe(1);
    });

    it('should not go above 99', () => {
      const component = setup();
      component.quantity.set(99);
      component.changeQuantity(1);
      expect(component.quantity()).toBe(99);
    });
  });

  describe('onDismiss', () => {
    it('should emit dismiss event', () => {
      const component = setup();
      const spy = vi.fn();
      component.dismiss.subscribe(spy);
      component.onDismiss();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('onErrorClear', () => {
    it('should emit errorClear event', () => {
      const component = setup();
      const spy = vi.fn();
      component.errorClear.subscribe(spy);
      component.onErrorClear();
      expect(spy).toHaveBeenCalled();
    });
  });
});
