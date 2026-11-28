/**
 * Tests for the labor-costing section.
 *
 * Feature: `/admin/settings` → Nómina.
 * Contract: the mode, standard hourly rate and default expected hours are loaded
 * from `/v1/settings/labor`; the PUT sends numbers (the wire request is a raw
 * BigDecimal, not a MoneyDto) and the screen explains each mode.
 *
 * Approach: mount with a stubbed API; edit the form; assert request payload,
 * dirty state and validation.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { LaborSettingsSection } from './labor-settings';
import laborHtml from './labor-settings.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import emptyStateHtml from '@shared/ui/empty-state/empty-state.html?raw';
import fieldHtml from '@shared/ui/field/field.html?raw';
import inputHtml from '@shared/ui/input/input.html?raw';
import sectionHtml from '@shared/ui/section/section.html?raw';
import selectHtml from '@shared/ui/select/select.html?raw';
import skeletonHtml from '@shared/ui/skeleton/skeleton.html?raw';

const LABOR = {
  mode: 'AUTO' as const,
  standardHourlyRate: { amount: '12000.00', currency: 'COP' },
  defaultExpectedHoursPerMonth: 160,
};

describe('LaborSettingsSection', () => {
  let fixture: ComponentFixture<LaborSettingsSection>;
  let component: LaborSettingsSection;
  let api: {
    getLabor: ReturnType<typeof vi.fn>;
    updateLabor: ReturnType<typeof vi.fn>;
  };
  let messages: { add: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    await resolveUiResources({
      'labor-settings.html': laborHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'empty-state.html': emptyStateHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
      'input.html': inputHtml as unknown as string,
      'section.html': sectionHtml as unknown as string,
      'select.html': selectHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      getLabor: vi.fn(() => of({ ...LABOR })),
      updateLabor: vi.fn((body: unknown) =>
        of({
          mode: (body as { mode: string }).mode,
          standardHourlyRate: {
            amount: `${String((body as { standardHourlyRate: number }).standardHourlyRate)}.00`,
            currency: 'COP',
          },
          defaultExpectedHoursPerMonth: (body as { defaultExpectedHoursPerMonth: number })
            .defaultExpectedHoursPerMonth,
        }),
      ),
    };
    messages = { add: vi.fn() };

    TestBed.configureTestingModule({
      imports: [LaborSettingsSection],
      providers: [
        { provide: SettingsApi, useValue: api },
        { provide: MessageService, useValue: messages },
      ],
    });

    fixture = TestBed.createComponent(LaborSettingsSection);
    component = fixture.componentInstance;
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('loads the persisted mode, rate and hours', () => {
    expect(component.loading()).toBe(false);
    expect(component.form.getRawValue()).toEqual({
      mode: 'AUTO',
      standardHourlyRate: '12000.00',
      defaultExpectedHoursPerMonth: '160',
    });
    expect(component.currency()).toBe('COP');
    expect(component.dirty()).toBe(false);
  });

  it('explains the three costing modes', () => {
    expect(component.modes.map((mode) => mode.id)).toEqual(['AUTO', 'REAL', 'STANDARD']);
    expect(component.modes.every((mode) => mode.description.length > 20)).toBe(true);
  });

  it('sends numbers, not money objects, when saving', () => {
    component.form.controls.mode.setValue('REAL');
    component.form.controls.standardHourlyRate.setValue('15000');

    component.save();

    expect(api.updateLabor).toHaveBeenCalledWith({
      mode: 'REAL',
      standardHourlyRate: 15000,
      defaultExpectedHoursPerMonth: 160,
    });
    expect(component.dirty()).toBe(false);
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
  });

  it('rejects a negative rate and an out-of-range hours value', () => {
    component.form.controls.standardHourlyRate.setValue('-1');
    component.form.controls.defaultExpectedHoursPerMonth.setValue('800');

    component.save();

    expect(api.updateLabor).not.toHaveBeenCalled();
    expect(component.form.controls.standardHourlyRate.hasError('amount')).toBe(true);
    expect(component.form.controls.defaultExpectedHoursPerMonth.hasError('hours')).toBe(true);
  });

  it('marks the section dirty when the mode changes', () => {
    const emitted: boolean[] = [];
    component.dirtyChange.subscribe((value) => emitted.push(value));

    component.form.controls.mode.setValue('STANDARD');

    expect(component.dirty()).toBe(true);
    expect(emitted.at(-1)).toBe(true);
    expect(component.modeValue()).toBe('STANDARD');
  });

  it('restores the persisted settings on discard', () => {
    component.form.controls.standardHourlyRate.setValue('99999');

    component.reset();

    expect(component.form.controls.standardHourlyRate.value).toBe('12000.00');
    expect(component.dirty()).toBe(false);
  });
});
