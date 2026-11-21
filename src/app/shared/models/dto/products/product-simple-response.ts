import type { Money } from '@app/shared/models/dto/common/money';
export interface ProductSimpleResponse {
  id: number;
  name: string;
  /** `MoneyDto` on the wire. Use `toAmount()` for math. */
  basePrice: Money;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
  /** Signed URL of the primary image (mobile variant). */
  imageUrl?: string | null;
}
