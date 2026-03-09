import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product, CreateProductDto } from '../ports/output/products.repository.port';
import { ProductsRepositoryPort } from '../ports/output/products.repository.port';
import { PRODUCTS_REPOSITORY } from '../tokens/products.tokens';

@Injectable({ providedIn: 'root' })
export class CreateProductUseCase {
  private readonly repository = inject(PRODUCTS_REPOSITORY);
  
  execute(dto: CreateProductDto): Observable<Product> {
    return this.repository.create(dto);
  }
}