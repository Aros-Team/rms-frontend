import { OptionSelectionType, ApiSelectionType, isApiSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

/**
 * Bidirectional mapper between frontend internal enum names
 * and backend API string values.
 */

const API_TO_INTERNAL: Record<ApiSelectionType, OptionSelectionType> = {
  SINGLE_CHOICE: OptionSelectionType.SINGLE_CHOICE,
  MULTI_CHOICE: OptionSelectionType.MULTI_SELECT,
  ADD_ON: OptionSelectionType.EXTRA,
  REMOVAL: OptionSelectionType.REMOVE,
};

const INTERNAL_TO_API: Record<OptionSelectionType, ApiSelectionType> = {
  [OptionSelectionType.SINGLE_CHOICE]: 'SINGLE_CHOICE',
  [OptionSelectionType.MULTI_SELECT]: 'MULTI_CHOICE',
  [OptionSelectionType.EXTRA]: 'ADD_ON',
  [OptionSelectionType.REMOVE]: 'REMOVAL',
};

/** Convert frontend-internal enum to API value for requests. */
export function toApi(internal: OptionSelectionType): ApiSelectionType {
  return INTERNAL_TO_API[internal];
}

/**
 * Convert API value to frontend-internal enum.
 * Returns SINGLE_CHOICE for unknown/null values (backend default).
 */
export function fromApi(api: ApiSelectionType | null | undefined): OptionSelectionType {
  if (api === null || api === undefined) return OptionSelectionType.SINGLE_CHOICE;
  return API_TO_INTERNAL[api];
}

/**
 * Safely convert an untrusted string (from HTTP response) to internal enum.
 * Returns SINGLE_CHOICE if the string is not a valid API value.
 */
export function fromApiString(api: string | null | undefined): OptionSelectionType {
  if (api === null || api === undefined || !isApiSelectionType(api)) {
    return OptionSelectionType.SINGLE_CHOICE;
  }
  return API_TO_INTERNAL[api];
}
