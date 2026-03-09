import { Observable } from 'rxjs';
import { Area } from '../../../domain/models/area.model';

export interface AreaRepositoryPort {
  getAll(): Observable<Area[]>;
  getById(id: number): Observable<Area>;
}