import { Provider } from '@angular/core';
import { AREA_REPOSITORY, CATEGORY_REPOSITORY, PRODUCTS_REPOSITORY, PRODUCT_OPTIONS_REPOSITORY } from '../../core/products/application/tokens/products.tokens';
import { AreasHttpRepository } from '../http/areas/areas-http.repository';
import { CategoriesHttpRepository } from '../http/categories/categories-http.repository';
import { ProductsHttpRepository } from '../http/products/products-http.repository';
import { ProductOptionsHttpRepository } from '../http/products/product-options-http.repository';

export const provideProductsInfrastructure: Provider[] = [
  { provide: AREA_REPOSITORY, useClass: AreasHttpRepository },
  { provide: CATEGORY_REPOSITORY, useClass: CategoriesHttpRepository },
  { provide: PRODUCTS_REPOSITORY, useClass: ProductsHttpRepository },
  { provide: PRODUCT_OPTIONS_REPOSITORY, useClass: ProductOptionsHttpRepository },
];