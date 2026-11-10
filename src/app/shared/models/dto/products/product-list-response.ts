import type { Money } from '@app/shared/models/dto/common/money';
import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';

export interface ProductListResponse {
  id: number;
  name: string;
  description?: string;
  /** `MoneyDto` on the wire (see `dto/common/money.ts`). Render with `money`, normalize with `toAmount()`. */
  basePrice: Money | number;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  thumbnailUrl?: string;
  selectionType?: SelectionType;
}
