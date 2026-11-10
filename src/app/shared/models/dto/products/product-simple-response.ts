import type { Money } from '@app/shared/models/dto/common/money';
export interface ProductSimpleResponse {
  id: number;
  name: string;
  /** `MoneyDto` on the wire. Use `toAmount()` for math. */
  basePrice: Money | number;
  active: boolean;
  categoryId: number;
  categoryName: string;
  areaId: number;
}