/**
 * Tests for the option-selection-type-mapper functions.
 *
 * Feature: Bidirectional mapper between frontend internal enum names and backend API strings.
 * Contract: toApi() converts internal → API; fromApi() converts API → internal with SINGLE_CHOICE
 * fallback for null/undefined; fromApiString() validates untrusted strings; round-trip is lossless.
 * Approach: Import mapper functions directly (no TestBed needed), assert exact enum/string values
 * for all valid mappings, null/undefined, and invalid inputs.
 */
import { OptionSelectionType, ApiSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';
import { toApi, fromApi, fromApiString } from './option-selection-type-mapper';

describe('option-selection-type-mapper', () => {
  describe('toApi', () => {
    it('maps internal → API', () => {
      expect(toApi(OptionSelectionType.SINGLE_CHOICE)).toBe('SINGLE_CHOICE');
      expect(toApi(OptionSelectionType.MULTI_SELECT)).toBe('MULTI_CHOICE');
      expect(toApi(OptionSelectionType.EXTRA)).toBe('ADD_ON');
      expect(toApi(OptionSelectionType.REMOVE)).toBe('REMOVAL');
    });
  });

  describe('fromApi', () => {
    it('maps API → internal', () => {
      expect(fromApi('SINGLE_CHOICE')).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(fromApi('MULTI_CHOICE')).toBe(OptionSelectionType.MULTI_SELECT);
      expect(fromApi('ADD_ON')).toBe(OptionSelectionType.EXTRA);
      expect(fromApi('REMOVAL')).toBe(OptionSelectionType.REMOVE);
    });
    it('returns SINGLE_CHOICE for null/undefined', () => {
      expect(fromApi(null)).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(fromApi(undefined)).toBe(OptionSelectionType.SINGLE_CHOICE);
    });
  });

  describe('fromApiString (with validation)', () => {
    it('maps valid API strings', () => {
      expect(fromApiString('MULTI_CHOICE')).toBe(OptionSelectionType.MULTI_SELECT);
      expect(fromApiString('ADD_ON')).toBe(OptionSelectionType.EXTRA);
      expect(fromApiString('REMOVAL')).toBe(OptionSelectionType.REMOVE);
    });
    it('returns SINGLE_CHOICE for invalid/empty', () => {
      expect(fromApiString('INVALID')).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(fromApiString('')).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(fromApiString(null)).toBe(OptionSelectionType.SINGLE_CHOICE);
    });
  });

  describe('round-trip', () => {
    it('toApi(fromApi(x)) === x for all values', () => {
      const api: ApiSelectionType[] = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'ADD_ON', 'REMOVAL'];
      api.forEach(a => {
        expect(toApi(fromApi(a))).toBe(a);
      });
    });
  });
});
