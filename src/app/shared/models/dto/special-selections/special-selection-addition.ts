import type { Money } from '@app/shared/models/dto/common/money';

export interface SpecialSelectionAdditionRequest {
  name: string;
  optionId: number;
  /** Amount we send. The backend expects a plain number in requests. */
  extraPrice: number;
  displayOrder: number;
}

export interface SpecialSelectionAdditionResponse {
  id: number;
  name: string;
  optionId: number;
  /**
   * `MoneyDto { amount: string, currency: string }` on the wire (the backend
   * money migration). `number` is a transitional tolerance; use `toAmount()`
   * before arithmetic.
   */
  extraPrice: Money | number;
  displayOrder: number;
  optionName: string;
}
