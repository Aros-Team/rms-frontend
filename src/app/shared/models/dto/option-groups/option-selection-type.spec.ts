import { OptionSelectionType, API_SELECTION_TYPE_VALUES, isApiSelectionType } from './option-selection-type';

describe('OptionSelectionType enum', () => {
  it('has 4 internal values', () => {
    expect(Object.keys(OptionSelectionType).length).toBe(4);
  });

  it('maps internal names to their own strings', () => {
    expect(OptionSelectionType.SINGLE_CHOICE).toBe('SINGLE_CHOICE');
    expect(OptionSelectionType.MULTI_SELECT).toBe('MULTI_SELECT');
    expect(OptionSelectionType.EXTRA).toBe('EXTRA');
    expect(OptionSelectionType.REMOVE).toBe('REMOVE');
  });
});

describe('API_SELECTION_TYPE_VALUES', () => {
  it('has 4 values', () => {
    expect(API_SELECTION_TYPE_VALUES.length).toBe(4);
  });

  it('contains all expected API values', () => {
    expect(API_SELECTION_TYPE_VALUES).toContain('SINGLE_CHOICE');
    expect(API_SELECTION_TYPE_VALUES).toContain('MULTI_CHOICE');
    expect(API_SELECTION_TYPE_VALUES).toContain('ADD_ON');
    expect(API_SELECTION_TYPE_VALUES).toContain('REMOVAL');
  });
});

describe('isApiSelectionType', () => {
  it('returns true for all valid API values', () => {
    API_SELECTION_TYPE_VALUES.forEach(v => {
      expect(isApiSelectionType(v)).toBe(true);
    });
  });

  it('returns false for invalid strings', () => {
    expect(isApiSelectionType('INVALID')).toBe(false);
    expect(isApiSelectionType('single_choice')).toBe(false);
    expect(isApiSelectionType('')).toBe(false);
    expect(isApiSelectionType('MULTI_SELECT')).toBe(false);
  });
});