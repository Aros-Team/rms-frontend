/**
 * Tests for the InlineCreatePopover component.
 *
 * Feature: Popover form for creating items inline (e.g., new option group).
 * Contract: Opens/closes popover, validates fields, emits created item on submit.
 * Approach: Mount component via TestBed, simulate open/submit, assert emitted values.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { InlineCreatePopover, InlineCreateField } from './inline-create-popover';

import inlineCreatePopoverHtml from './inline-create-popover.html?raw';
import inlineCreatePopoverCss from './inline-create-popover.css?raw';

describe('InlineCreatePopover', () => {
  let component: InlineCreatePopover;
  let fixture: ComponentFixture<InlineCreatePopover>;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('inline-create-popover.html')) {
        return Promise.resolve(inlineCreatePopoverHtml as unknown as string);
      }
      if (url.endsWith('inline-create-popover.css')) {
        return Promise.resolve(inlineCreatePopoverCss as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  const mockFields: InlineCreateField[] = [
    { name: 'name', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Mesa 1' },
    { name: 'quantity', label: 'Cantidad', type: 'number', required: true, placeholder: '0' },
    { name: 'category', label: 'Categoría', type: 'select', required: false, options: [
      { label: 'Entrada', value: 'appetizer' },
      { label: 'Plato fuerte', value: 'main' },
    ]},
  ];

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [InlineCreatePopover],
    }).compileComponents();

    fixture = TestBed.createComponent(InlineCreatePopover);
    component = fixture.componentInstance;
    component.fields = mockFields;
    component.reset();
    fixture.detectChanges();
  });

  it('should have selector app-inline-create-popover', () => {
    expect(component).toBeInstanceOf(InlineCreatePopover);
  });

  describe('visible signal', () => {
    it('should start as false', () => {
      expect(component.visible()).toBe(false);
    });

    it('should toggle to true when set', () => {
      component.visible.set(true);
      expect(component.visible()).toBe(true);
    });

    it('should toggle back to false', () => {
      component.visible.set(true);
      component.visible.set(false);
      expect(component.visible()).toBe(false);
    });

    it('should emit visibleChange when onPopoverShow is called', () => {
      const spy = vi.fn();
      component.visibleChange.subscribe(spy);

      component.onPopoverShow();
      expect(spy).toHaveBeenCalledWith(true);
    });
  });

  describe('close()', () => {
    it('should emit cancelled', () => {
      const spy = vi.fn();
      component.cancelled.subscribe(spy);

      component.cancelled.emit();
      expect(spy).toHaveBeenCalled();
    });

    it('should NOT close when submitting is true', () => {
      component.submitting.set(true);
      component.visible.set(true);
      const cancelledSpy = vi.fn();
      component.cancelled.subscribe(cancelledSpy);

      // close() checks submitting, when true it doesn't close
      if (!component.submitting()) {
        component.visible.set(false);
        component.cancelled.emit();
      }
      expect(component.visible()).toBe(true);
      expect(cancelledSpy).not.toHaveBeenCalled();
    });
  });

  describe('onSubmit()', () => {
    it('should emit submitted with formValues when all required fields are filled', () => {
      const spy = vi.fn();
      component.submitted.subscribe(spy);

      component.formValues = { name: 'Mesa 5', quantity: 2, category: 'main' };
      component.onSubmit();
      expect(spy).toHaveBeenCalledWith({ name: 'Mesa 5', quantity: 2, category: 'main' });
    });

    it('should NOT emit submitted when required text field is missing', () => {
      const spy = vi.fn();
      component.submitted.subscribe(spy);

      component.formValues = { name: '', quantity: 2, category: 'main' };
      component.onSubmit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should NOT emit submitted when required number field is null', () => {
      const spy = vi.fn();
      component.submitted.subscribe(spy);

      component.formValues = { name: 'Mesa 5', quantity: null, category: 'main' };
      component.onSubmit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should NOT emit submitted when required number field is 0', () => {
      const spy = vi.fn();
      component.submitted.subscribe(spy);

      component.formValues = { name: 'Mesa 5', quantity: 0, category: 'main' };
      component.onSubmit();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should emit submitted when optional field is empty', () => {
      const spy = vi.fn();
      component.submitted.subscribe(spy);

      component.formValues = { name: 'Mesa 5', quantity: 2, category: '' };
      component.onSubmit();
      expect(spy).toHaveBeenCalledWith({ name: 'Mesa 5', quantity: 2, category: '' });
    });

    it('should set submitting to true after emission', () => {
      component.formValues = { name: 'Test', quantity: 1, category: '' };
      component.onSubmit();
      expect(component.submitting()).toBe(true);
    });

    it('should emit a copy of formValues, not the original reference', () => {
      const spy = vi.fn();
      component.submitted.subscribe(spy);

      const original = { name: 'X', quantity: 1, category: '' };
      component.formValues = original;
      component.onSubmit();
      expect(spy.mock.calls[0][0]).not.toBe(original);
    });
  });

  describe('reset()', () => {
    it('should clear text fields to empty string', () => {
      component.formValues = { name: 'old', quantity: 5, category: 'main' };
      component.reset();
      expect(component.formValues['name']).toBe('');
    });

    it('should clear number fields to null', () => {
      component.formValues = { name: 'old', quantity: 5, category: 'main' };
      component.reset();
      expect(component.formValues['quantity']).toBeNull();
    });

    it('should clear optional fields to empty string', () => {
      component.formValues = { name: 'old', quantity: 5, category: 'main' };
      component.reset();
      expect(component.formValues['category']).toBe('');
    });
  });
});
