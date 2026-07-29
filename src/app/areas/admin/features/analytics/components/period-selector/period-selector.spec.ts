import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideRouter } from '@angular/router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';

import { PeriodSelector, type PeriodSelectorVariant } from './period-selector';
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

async function configure(variant: PeriodSelectorVariant): Promise<{
  fixture: ComponentFixture<PeriodSelector>;
  component: PeriodSelector;
  state: AnalyticsPeriodState;
}> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [PeriodSelector],
    providers: [provideRouter([]), AnalyticsPeriodState],
  }).compileComponents();

  const fixture = TestBed.createComponent(PeriodSelector);
  fixture.componentInstance.setVariant(variant);
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    state: TestBed.inject(AnalyticsPeriodState),
  };
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

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 17)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getRoot(fixture: ComponentFixture<PeriodSelector>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  describe('inline variant', () => {
    it('exposes the last-6-month range ending at the current month', async () => {
      const { component } = await configure('inline');
      expect(component.from()).toBe('2026-02');
      expect(component.to()).toBe('2026-07');
    });

    it('renders the resolved from/to values in the native inputs', async () => {
      const { fixture } = await configure('inline');
      const root = getRoot(fixture);
      const fromInput = getInputById(root, 'period-from');
      const toInput = getInputById(root, 'period-to');
      expect(fromInput.value).toBe('2026-02');
      expect(toInput.value).toBe('2026-07');
    });

    it('exposes no errorMessage on a fresh mount', async () => {
      const { component } = await configure('inline');
      expect(component.errorMessage()).toBeNull();
    });

    it('renders the monthly placeholder example "AAAA-MM" on the from/to inputs', async () => {
      const { fixture } = await configure('inline');
      const root = getRoot(fixture);
      const fromInput = getInputById(root, 'period-from');
      const toInput = getInputById(root, 'period-to');
      expect(fromInput.getAttribute('placeholder')).toBe('AAAA-MM');
      expect(toInput.getAttribute('placeholder')).toBe('AAAA-MM');
    });

    it('does not render any p-message warning on a valid initial range', async () => {
      const { fixture } = await configure('inline');
      expect(getRoot(fixture).querySelector('p-message')).toBeNull();
    });

    it('updates the from signal when the input emits a change', async () => {
      const { fixture, component } = await configure('inline');
      const fromInput = getInputById(getRoot(fixture), 'period-from');
      setInputValue(fromInput, '2026-05');
      fixture.detectChanges();

      expect(component.from()).toBe('2026-05');
    });

    it('shows a format-error message when from is not a valid monthly key', async () => {
      const { fixture, component } = await configure('inline');
      const fromInput = getInputById(getRoot(fixture), 'period-from');
      setInputValue(fromInput, '2026-1');
      fixture.detectChanges();

      expect(component.fromValid()).toBe(false);
      expect(component.errorMessage()).toBe('Formato de fecha inválido. Use AAAA-MM');
      expect(getRoot(fixture).querySelector('p-message')).toBeTruthy();
    });

    it('shows a range error message when to < from', async () => {
      const { fixture, component } = await configure('inline');
      const toInput = getInputById(getRoot(fixture), 'period-to');
      setInputValue(toInput, '2026-01');
      fixture.detectChanges();

      expect(component.toValid()).toBe(true);
      expect(component.rangeValid()).toBe(false);
      expect(component.errorMessage()).toBe(
        'La fecha final debe ser igual o posterior a la inicial',
      );
    });

    it('clears the errorMessage when both endpoints are valid and ordered', async () => {
      const { fixture, component } = await configure('inline');
      const fromInput = getInputById(getRoot(fixture), 'period-from');
      const toInput = getInputById(getRoot(fixture), 'period-to');
      setInputValue(fromInput, '2026-03');
      setInputValue(toInput, '2026-06');
      fixture.detectChanges();

      expect(component.fromValid()).toBe(true);
      expect(component.toValid()).toBe(true);
      expect(component.rangeValid()).toBe(true);
      expect(component.errorMessage()).toBeNull();
    });

    it('apply button is enabled when the range is valid and ordered', async () => {
      const { fixture } = await configure('inline');
      const applyBtn = getButtonByLabel(getRoot(fixture), 'Aplicar');
      expect(applyBtn.disabled).toBe(false);
    });

    it('apply button is disabled while the format is invalid (from="2026-1")', async () => {
      const { fixture } = await configure('inline');
      const fromInput = getInputById(getRoot(fixture), 'period-from');
      setInputValue(fromInput, '2026-1');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(fixture), 'Aplicar');
      expect(applyBtn.disabled).toBe(true);
    });

    it('apply button is disabled when to < from', async () => {
      const { fixture } = await configure('inline');
      const toInput = getInputById(getRoot(fixture), 'period-to');
      setInputValue(toInput, '2026-01');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(fixture), 'Aplicar');
      expect(applyBtn.disabled).toBe(true);
    });

    it('commits the range to the shared state when apply is clicked', async () => {
      const { fixture, state } = await configure('inline');
      const setRangeSpy = vi.spyOn(state, 'setRange');
      const fromInput = getInputById(getRoot(fixture), 'period-from');
      const toInput = getInputById(getRoot(fixture), 'period-to');
      setInputValue(fromInput, '2026-03');
      setInputValue(toInput, '2026-06');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(fixture), 'Aplicar');
      clickButton(applyBtn);
      fixture.detectChanges();

      expect(setRangeSpy).toHaveBeenCalledWith('2026-03', '2026-06');
      expect(state.period()).toEqual({ from: '2026-03', to: '2026-06' });
    });

    it('does not commit when apply is clicked while errorMessage is set', async () => {
      const { fixture, state } = await configure('inline');
      const setRangeSpy = vi.spyOn(state, 'setRange');
      const fromInput = getInputById(getRoot(fixture), 'period-from');
      setInputValue(fromInput, '2026-1');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(fixture), 'Aplicar');
      expect(applyBtn.disabled).toBe(true);
      clickButton(applyBtn);
      fixture.detectChanges();

      expect(setRangeSpy).not.toHaveBeenCalled();
    });

    it('reset returns from and to to the defaults', async () => {
      const { fixture, state, component } = await configure('inline');
      const fromInput = getInputById(getRoot(fixture), 'period-from');
      const toInput = getInputById(getRoot(fixture), 'period-to');
      setInputValue(fromInput, '2025-01');
      setInputValue(toInput, '2025-05');
      fixture.detectChanges();

      const resetBtn = getButtonByLabel(getRoot(fixture), 'Restablecer');
      clickButton(resetBtn);
      fixture.detectChanges();

      expect(state.from()).toBe('2026-02');
      expect(state.to()).toBe('2026-07');
      expect(component.from()).toBe('2026-02');
      expect(component.to()).toBe('2026-07');
    });

    it('reset clears any displayed warning', async () => {
      const { fixture, component } = await configure('inline');
      const fromInput = getInputById(getRoot(fixture), 'period-from');
      setInputValue(fromInput, '2026-1');
      fixture.detectChanges();
      expect(component.errorMessage()).not.toBeNull();

      const resetBtn = getButtonByLabel(getRoot(fixture), 'Restablecer');
      clickButton(resetBtn);
      fixture.detectChanges();

      expect(component.errorMessage()).toBeNull();
      expect(getRoot(fixture).querySelector('p-message')).toBeNull();
    });
  });

  describe('docked variant', () => {
    it('shows the collapsed pill with the current range on mount', async () => {
      const { fixture, component } = await configure('docked');
      const root = getRoot(fixture);
      expect(component.expanded()).toBe(false);
      expect(root.querySelector('.period-dock')).toBeTruthy();
      expect(root.textContent).toContain('Periodo');
      expect(root.textContent).toContain(component.currentRangeLabel());
    });

    it('does not render the from/to inputs while collapsed', async () => {
      const { fixture } = await configure('docked');
      expect(getRoot(fixture).querySelector('#period-from')).toBeNull();
      expect(getRoot(fixture).querySelector('#period-to')).toBeNull();
    });

    it('toggle() expands the dock to show the form', async () => {
      const { fixture, component } = await configure('docked');
      component.toggle();
      fixture.detectChanges();

      expect(component.expanded()).toBe(true);
      expect(getRoot(fixture).querySelector('#period-from')).toBeTruthy();
      expect(getRoot(fixture).querySelector('#period-to')).toBeTruthy();
    });

    it('toggle() collapses the dock when it is already expanded', async () => {
      const { fixture, component } = await configure('docked');
      component.toggle();
      fixture.detectChanges();
      component.toggle();
      fixture.detectChanges();

      expect(component.expanded()).toBe(false);
    });

    it('apply commits the range and auto-collapses the dock', async () => {
      const { fixture, component, state } = await configure('docked');
      component.toggle();
      fixture.detectChanges();

      const fromInput = getInputById(getRoot(fixture), 'period-from');
      const toInput = getInputById(getRoot(fixture), 'period-to');
      setInputValue(fromInput, '2026-03');
      setInputValue(toInput, '2026-06');
      fixture.detectChanges();

      const applyBtn = getButtonByLabel(getRoot(fixture), 'Aplicar');
      clickButton(applyBtn);
      fixture.detectChanges();

      expect(state.period()).toEqual({ from: '2026-03', to: '2026-06' });
      expect(component.expanded()).toBe(false);
    });

    it('reset restores defaults and auto-collapses the dock', async () => {
      const { fixture, component, state } = await configure('docked');
      component.toggle();
      fixture.detectChanges();

      const fromInput = getInputById(getRoot(fixture), 'period-from');
      const toInput = getInputById(getRoot(fixture), 'period-to');
      setInputValue(fromInput, '2025-01');
      setInputValue(toInput, '2025-05');
      fixture.detectChanges();

      const resetBtn = getButtonByLabel(getRoot(fixture), 'Restablecer');
      clickButton(resetBtn);
      fixture.detectChanges();

      expect(state.period()).toEqual({ from: '2026-02', to: '2026-07' });
      expect(component.expanded()).toBe(false);
    });

    it('collapse() hides the form and returns to the pill', async () => {
      const { fixture, component } = await configure('docked');
      component.toggle();
      fixture.detectChanges();
      expect(component.expanded()).toBe(true);

      component.collapse();
      fixture.detectChanges();

      expect(component.expanded()).toBe(false);
      expect(getRoot(fixture).querySelector('#period-from')).toBeNull();
    });

    it('refresh button emits the refresh event when clicked', async () => {
      const { fixture, component } = await configure('docked');
      const refreshSpy = vi.fn();
      component.refresh.subscribe(refreshSpy);

      const refreshBtn = getRoot(fixture).querySelector<HTMLButtonElement>(
        'button[aria-label="Actualizar datos"]',
      );
      if (!refreshBtn) throw new Error('Refresh button not found');
      expect(refreshBtn).toBeTruthy();
      clickButton(refreshBtn);
      fixture.detectChanges();

      expect(refreshSpy).toHaveBeenCalled();
    });
  });
});
