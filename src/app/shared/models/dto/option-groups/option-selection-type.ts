/**
 * Internal enum for option group selection mode.
 * Used throughout the frontend UI.
 * Maps to API values via the mapper in shared/lib/option-selection-type-mapper/.
 */
export enum OptionSelectionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTI_SELECT = 'MULTI_SELECT',
  EXTRA = 'EXTRA',
  REMOVE = 'REMOVE',
}

/**
 * The literal type the backend accepts and returns.
 * Backend values: SINGLE_CHOICE, MULTI_CHOICE, ADD_ON, REMOVAL.
 */
export type ApiSelectionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'ADD_ON' | 'REMOVAL';

/**
 * All valid API values, for runtime validation.
 */
export const API_SELECTION_TYPE_VALUES: readonly ApiSelectionType[] = [
  'SINGLE_CHOICE',
  'MULTI_CHOICE',
  'ADD_ON',
  'REMOVAL',
] as const;

/**
 * Type guard for untrusted input (HTTP responses, form input).
 */
export function isApiSelectionType(s: string): s is ApiSelectionType {
  return (API_SELECTION_TYPE_VALUES as readonly string[]).includes(s);
}