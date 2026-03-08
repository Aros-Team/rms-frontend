export type RmsSkeletonVariant = 'rectangle' | 'circle' | 'text' | 'square';

export interface RmsSkeletonOptions {
  variant?: RmsSkeletonVariant;
  width?: string;
  height?: string;
  borderRadius?: string;
  animation?: 'wave' | 'progress' | 'none';
  styleClass?: string;
}

export interface RmsSkeletonInputs extends RmsSkeletonOptions {
  variant: RmsSkeletonVariant;
  width: string;
  height: string;
  borderRadius: string;
  animation: 'wave' | 'progress' | 'none';
}
