export interface RmsEmptyStateOptions {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  actionIcon?: string;
}

export interface RmsEmptyStateInputs extends RmsEmptyStateOptions {
  title: string;
}
