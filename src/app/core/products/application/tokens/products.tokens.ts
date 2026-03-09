import { InjectionToken } from '@angular/core';
import { AreaRepositoryPort } from '../ports/output/area.repository.port';
import { CategoryRepositoryPort } from '../ports/output/category.repository.port';
import { ProductsRepositoryPort } from '../ports/output/products.repository.port';
import { ProductOptionsRepositoryPort } from '../ports/output/product-options.repository.port';

export const AREA_REPOSITORY = new InjectionToken<AreaRepositoryPort>('AREA_REPOSITORY');
export const CATEGORY_REPOSITORY = new InjectionToken<CategoryRepositoryPort>('CATEGORY_REPOSITORY');
export const PRODUCTS_REPOSITORY = new InjectionToken<ProductsRepositoryPort>('PRODUCTS_REPOSITORY');
export const PRODUCT_OPTIONS_REPOSITORY = new InjectionToken<ProductOptionsRepositoryPort>('PRODUCT_OPTIONS_REPOSITORY');