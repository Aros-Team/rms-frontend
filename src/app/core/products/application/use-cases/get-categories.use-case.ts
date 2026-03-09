import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Category } from '../../domain/models/category.model';
import { CategoryRepositoryPort } from '../ports/output/category.repository.port';
import { CATEGORY_REPOSITORY } from '../tokens/products.tokens';

@Injectable({ providedIn: 'root' })
export class GetCategoriesUseCase {
  private readonly repository = inject(CATEGORY_REPOSITORY);
  
  execute(): Observable<Category[]> {
    return this.repository.getAll();
  }
}