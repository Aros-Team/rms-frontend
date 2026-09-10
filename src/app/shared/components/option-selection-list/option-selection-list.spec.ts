/**
 * Tests for the OptionSelectionList component.
 *
 * Feature: Renders radio buttons (SINGLE_CHOICE) or checkboxes (MULTI_SELECT)
 * for a list of selection options, with support for extra prices and disabled state.
 * Contract: Correct input type rendered per selection type, selectionChange emits
 * expected ids, disabled options get opacity-50, extra prices shown when > 0.
 * Approach: Mount component via TestBed, configure selectionType and options per test,
 * query DOM for PrimeNG elements, assert exact counts and emitted values.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { OptionSelectionList, SelectionOption } from './option-selection-list';

import optionSelectionListHtml from './option-selection-list.html?raw';
import optionSelectionListCss from './option-selection-list.css?raw';

describe('OptionSelectionList', () => {
  let component: OptionSelectionList;
  let fixture: ComponentFixture<OptionSelectionList>;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('option-selection-list.html')) {
        return Promise.resolve(optionSelectionListHtml as unknown as string);
      }
      if (url.endsWith('option-selection-list.css')) {
        return Promise.resolve(optionSelectionListCss as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  const mockOptions: SelectionOption[] = [
    { id: 1, name: 'Leche' },
    { id: 2, name: 'Azúcar', extraPrice: 5 },
    { id: 3, name: 'Canela', disabled: true },
  ];

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OptionSelectionList],
    }).compileComponents();

    fixture = TestBed.createComponent(OptionSelectionList);
    component = fixture.componentInstance;
  });

  function getEl(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('should create', () => {
    expect(component).toBeInstanceOf(OptionSelectionList);
  });

  it('should have selector app-option-selection-list', () => {
    expect(component).toBeInstanceOf(OptionSelectionList);
  });

  describe('SINGLE_CHOICE', () => {
    beforeEach(() => {
      component.selectionType = OptionSelectionType.SINGLE_CHOICE;
      component.options = mockOptions;
      fixture.detectChanges();
    });

    it('should render p-radiobutton for each option', () => {
      const radioButtons = getEl().querySelectorAll('p-radiobutton');
      expect(radioButtons.length).toBe(mockOptions.length);
    });

    it('should not render p-checkbox elements', () => {
      const checkboxes = getEl().querySelectorAll('p-checkbox');
      expect(checkboxes.length).toBe(0);
    });

    it('should emit selectionChange with [optionId] when radio selected', () => {
      const spy = vi.fn();
      component.selectionChange.subscribe(spy);
      component.onRadioChange(1);
      expect(spy).toHaveBeenCalledWith([1]);
    });

    it('should report isRadio as true', () => {
      expect(component.isRadio).toBe(true);
    });
  });

  describe('MULTI_SELECT', () => {
    beforeEach(() => {
      component.selectionType = OptionSelectionType.MULTI_SELECT;
      component.options = mockOptions;
      component.selectedIds = [];
      fixture.detectChanges();
    });

    it('should render p-checkbox for each option', () => {
      const checkboxes = getEl().querySelectorAll('p-checkbox');
      expect(checkboxes.length).toBe(mockOptions.length);
    });

    it('should not render p-radiobutton elements', () => {
      const radioButtons = getEl().querySelectorAll('p-radiobutton');
      expect(radioButtons.length).toBe(0);
    });

    it('should add option to selection when checked', () => {
      const spy = vi.fn();
      component.selectionChange.subscribe(spy);
      component.onCheckboxChange(1, true);
      expect(spy).toHaveBeenCalledWith([1]);
    });

    it('should remove option from selection when unchecked', () => {
      const spy = vi.fn();
      component.selectionChange.subscribe(spy);
      component.selectedIds = [1, 2];
      component.onCheckboxChange(1, false);
      expect(spy).toHaveBeenCalledWith([2]);
    });

    it('should report isRadio as false', () => {
      expect(component.isRadio).toBe(false);
    });
  });

  describe('Empty options', () => {
    beforeEach(() => {
      component.selectionType = OptionSelectionType.SINGLE_CHOICE;
      component.options = [];
      fixture.detectChanges();
    });

    it('should show no options message', () => {
      const message = getEl().textContent;
      expect(message).toContain('No hay opciones disponibles');
    });

    it('should not render any radio buttons', () => {
      const radioButtons = getEl().querySelectorAll('p-radiobutton');
      expect(radioButtons.length).toBe(0);
    });
  });

  describe('Disabled options', () => {
    beforeEach(() => {
      component.selectionType = OptionSelectionType.SINGLE_CHOICE;
      component.options = mockOptions;
      fixture.detectChanges();
    });

    it('should apply opacity-50 class to disabled option', () => {
      const optionDivs = getEl().querySelectorAll('.flex.items-center');
      const disabledDiv = optionDivs[2]; // third option is disabled
      expect(disabledDiv.classList.contains('opacity-50')).toBe(true);
    });
  });

  describe('Extra price display', () => {
    beforeEach(() => {
      component.selectionType = OptionSelectionType.SINGLE_CHOICE;
      component.options = mockOptions;
      fixture.detectChanges();
    });

    it('should show extra price when > 0', () => {
      const text = getEl().textContent;
      expect(text).toContain('+$5');
    });

    it('should not show extra price when 0 or undefined', () => {
      const optionDivs = getEl().querySelectorAll('.flex.items-center');
      const firstOptionText = optionDivs[0].textContent;
      expect(firstOptionText).not.toContain('+$');
    });
  });

  describe('isSelected', () => {
    beforeEach(() => {
      component.selectedIds = [1, 3];
    });

    it('should return true for selected id', () => {
      expect(component.isSelected(1)).toBe(true);
    });

    it('should return false for unselected id', () => {
      expect(component.isSelected(2)).toBe(false);
    });
  });

  describe('onCheckboxChange edge cases', () => {
    beforeEach(() => {
      component.selectionType = OptionSelectionType.MULTI_SELECT;
      component.selectedIds = [];
    });

    it('should handle unchecking an id not in the array', () => {
      const spy = vi.fn();
      component.selectionChange.subscribe(spy);
      component.onCheckboxChange(99, false);
      expect(spy).toHaveBeenCalledWith([]);
    });

    it('should add to existing selections', () => {
      const spy = vi.fn();
      component.selectionChange.subscribe(spy);
      component.selectedIds = [1];
      component.onCheckboxChange(2, true);
      expect(spy).toHaveBeenCalledWith([1, 2]);
    });
  });
});
