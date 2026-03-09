import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Area } from '../../domain/models/area.model';
import { AreaRepositoryPort } from '../ports/output/area.repository.port';
import { AREA_REPOSITORY } from '../tokens/products.tokens';

@Injectable({ providedIn: 'root' })
export class GetAreasUseCase {
  private readonly repository = inject(AREA_REPOSITORY);
  
  execute(): Observable<Area[]> {
    return this.repository.getAll();
  }
}