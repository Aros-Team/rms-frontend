export interface RmsInputOptions {
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  errorMessage?: string;
  hint?: string;
  id?: string;
}

export interface RmsInputInputs extends RmsInputOptions {
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  disabled: boolean;
  readonly: boolean;
  required: boolean;
  id: string;
}
