export interface RmsCardOptions {
  title?: string;
  subtitle?: string;
  headerTemplate?: any;
  footerTemplate?: any;
  styleClass?: string;
}

export interface RmsCardInputs extends RmsCardOptions {
  title: string;
  styleClass: string;
}
