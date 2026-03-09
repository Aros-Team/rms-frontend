export interface ProductOption {
  id: number;
  name: string;
  optionCategoryId: number;
  optionCategoryName: string;
}

export interface OptionCategory {
  id: number;
  name: string;
  description?: string;
}