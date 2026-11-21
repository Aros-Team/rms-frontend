import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export interface SelectionTypeConfig {
  label: string;
  icon: string;
  severity: TagSeverity;
  color: string;
  description: string;
}

/** Central config for visual representation of each selection type. */
export const OPTION_SELECTION_TYPE_CONFIG: Record<OptionSelectionType, SelectionTypeConfig> = {
  [OptionSelectionType.SINGLE_CHOICE]: {
    label: 'Única opción',
    icon: 'pi pi-circle',
    severity: 'info',
    color: '#3B82F6',
    description: 'Solo se puede elegir una opción del grupo',
  },
  [OptionSelectionType.MULTI_SELECT]: {
    label: 'Selección múltiple',
    icon: 'pi pi-check-square',
    severity: 'success',
    color: '#10B981',
    description: 'Se pueden elegir varias opciones del grupo',
  },
  [OptionSelectionType.EXTRA]: {
    label: 'Extra',
    icon: 'pi pi-plus-circle',
    severity: 'warn',
    color: '#F59E0B',
    description: 'Opciones con cargo adicional',
  },
  [OptionSelectionType.REMOVE]: {
    label: 'Quitar',
    icon: 'pi pi-minus-circle',
    severity: 'danger',
    color: '#EF4444',
    description: 'Opciones para quitar ingredientes',
  },
};

/** Get config for a given internal selection type. Returns SINGLE_CHOICE config as fallback. */
export function getSelectionTypeConfig(type: OptionSelectionType | string | null | undefined): SelectionTypeConfig {
  if (type && type in OPTION_SELECTION_TYPE_CONFIG) {
    return OPTION_SELECTION_TYPE_CONFIG[type as OptionSelectionType];
  }
  return OPTION_SELECTION_TYPE_CONFIG[OptionSelectionType.SINGLE_CHOICE];
}

/** Predicate: is the type a single-choice group? */
export function isSingleChoice(type: OptionSelectionType): boolean {
  return type === OptionSelectionType.SINGLE_CHOICE;
}

/** Predicate: is the type multi-select? */
export function isMultiSelect(type: OptionSelectionType): boolean {
  return type === OptionSelectionType.MULTI_SELECT;
}

/** Predicate: is the type removable? */
export function isRemovable(type: OptionSelectionType): boolean {
  return type === OptionSelectionType.REMOVE;
}

/** Predicate: does the type have extra price? */
export function hasExtraPrice(type: OptionSelectionType): boolean {
  return type === OptionSelectionType.EXTRA;
}