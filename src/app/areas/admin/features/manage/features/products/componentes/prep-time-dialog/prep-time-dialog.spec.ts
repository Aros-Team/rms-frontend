import { TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { PrepTimeDialog, estimatePrepMinutes, type PrepTimeEstimate } from './prep-time-dialog';

import prepTimeDialogHtml from './prep-time-dialog.html?raw';

describe('estimatePrepMinutes', () => {
  it('averages the three times rounding up', () => {
    expect(estimatePrepMinutes(4, 9, 7)).toBe(7);
  });

  it('returns the exact average when it divides evenly', () => {
    expect(estimatePrepMinutes(6, 6, 6)).toBe(6);
  });

  it('rounds up fractional results', () => {
    expect(estimatePrepMinutes(1, 1, 2)).toBe(2);
  });

  it('handles zeros', () => {
    expect(estimatePrepMinutes(0, 0, 0)).toBe(0);
  });
});

describe('PrepTimeDialog', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('prep-time-dialog.html')) {
        return Promise.resolve(prepTimeDialogHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [PrepTimeDialog] });
    return TestBed.inject(PrepTimeDialog);
  }

  it('computes the resulting estimate from the three fields', () => {
    const component = setup();
    component.prepTimeForm.setValue({
      calmMinutes: 4,
      peakMinutes: 9,
      interruptionMinutes: 7,
    });
    expect(component.estimatedPrepMinutes()).toBe(7);
  });

  it('recomputes the estimate as values change (not caching the first value)', () => {
    const component = setup();
    component.prepTimeForm.controls.calmMinutes.setValue(4);
    component.prepTimeForm.controls.peakMinutes.setValue(9);
    component.prepTimeForm.controls.interruptionMinutes.setValue(7);
    expect(component.estimatedPrepMinutes()).toBe(7);

    component.prepTimeForm.controls.peakMinutes.setValue(30);
    expect(component.estimatedPrepMinutes()).toBe(14);
  });

  it('returns null estimate while fields are blank', () => {
    const component = setup();
    component.prepTimeForm.reset();
    expect(component.estimatedPrepMinutes()).toBeNull();
  });

  it('emits the PrepTimeEstimate and closes on apply', () => {
    const component = setup();
    component.prepTimeForm.setValue({
      calmMinutes: 4,
      peakMinutes: 9,
      interruptionMinutes: 7,
    });

    let emitted: PrepTimeEstimate | null = null;
    component.estimateApplied.subscribe((e) => { emitted = e; });

    component.visible.set(true);
    component.apply();

    expect(emitted).toEqual({
      calmMinutes: 4,
      peakMinutes: 9,
      interruptionMinutes: 7,
      estimatedPrepMinutes: 7,
    });
    expect(component.visible()).toBe(false);
  });

  it('does not emit when a field is missing', () => {
    const component = setup();
    component.prepTimeForm.setValue({
      calmMinutes: 4,
      peakMinutes: null,
      interruptionMinutes: 7,
    });

    let emitted = false;
    component.estimateApplied.subscribe(() => { emitted = true; });

    component.apply();

    expect(emitted).toBe(false);
    expect(component.prepTimeForm.touched).toBe(true);
  });

  it('close emits visibleChange false', () => {
    const component = setup();
    let visible = true;
    component.visibleChange.subscribe((v) => { visible = v; });

    component.close();

    expect(visible).toBe(false);
    expect(component.visible()).toBe(false);
  });
});
