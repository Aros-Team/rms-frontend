export interface RmsModalOptions {
  header?: string;
  visible?: boolean;
  width?: string;
  styleClass?: string;
  closable?: boolean;
  maskVisible?: boolean;
  dismissableMask?: boolean;
  closeOnEscape?: boolean;
}

export interface RmsModalInputs extends RmsModalOptions {
  visible: boolean;
  width: string;
  closable: boolean;
  maskVisible: boolean;
  dismissableMask: boolean;
  closeOnEscape: boolean;
}
