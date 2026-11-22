import { Money } from './money';

/**
 * Wire shape of `GET /api/v1/products/top-selling`.
 *
 * The endpoint ranks products by units sold inside a concrete date range and
 * returns the revenue per product as a `MoneyDto`. It is not the product list:
 * it carries `rank`, `unitsSold` and `revenue`, no catalogue fields.
 */
export interface TopSellingProduct {
  rank: number;
  productId: number;
  productName: string;
  unitsSold: number;
  revenue: Money;
}
