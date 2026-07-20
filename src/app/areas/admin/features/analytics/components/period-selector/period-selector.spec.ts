import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';

import { PeriodSelector } from './period-selector';
import periodSelectorHtml from './period-selector.html?raw';

function setInputValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function getInputById(root: HTMLElement, id: string): HTMLInputElement {
  const el = root.querySelector(`#${id}`);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Input #${id} not found or not an HTMLInputElement`);
  }
  return el;
}

function getButtonByLabel(root: HTMLElement, label: string): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll('p-button button'));
  const match = buttons.find((btn) => btn.textContent.trim() === label);
  if (match === undefined) {
    throw new Error(`Button with label "${label}" not found`);
  }
  return match;
}

function clickButton(button: HTMLButtonElement): void {
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('PeriodSelector', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('period-selector.html')) {
        return Promise.resolve(periodSelectorHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  let fixture: ComponentFixture<PeriodSelector>;
  let component: PeriodSelector;
  let state: AnalyticsPeriodState;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 17)));

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PeriodSelector],
      providers: [provideRouter([]), AnalyticsPeriodState],
    }).compileComponents();

    fixture = TestBed.createComponent(PeriodSelector);
    component = fixture.componentInstance;
    state = TestBed.inject(AnalyticsPeriodState);
    fixture.detectChanges();
    // Flush the queueMicrotask in the constructor so from/to are settled.
    await Promise.resolve();
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getRoot(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  describe('default state', () => {
    it('exposes bucket=monthly and the last-6-month range ending at the current month', () => {
      expect(component.bucket()).toBe('monthly');
      expect(component.from()).toBe('2026-02');
      expect(component.to()).toBe('2026-07');
    });

    it('renders the resolved from/to values in the native inputs', () => {
      const fromInput = getInputById(getRoot(), 'period-from');
      const toInput = getInputById(getRoot(), 'period-to');
      expect(fromInput.value).toBe('2026-02');
      expect(toInput.value).toBe('2026-07');
    });

    it('exposes no errorMessage on a fresh mount', () => {
      expect(component.errorMessage()).toBeNull();
    });

    it('renders the monthly bucket placeholder example "AAAA-MM" on the from/to inputs', () => {
      const fromInput = getInputById(getRoot(), 'period-from');
      const toInput = getInputById(getRoot(), 'period-to');
      expect(fromInput.getAttribute('placeholder')).toBe('AAAA-MM');
      expect(toInput.getAttribute('placeholder')).toBe('AAAA-MM');
    });

    it('does not render any p-message warning on a valid initial range', () => {
      expect(getRoot().querySelector('p-message')).toBeNull();
    });
  });

  describe('bucket change', () => {
    it('calls AnalyticsPeriodState.setBucket when the bucket changes', () => {
      const setBucketSpy = vi.spyOn(state, 'setBucket');

      component.onBucketChange('yearly');
      fixture.detectChanges();

      expect(setBucketSpy).toHaveBeenCalledWith('yearly');
    });

    it('re-reads the from/to range from the state after a bucket change', () => {
      component.onBucketChange('yearly');
      fixture.detectChanges();

      expect(component.bucket()).toBe('yearly');
      expect(component.from()).toBe('2026-02');
      expect(component.to()).toBe('2026-07');
    });

    it('switches the placeholder example when the bucket changes', () => {
      component.onBucketChange('daily');
      fixture.detectChanges();

      const fromInput = getInputById(getRoot(), 'period-from');
      expect(fromInput.getAttribute('placeholder')).toBe('AAAA-MM-DD');
    });
  });

  describe('from input', () => {
    it('updates the from signal when the input emits a change', () => {
      const fromInput = getInputById(getRoot(), 'period-from');
      setInputValue(fromInput, '2026-05');
      fixture.detectChanges();

      expect(component.from()).toBe('2026-05');
    });

    it('shows a format-error message when from is not a valid monthly key', () => {
      const fromInput = getInputById(getRoot(), 'period-from');
      setInputValue(fromInput, '2026-1');
      fixture.detectChanges();

      expect(component.fromValid()).toBe(false);
      expect(component.errorMessage()).toBe('Formato de fecha inválido para el bucket seleccionado');
      expect(getRoot().querySelector('p-message')).toBeTruthy();
    });
  });

  describe('range validation', () => {
    it('shows a range error message when to < from on a monthly bucket', () => {
      const toInput = getInputById(getRoot(), 'period-to');
      setInputValue(toInput, '2026-01');
      fixture.detectChanges();

      expect(component.toValid()).toBe(true);
      expect(component.rangeValid()).toBe(false);
      expect(component.errorMessage()).toBe(
        'La fecha final debe ser igual o posterior a la inicial',
      );
    });

    it('clears the errorMessage when both endpoints are valid and ordered', () => {
      const fromInput = getInputById(getRoot(), 'period-from');
      const toInput = getInputById(getRoot(), 'period-to');
      setInputValue(fromInput, '2026-03');
      setInputValue(toInput, '2026-06');
      fixture.detectChanges();

      expect(component.fromValid()).toBe(true);
      expect(component.toValid()).toBe(true);
      expect(component.rangeValid()).toBe(true);
      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('apply button', () => {
    it('is enabled when the range is valid and ordered', () => {
      const applyBtn = getButtonByLabel(getRoot(), 'Aplicar');
      expect(applyBtn.disabled).toBe(false);
    });

    it('is disabled while the format is invalid (from="2026-1")', () => {
      const fromInput = getInputById(getRoot(), 'period-from');
      setInputValue(fromInput, '2026-1');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(), 'Aplicar');
      expect(applyBtn.disabled).toBe(true);
    });

    it('is disabled when to < from', () => {
      const toInput = getInputById(getRoot(), 'period-to');
      setInputValue(toInput, '2026-01');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(), 'Aplicar');
      expect(applyBtn.disabled).toBe(true);
    });

    it('commits the range to the shared state on click', () => {
      const setRangeSpy = vi.spyOn(state, 'setRange');

      const fromInput = getInputById(getRoot(), 'period-from');
      const toInput = getInputById(getRoot(), 'period-to');
      setInputValue(fromInput, '2026-03');
      setInputValue(toInput, '2026-06');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(), 'Aplicar');
      clickButton(applyBtn);
      fixture.detectChanges();

      expect(setRangeSpy).toHaveBeenCalledWith('2026-03', '2026-06');
      expect(state.period()).toEqual({ bucket: 'monthly', from: '2026-03', to: '2026-06' });
    });

    it('does not commit when apply is clicked while errorMessage is set', () => {
      const setRangeSpy = vi.spyOn(state, 'setRange');

      const fromInput = getInputById(getRoot(), 'period-from');
      setInputValue(fromInput, '2026-1');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(), 'Aplicar');
      expect(applyBtn.disabled).toBe(true);
      clickButton(applyBtn);
      fixture.detectChanges();

      expect(setRangeSpy).not.toHaveBeenCalled();
    });
  });

  describe('reset button', () => {
    it('returns bucket, from, and to to the defaults', () => {
      const fromInput = getInputById(getRoot(), 'period-from');
      const toInput = getInputById(getRoot(), 'period-to');
      setInputValue(fromInput, '2025-01');
      setInputValue(toInput, '2025-05');
      fixture.detectChanges();

      const resetBtn = getButtonByLabel(getRoot(), 'Restablecer');
      clickButton(resetBtn);
      fixture.detectChanges();

      expect(state.bucket()).toBe('monthly');
      expect(state.from()).toBe('2026-02');
      expect(state.to()).toBe('2026-07');
      expect(component.from()).toBe('2026-02');
      expect(component.to()).toBe('2026-07');
    });

    it('clears any displayed warning after reset', () => {
      const fromInput = getInputById(getRoot(), 'period-from');
      setInputValue(fromInput, '2026-1');
      fixture.detectChanges();
      expect(component.errorMessage()).not.toBeNull();

      const resetBtn = getButtonByLabel(getRoot(), 'Restablecer');
      clickButton(resetBtn);
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(getRoot().querySelector('p-message')).toBeNull();
    });
  });
});