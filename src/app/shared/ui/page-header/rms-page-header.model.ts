export interface RmsPageHeaderOptions {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backIcon?: string;
}

export interface RmsPageHeaderInputs extends RmsPageHeaderOptions {
  title: string;
  showBackButton: boolean;
  backIcon: string;
}
