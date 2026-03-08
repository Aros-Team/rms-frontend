export interface RmsFilterChip {
  label: string;
  value: string;
}

export interface RmsFilterChipsOptions {
  chips: RmsFilterChip[];
  activeValue?: string;
  allowClear?: boolean;
}

export interface RmsFilterChipsInputs extends RmsFilterChipsOptions {
  chips: RmsFilterChip[];
  activeValue: string;
  allowClear: boolean;
}
