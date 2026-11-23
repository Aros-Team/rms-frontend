import type { Money } from '@app/shared/models/dto/common/money';
import type { SelectionType } from '@app/shared/models/dto/special-selections/selection-type';

export interface ProductListResponse {
  id: number;
  name: string;
  description?: string;
  /** `MoneyDto` on the wire (see `dto/common/money.ts`). Render with `money`, normalize with `toAmount()`. */
  basePrice: Money;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  areaName?: string;
  /** Signed URL of the primary image (mobile variant), `null` when the product has none. */
  imageUrl?: string | null;
  /** Signed URL of the primary image (tablet variant). */
  imageTabletUrl?: string | null;
  /** Signed URL of the primary image (desktop variant). */
  imageDesktopUrl?: string | null;
  estimatedPrepMinutes?: number;
  selectionType?: SelectionType;
}
