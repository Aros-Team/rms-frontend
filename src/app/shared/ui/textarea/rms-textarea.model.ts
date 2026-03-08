export interface RmsTextareaOptions {
  label?: string;
  placeholder?: string;
  rows?: number;
  cols?: number;
  autoResize?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  errorMessage?: string;
  hint?: string;
  id?: string;
}

export interface RmsTextareaInputs extends RmsTextareaOptions {
  label: string;
  placeholder: string;
  rows: number;
  cols: number;
  autoResize: boolean;
  disabled: boolean;
  readonly: boolean;
  required: boolean;
  id: string;
}
