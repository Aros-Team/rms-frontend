import { Observable } from 'rxjs';
import { Product } from '../../../domain/models/product.model';

export { Product };

export interface CreateProductDto {
  name: string;
  basePrice: number;
  hasOptions: boolean;
  categoryId: number;
  areaId: number;
}

export interface ProductsRepositoryPort {
  getAll(): Observable<Product[]>;
  getById(id: number): Observable<Product>;
  create(dto: CreateProductDto): Observable<Product>;
  update(id: number, dto: CreateProductDto): Observable<Product>;
  disable(id: number): Observable<void>;
}