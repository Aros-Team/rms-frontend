import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ProductOption, OptionCategory } from '../../domain/models/product-option.model';
import { ProductOptionsRepositoryPort } from '../ports/output/product-options.repository.port';
import { PRODUCT_OPTIONS_REPOSITORY } from '../tokens/products.tokens';

@Injectable({ providedIn: 'root' })
export class GetProductOptionsUseCase {
  private readonly repository = inject(PRODUCT_OPTIONS_REPOSITORY);

  execute(): Observable<ProductOption[]> {
    return this.repository.getOptions();
  }

  getCategories(): Observable<OptionCategory[]> {
    return this.repository.getOptionCategories();
  }
}