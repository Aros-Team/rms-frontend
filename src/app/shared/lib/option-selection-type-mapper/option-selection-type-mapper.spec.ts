/**
 * Tests for the option-selection-type-mapper functions.
 *
 * Feature: Bidirectional mapper between frontend internal enum names and backend API strings.
 * Contract: toApi() converts internal → API (and has no fallback: an unknown
 * internal value yields `undefined`); fromApi() converts API → internal with a
 * SINGLE_CHOICE fallback only for null/undefined (an unknown API string yields
 * `undefined`, because that input is typed, not untrusted); fromApiString()
 * validates untrusted strings and falls back to SINGLE_CHOICE for anything that
 * is not an exact, case-sensitive API value; round-trip is lossless both ways.
 * Approach: Import mapper functions directly (no TestBed needed), assert exact enum/string values
 * for all valid mappings, null/undefined, unknown values and invalid inputs.
 */
import {
  OptionSelectionType,
  ApiSelectionType,
} from '@app/shared/models/dto/option-groups/option-selection-type';
import { toApi, fromApi, fromApiString } from './option-selection-type-mapper';

describe('option-selection-type-mapper', () => {
  describe('toApi', () => {
    it('maps internal → API', () => {
      expect(toApi(OptionSelectionType.SINGLE_CHOICE)).toBe('SINGLE_CHOICE');
      expect(toApi(OptionSelectionType.MULTI_SELECT)).toBe('MULTI_CHOICE');
      expect(toApi(OptionSelectionType.EXTRA)).toBe('ADD_ON');
      expect(toApi(OptionSelectionType.REMOVE)).toBe('REMOVAL');
    });

    it('has no fallback: an unknown internal value maps to undefined', () => {
      expect(toApi('NOT_A_SELECTION_TYPE' as OptionSelectionType)).toBeUndefined();
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

    it('has no fallback for unknown API strings (use fromApiString for untrusted input)', () => {
      expect(fromApi('MULTI_SELECT' as ApiSelectionType)).toBeUndefined();
      expect(fromApi('single_choice' as ApiSelectionType)).toBeUndefined();
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

    it('returns SINGLE_CHOICE for undefined', () => {
      expect(fromApiString(undefined)).toBe(OptionSelectionType.SINGLE_CHOICE);
    });

    it('rejects internal enum names that are not API values', () => {
      expect(fromApiString('MULTI_SELECT')).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(fromApiString('EXTRA')).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(fromApiString('REMOVE')).toBe(OptionSelectionType.SINGLE_CHOICE);
    });

    it('is case and whitespace sensitive', () => {
      expect(fromApiString('multi_choice')).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(fromApiString('Multi_Choice')).toBe(OptionSelectionType.SINGLE_CHOICE);
      expect(fromApiString(' MULTI_CHOICE ')).toBe(OptionSelectionType.SINGLE_CHOICE);
    });
  });

  describe('round-trip', () => {
    it('toApi(fromApi(x)) === x for all API values', () => {
      const api: ApiSelectionType[] = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'ADD_ON', 'REMOVAL'];
      api.forEach((a) => {
        expect(toApi(fromApi(a))).toBe(a);
      });
    });

    it('fromApi(toApi(x)) === x for all internal values', () => {
      Object.values(OptionSelectionType).forEach((internal) => {
        expect(fromApi(toApi(internal))).toBe(internal);
      });
    });
  });
});
