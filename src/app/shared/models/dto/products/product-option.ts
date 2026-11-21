import { Money } from '@app/shared/models/dto/common/money';
import { ApiSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

/**
 * Wire shape of `ProductOptionResponse`, shared by:
 * `GET /v1/products/{id}/options`, `GET /v1/product-options` and
 * `GET /v1/option-groups/{id}/options`.
 */
export interface ProductOption {
  id: number;
  name: string;
  /** ID of the option group (called "category" in older payloads). */
  optionGroupId: number;
  /** Name of the option group (called "category" in older payloads). */
  optionGroupName: string;
  cost?: Money;
  extraPrice?: Money;
  categorySelectionType?: ApiSelectionType;
}

export interface ProductOptionRequest {
  name: string;
  /** API field name is `optionGroupId` (required by `ProductOptionRequest`). */
  optionGroupId: number;
  recipe?: { supplyVariantId: number; requiredQuantity: number }[];
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
