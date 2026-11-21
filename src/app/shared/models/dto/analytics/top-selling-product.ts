import type { ProductResponse } from '@app/shared/models/dto/products/product-response';

/**
 * `GET /v1/products/top-selling` answers with the regular `ProductResponse`
 * shape (see `ProductController#getTopSelling`); it is not a bespoke
 * "sold quantity" payload. Kept as an alias so existing imports stay valid.
 */
export type TopSellingProduct = ProductResponse;
