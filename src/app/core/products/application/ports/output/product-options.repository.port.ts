import { Observable } from 'rxjs';
import { ProductOption, OptionCategory } from '../../../domain/models/product-option.model';

export interface ProductOptionsRepositoryPort {
  getOptions(): Observable<ProductOption[]>;
  getOptionCategories(): Observable<OptionCategory[]>;
}