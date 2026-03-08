export interface RmsSelectOption<T = string | number> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface RmsSelectOptions {
  label?: string;
  placeholder?: string;
  options: RmsSelectOption[];
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  errorMessage?: string;
  hint?: string;
  id?: string;
  emptyMessage?: string;
}

export interface RmsSelectInputs extends RmsSelectOptions {
  label: string;
  placeholder: string;
  options: RmsSelectOption[];
  disabled: boolean;
  readonly: boolean;
  required: boolean;
  id: string;
  emptyMessage: string;
}
