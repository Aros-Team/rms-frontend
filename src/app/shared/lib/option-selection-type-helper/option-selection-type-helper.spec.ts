/**
 * Tests for the OPTION_SELECTION_TYPE_CONFIG and helper functions.
 *
 * Feature: Maps OptionSelectionType enum values to display config (label, icon, severity, color).
 * Contract: Each of the 4 selection types has correct config; getSelectionTypeConfig
 * returns the right config or falls back to SINGLE_CHOICE for invalid/null/undefined.
 * Approach: Import helpers directly (no TestBed needed), assert exact property values.
 */
import {
  OPTION_SELECTION_TYPE_CONFIG,
  getSelectionTypeConfig,
  isSingleChoice,
  isMultiSelect,
  isRemovable,
  hasExtraPrice,
} from './option-selection-type-helper';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

describe('OPTION_SELECTION_TYPE_CONFIG', () => {
  it('should have all 4 selection types defined', () => {
    expect(Object.keys(OPTION_SELECTION_TYPE_CONFIG).length).toBe(4);
    expect(OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.SINGLE_CHOICE]).toEqual(
      expect.objectContaining({ label: 'Única opción' }),
    );
    expect(OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.MULTI_SELECT]).toEqual(
      expect.objectContaining({ label: 'Selección múltiple' }),
    );
    expect(OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.EXTRA]).toEqual(
      expect.objectContaining({ label: 'Extra' }),
    );
    expect(OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.REMOVE]).toEqual(
      expect.objectContaining({ label: 'Quitar' }),
    );
  });

  it('should have correct config for SINGLE_CHOICE', () => {
    const config = OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.SINGLE_CHOICE];
    expect(config.label).toBe('Única opción');
    expect(config.icon).toBe('pi pi-circle');
    expect(config.severity).toBe('info');
    expect(config.color).toBe('#3B82F6');
    expect(config.description).toBe('Solo se puede elegir una opción del grupo');
  });

  it('should have correct config for MULTI_SELECT', () => {
    const config = OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.MULTI_SELECT];
    expect(config.label).toBe('Selección múltiple');
    expect(config.icon).toBe('pi pi-check-square');
    expect(config.severity).toBe('success');
    expect(config.color).toBe('#10B981');
    expect(config.description).toBe('Se pueden elegir varias opciones del grupo');
  });

  it('should have correct config for EXTRA', () => {
    const config = OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.EXTRA];
    expect(config.label).toBe('Extra');
    expect(config.icon).toBe('pi pi-plus-circle');
    expect(config.severity).toBe('warn');
    expect(config.color).toBe('#F59E0B');
    expect(config.description).toBe('Opciones con cargo adicional');
  });

  it('should have correct config for REMOVE', () => {
    const config = OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.REMOVE];
    expect(config.label).toBe('Quitar');
    expect(config.icon).toBe('pi pi-minus-circle');
    expect(config.severity).toBe('danger');
    expect(config.color).toBe('#EF4444');
    expect(config.description).toBe('Opciones para quitar ingredientes');
  });
});

describe('getSelectionTypeConfig', () => {
  it('should return correct config for SINGLE_CHOICE', () => {
    const config = getSelectionTypeConfig(OptionSelectionType.SINGLE_CHOICE);
    expect(config.label).toBe('Única opción');
    expect(config.severity).toBe('info');
  });

  it('should return correct config for MULTI_SELECT', () => {
    const config = getSelectionTypeConfig(OptionSelectionType.MULTI_SELECT);
    expect(config.label).toBe('Selección múltiple');
    expect(config.severity).toBe('success');
  });

  it('should return correct config for EXTRA', () => {
    const config = getSelectionTypeConfig(OptionSelectionType.EXTRA);
    expect(config.label).toBe('Extra');
    expect(config.severity).toBe('warn');
  });

  it('should return correct config for REMOVE', () => {
    const config = getSelectionTypeConfig(OptionSelectionType.REMOVE);
    expect(config.label).toBe('Quitar');
    expect(config.severity).toBe('danger');
  });

  it('should return SINGLE_CHOICE config as fallback for invalid type', () => {
    const config = getSelectionTypeConfig('INVALID_TYPE' as OptionSelectionType);
    expect(config.label).toBe('Única opción');
    expect(config.severity).toBe('info');
  });

  it('should return SINGLE_CHOICE config as fallback for null', () => {
    const config = getSelectionTypeConfig(null);
    expect(config.label).toBe('Única opción');
    expect(config.severity).toBe('info');
  });

  it('should return SINGLE_CHOICE config as fallback for undefined', () => {
    const config = getSelectionTypeConfig(undefined);
    expect(config.label).toBe('Única opción');
    expect(config.severity).toBe('info');
  });
});

describe('isSingleChoice', () => {
  it('should return true for SINGLE_CHOICE', () => {
    expect(isSingleChoice(OptionSelectionType.SINGLE_CHOICE)).toBe(true);
  });

  it('should return false for MULTI_SELECT', () => {
    expect(isSingleChoice(OptionSelectionType.MULTI_SELECT)).toBe(false);
  });

  it('should return false for EXTRA', () => {
    expect(isSingleChoice(OptionSelectionType.EXTRA)).toBe(false);
  });

  it('should return false for REMOVE', () => {
    expect(isSingleChoice(OptionSelectionType.REMOVE)).toBe(false);
  });
});

describe('isMultiSelect', () => {
  it('should return true for MULTI_SELECT', () => {
    expect(isMultiSelect(OptionSelectionType.MULTI_SELECT)).toBe(true);
  });

  it('should return false for SINGLE_CHOICE', () => {
    expect(isMultiSelect(OptionSelectionType.SINGLE_CHOICE)).toBe(false);
  });

  it('should return false for EXTRA', () => {
    expect(isMultiSelect(OptionSelectionType.EXTRA)).toBe(false);
  });

  it('should return false for REMOVE', () => {
    expect(isMultiSelect(OptionSelectionType.REMOVE)).toBe(false);
  });
});

describe('isRemovable', () => {
  it('should return true for REMOVE', () => {
    expect(isRemovable(OptionSelectionType.REMOVE)).toBe(true);
  });

  it('should return false for SINGLE_CHOICE', () => {
    expect(isRemovable(OptionSelectionType.SINGLE_CHOICE)).toBe(false);
  });

  it('should return false for MULTI_SELECT', () => {
    expect(isRemovable(OptionSelectionType.MULTI_SELECT)).toBe(false);
  });

  it('should return false for EXTRA', () => {
    expect(isRemovable(OptionSelectionType.EXTRA)).toBe(false);
  });
});

describe('hasExtraPrice', () => {
  it('should return true for EXTRA', () => {
    expect(hasExtraPrice(OptionSelectionType.EXTRA)).toBe(true);
  });

  it('should return false for SINGLE_CHOICE', () => {
    expect(hasExtraPrice(OptionSelectionType.SINGLE_CHOICE)).toBe(false);
  });

  it('should return false for MULTI_SELECT', () => {
    expect(hasExtraPrice(OptionSelectionType.MULTI_SELECT)).toBe(false);
  });

  it('should return false for REMOVE', () => {
    expect(hasExtraPrice(OptionSelectionType.REMOVE)).toBe(false);
  });
});