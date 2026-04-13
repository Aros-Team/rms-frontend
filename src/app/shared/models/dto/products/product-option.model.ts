export interface ProductOption {
  id: number;
  name: string;
  optionCategoryId: number;
  optionCategoryName: string;
}

export interface ProductOptionRequest {
  name: string;
  optionCategoryId: number;
}

export type ProductOptionResponse = ProductOption;

export interface OptionCategory {
  id: number;
  name: string;
  description: string;
}
