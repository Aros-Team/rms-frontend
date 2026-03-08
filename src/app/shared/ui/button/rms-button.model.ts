export type RmsButtonSeverity = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'danger' | 'contrast' | undefined;

export interface RmsButtonOptions {
  label?: string;
  icon?: string;
  severity?: RmsButtonSeverity;
  outlined?: boolean;
  text?: boolean;
  raised?: boolean;
  rounded?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  styleClass?: string;
  iconPos?: 'left' | 'right';
}

export interface RmsButtonInputs extends RmsButtonOptions {
  label: string;
  severity: RmsButtonSeverity;
  outlined: boolean;
  text: boolean;
  raised: boolean;
  rounded: boolean;
  disabled: boolean;
  loading: boolean;
  type: 'button' | 'submit' | 'reset';
  iconPos: 'left' | 'right';
}
