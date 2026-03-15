export interface ProductOptionRequest {
  name: string;
  optionCategoryId: number;
}

export interface ProductOptionResponse {
  id: number;
  name: string;
  optionCategoryId: number;
  optionCategoryName: string;
}
