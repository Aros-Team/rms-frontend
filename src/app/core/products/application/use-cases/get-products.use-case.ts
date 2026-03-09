import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Product } from '../../domain/models/product.model';
import { ProductsRepositoryPort } from '../ports/output/products.repository.port';
import { PRODUCTS_REPOSITORY } from '../tokens/products.tokens';

@Injectable({ providedIn: 'root' })
export class GetProductsUseCase {
  private readonly repository = inject(PRODUCTS_REPOSITORY);
  
  execute(): Observable<Product[]> {
    return this.repository.getAll();
  }
}