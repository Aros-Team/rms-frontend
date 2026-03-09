import { Observable } from 'rxjs';
import { Category } from '../../../domain/models/category.model';

export interface CategoryRepositoryPort {
  getAll(): Observable<Category[]>;
  getById(id: number): Observable<Category>;
}