export type RmsBadgeSeverity = 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' | undefined;

export interface RmsBadgeOptions {
  label?: string;
  severity?: RmsBadgeSeverity;
  rounded?: boolean;
  styleClass?: string;
}

export interface RmsBadgeInputs extends RmsBadgeOptions {
  label: string;
  severity: RmsBadgeSeverity;
  rounded: boolean;
}
