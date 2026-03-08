export type RmsToastSeverity = 'success' | 'info' | 'warn' | 'error';

export interface RmsToast {
  severity: RmsToastSeverity;
  summary: string;
  detail?: string;
  life?: number;
  closable?: boolean;
}

export interface RmsToastOptions extends RmsToast {
  life: number;
  closable: boolean;
}
