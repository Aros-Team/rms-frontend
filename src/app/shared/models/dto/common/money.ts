/**
 * Monetary value as consumed by the frontend.
 *
 * The backend serializes Java's `Money` class with extra fields
 * (zero, negative, positive booleans, currency object details).
 * The frontend only needs amount + currency code, so we standardize
 * to this minimal shape. Extra fields from the wire are ignored.
 */
export interface Money {
  amount: number;
  currency: string;
}
