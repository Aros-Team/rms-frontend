import { Money } from '@app/shared/models/dto/common/money';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

export interface ProductOption {
  id: number;
  name: string;
  optionCategoryId: number;
  optionCategoryName: string;
  /** Present when fetched via /products/{id}/options */
  optionGroupId?: number;
  /** Present when fetched via /products/{id}/options */
  optionGroupName?: string;
  cost?: Money;
  extraPrice?: Money;
  categorySelectionType?: OptionSelectionType;
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

export interface OptionExtrasItem {
  optionId: number;
  extraPrice: number;
}
